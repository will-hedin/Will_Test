// map.js — D3 choropleth US map + state-level county map with generator overlay

const TOPO_STATES   = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const TOPO_COUNTIES = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

let _usTopojson       = null;
let _countiesTopojson = null;
let _usProjection     = null;
let _usPath           = null;
let _statePaths       = null;   // d3 selection of state <path> elements
let _currentView      = 'score';
let _countyZoom       = null;

// ── Haversine distance in km ─────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── US choropleth map ─────────────────────────────────────────────────────────

async function initUSMap(onStateClick) {
  const svg = d3.select('#us-map');
  const container = svg.node().parentElement;

  function getSize() {
    const w = container.clientWidth  || 960;
    const h = Math.max(500, Math.min(600, w * 0.58));
    return { w, h };
  }

  const { w, h } = getSize();
  svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h).attr('preserveAspectRatio', 'xMidYMid meet');

  _usProjection = d3.geoAlbersUsa().scale(w * 0.9).translate([w * 0.5, h * 0.48]);
  _usPath = d3.geoPath().projection(_usProjection);

  // Load TopoJSON
  _usTopojson = await d3.json(TOPO_STATES);
  const states = topojson.feature(_usTopojson, _usTopojson.objects.states);

  // Draw state mesh (borders)
  svg.append('path')
    .datum(topojson.mesh(_usTopojson, _usTopojson.objects.states, (a, b) => a !== b))
    .attr('class', 'state-border')
    .attr('d', _usPath);

  // Draw state fills
  _statePaths = svg.selectAll('path.state')
    .data(states.features)
    .enter().append('path')
    .attr('class', 'state')
    .attr('d', _usPath)
    .attr('data-fips', d => String(d.id).padStart(2, '0'))
    .on('mousemove', (event, d) => handleStateHover(event, d))
    .on('mouseleave', hideUSTooltip)
    .on('click', (event, d) => {
      const fips = String(d.id).padStart(2, '0');
      const stateId = FIPS_TO_STATE[fips];
      if (stateId) onStateClick(stateId);
    });

  updateUSMapColors('score');
  renderUSLegend('score');

  // Handle resize — rAF wrapper prevents ResizeObserver loop warnings
  const ro = new ResizeObserver(() => {
    requestAnimationFrame(() => {
      const { w: nw, h: nh } = getSize();
      svg.attr('viewBox', `0 0 ${nw} ${nh}`).attr('width', nw).attr('height', nh);
      _usProjection.scale(nw * 0.9).translate([nw * 0.5, nh * 0.48]);
      _usPath = d3.geoPath().projection(_usProjection);
      svg.selectAll('path.state').attr('d', _usPath);
      svg.selectAll('path.state-border').attr('d', _usPath);
    });
  });
  ro.observe(container);
}

function updateUSMapColors(viewType) {
  _currentView = viewType;
  if (!_statePaths) return;

  const colorFn = buildColorFn(viewType);
  _statePaths.attr('fill', d => {
    const fips = String(d.id).padStart(2, '0');
    const stateId = FIPS_TO_STATE[fips];
    return stateId ? colorFn(stateId) : '#e5e7eb';
  });

  renderUSLegend(viewType);
}

function buildColorFn(viewType) {
  if (viewType === 'iso') {
    return stateId => ISO_COLORS[STATE_DATA[stateId]?.iso] || '#e5e7eb';
  }
  if (viewType === 'demand') {
    const scale = d3.scaleSequential(d3.interpolateOranges).domain([0, 100]);
    return stateId => scale(STATE_DATA[stateId]?.dc_demand ?? 0);
  }
  if (viewType === 'supply') {
    // Reserve margin = (capacity - peak) / peak * 100  —  capped at 120% for color range
    const scale = d3.scaleSequential(d3.interpolateGreens).domain([0, 120]);
    return stateId => {
      const d = STATE_DATA[stateId];
      if (!d) return '#e5e7eb';
      const margin = ((d.capacity_gw - d.peak_gw) / d.peak_gw) * 100;
      return scale(Math.max(0, margin));
    };
  }
  if (viewType === '345kv') {
    const scale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 100]);
    return stateId => scale(KV345_SCORES[stateId] ?? 0);
  }
  // default: infrastructure score
  const scale = d3.scaleSequential(d3.interpolateBlues).domain([0, 100]);
  return stateId => scale(STATE_DATA[stateId]?.score ?? 0);
}

function handleStateHover(event, d) {
  const fips = String(d.id).padStart(2, '0');
  const stateId = FIPS_TO_STATE[fips];
  const info = stateId ? STATE_DATA[stateId] : null;
  if (!info) return;

  const mixStr = Object.entries(info.mix)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `<span class="mix-chip" style="background:${FUEL_COLORS[k] || '#ccc'}22;border:1px solid ${FUEL_COLORS[k] || '#ccc'}">${k} ${v}%</span>`)
    .join('');

  const reserveMargin = ((info.capacity_gw - info.peak_gw) / info.peak_gw * 100).toFixed(0);
  const headroomGW    = (info.capacity_gw - info.peak_gw).toFixed(1);

  const html = `
    <div class="tt-title">${info.name}</div>
    <div class="tt-row"><span>Installed Capacity</span><strong>${info.capacity_gw} GW</strong></div>
    <div class="tt-row"><span>Peak Demand</span><strong>${info.peak_gw} GW</strong></div>
    <div class="tt-row"><span>Available Supply</span><strong>${headroomGW} GW (${reserveMargin}% reserve)</strong></div>
    <div class="tt-row"><span>Grid Operator</span><strong>${info.iso}</strong></div>
    <div class="tt-row"><span>Primary Utility</span><strong>${info.utility}</strong></div>
    <div class="tt-mix">${mixStr}</div>
    <div class="tt-note">${info.dc_note}</div>
    <div class="tt-hint">Click to explore →</div>
  `;
  showUSTooltip(event, html);
}

function showUSTooltip(event, html) {
  const tt = document.getElementById('us-tooltip');
  tt.innerHTML = html;
  tt.classList.remove('hidden');
  positionTooltip(tt, event);
}

function hideUSTooltip() {
  document.getElementById('us-tooltip').classList.add('hidden');
}

function positionTooltip(el, event) {
  const pad = 14;
  let x = event.pageX + pad;
  let y = event.pageY + pad;
  const rect = el.getBoundingClientRect();
  if (x + rect.width + pad  > window.innerWidth)  x = event.pageX - rect.width - pad;
  if (y + rect.height + pad > window.innerHeight) y = event.pageY - rect.height - pad;
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
}

// ── US Legend ─────────────────────────────────────────────────────────────────

function renderUSLegend(viewType) {
  const el = document.getElementById('us-legend');
  if (!el) return;

  if (viewType === 'iso') {
    const items = Object.entries(ISO_COLORS)
      .map(([iso, color]) => `<div class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${iso}</div>`)
      .join('');
    el.innerHTML = `<div class="legend-row iso-legend">${items}</div>`;
    return;
  }

  const isScore  = viewType === 'score';
  const isSupply = viewType === 'supply';
  const is345    = viewType === '345kv';
  const label  = isScore  ? 'Infrastructure Score'
               : isSupply ? 'Reserve Margin (0–120%+)'
               : is345    ? '345+ kV Network Density'
               :            'DC Demand Index';
  const interp = isScore  ? d3.interpolateBlues
               : isSupply ? d3.interpolateGreens
               : is345    ? d3.interpolateYlOrRd
               :            d3.interpolateOranges;
  const steps  = 6;

  let swatches = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    swatches += `<span class="legend-swatch rect" style="background:${interp(t)}"></span>`;
  }

  el.innerHTML = `
    <div class="legend-row gradient-legend">
      <span class="legend-label-low">Low</span>
      ${swatches}
      <span class="legend-label-high">High</span>
      <span class="legend-title">${label}</span>
    </div>`;
}

// ── County / state detail map ─────────────────────────────────────────────────

let _countyTooltipHide = null;

async function renderCountyMap(stateId, generators) {
  const stateInfo    = STATE_DATA[stateId];
  const stateFipsInt = parseInt(stateInfo.fips);

  if (!_countiesTopojson) _countiesTopojson = await d3.json(TOPO_COUNTIES);

  const countiesGeo  = topojson.feature(_countiesTopojson, _countiesTopojson.objects.counties);
  const stateCounties = countiesGeo.features.filter(f =>
    Math.floor(+f.id / 1000) === stateFipsInt
  );

  if (stateCounties.length === 0) {
    document.getElementById('county-loading').textContent = 'No county data found.';
    return null;
  }

  _countyMapMode  = 'generators';
  _countyTxData   = null;
  _countyFeatures = stateCounties;

  const countyNames = {};
  for (const f of stateCounties) countyNames[f.id] = f.properties?.name || `County ${f.id}`;
  _countyNames = countyNames;

  const countyScores = {}, countyGenLists = {};
  if (generators && generators.length > 0) {
    const scoringGens = generators.slice(0, 500).filter(g => +g.latitude && +g.longitude);
    const centroids = {};
    for (const f of stateCounties) centroids[f.id] = d3.geoCentroid(f);
    for (const f of stateCounties) {
      const [clon, clat] = centroids[f.id];
      let totalMW = 0; const genList = [];
      for (const g of scoringGens) {
        const dist = haversineKm(clat, clon, +g.latitude, +g.longitude);
        if (dist <= 25) {
          const mw = +(g['nameplate-capacity-mw'] || 0);
          totalMW += mw;
          if (mw >= 10) genList.push(g);
        }
      }
      countyScores[f.id]   = totalMW;
      countyGenLists[f.id] = genList;
    }
    _countyGenMWRaw = Object.assign({}, countyScores);
    const maxScore = Math.max(1, ...Object.values(countyScores));
    for (const k in countyScores) countyScores[k] = (countyScores[k] / maxScore) * 100;
  }

  _countyScoresRaw   = countyScores;
  _countyGenListsRaw = countyGenLists;

  const colorScale = d3.scaleSequential()
    .domain([0, 100])
    .interpolator(d3.interpolateRgb('#1e3a5f', '#60a5fa'));
  _countyColorScale = colorScale;

  const countyFC  = { type: 'FeatureCollection', features: stateCounties };
  const bounds    = d3.geoBounds(countyFC);
  const stateBbox = [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]];

  // Destroy previous Leaflet map
  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }
  _countyGeoJsonLayer = null; _generatorLayerGroup = null;
  _txLayersByClass = {}; _txSubLayersByClass = {};

  const container = document.getElementById('county-map');
  _leafletMap = L.map(container, { zoomControl: true, attributionControl: false });
  _leafletMap.zoomControl.setPosition('bottomright');

  // ESRI World Imagery satellite tiles (no API key)
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 18, attribution: '&copy; Esri' }
  ).addTo(_leafletMap);

  // Semi-transparent county choropleth over satellite
  _countyGeoJsonLayer = L.geoJSON(countyFC, {
    style: feature => ({
      fillColor:   colorScale(countyScores[feature.id] || 0),
      fillOpacity: 0.45,
      color:       'rgba(255,255,255,0.35)',
      weight:      0.8,
    }),
    onEachFeature: (feature, layer) => {
      layer.on({
        mousemove: e  => _countyTooltipHandler(e.originalEvent, feature),
        mouseout:  () => hideCountyTooltip(),
      });
    },
  }).addTo(_leafletMap);

  _leafletMap.fitBounds(_countyGeoJsonLayer.getBounds(), { padding: [10, 10] });

  // Generator markers
  _generatorLayerGroup = L.layerGroup().addTo(_leafletMap);
  if (generators && generators.length > 0) {
    const largeGens = generators
      .filter(g => +(g['nameplate-capacity-mw'] || 0) >= 10 && +g.latitude && +g.longitude)
      .slice(0, 300);
    for (const g of largeGens) {
      const mw = +(g['nameplate-capacity-mw'] || 0);
      const color = fuelColor(g['energy-source-code']);
      const mk = L.circleMarker([+g.latitude, +g.longitude], {
        radius: Math.max(3, Math.sqrt(mw / 100)),
        fillColor: color, color, weight: 0.8, fillOpacity: 0.7,
      });
      mk.on('mousemove', e => showCountyTooltip(e.originalEvent, `
        <div class="tt-title">${g['plant-name'] || 'Unknown Plant'}</div>
        <div class="tt-row"><span>Capacity</span><strong>${Math.round(mw)} MW</strong></div>
        <div class="tt-row"><span>Fuel</span><strong>${fuelLabel(g['energy-source-code'])}</strong></div>
        <div class="tt-row"><span>County</span><strong>${g.county || '—'}</strong></div>
      `));
      mk.on('mouseout', hideCountyTooltip);
      _generatorLayerGroup.addLayer(mk);
    }
  }

  document.getElementById('county-loading').style.display = 'none';
  renderCountyLegend(colorScale, 'Gen Score');
  renderFuelLegend();

  document.querySelectorAll('.county-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === 'generators');
    btn.onclick = () => setCountyMapMode(btn.dataset.mode);
  });

  return stateBbox;
}

function showCountyTooltip(event, html) {
  const tt = document.getElementById('county-tooltip');
  tt.innerHTML = html;
  tt.classList.remove('hidden');
  positionTooltip(tt, event);
}

function hideCountyTooltip() {
  document.getElementById('county-tooltip').classList.add('hidden');
}

// Mode-aware county tooltip
function _countyTooltipHandler(event, f) {
  if (_countyMapMode === 'util' && _countyTxData) {
    const tx   = _countyTxData[f.id] || { estimatedMW: 0, miles: 0 };
    const pct  = _countyUtilData[f.id];
    const mw   = tx.estimatedMW >= 1000
      ? `${(tx.estimatedMW / 1000).toFixed(1)} GW`
      : `${tx.estimatedMW.toLocaleString()} MW`;
    const utilStr = pct != null ? `${pct}%` : 'No TX data';
    const html = `
      <div class="tt-title">${_countyNames[f.id] || f.id}</div>
      <div class="tt-row"><span>TX Utilization</span><strong>${utilStr}</strong></div>
      <div class="tt-row"><span>TX Capacity</span><strong>${mw}</strong></div>
      <div class="tt-row"><span>Line Miles</span><strong>${Math.round(tx.miles).toLocaleString()} mi</strong></div>
      <div class="tt-note" style="margin-top:5px;font-size:10px">Utilization = estimated local demand ÷ TX capacity</div>
    `;
    showCountyTooltip(event, html);
  } else if (_countyMapMode === 'tx' && _countyTxData) {
    const tx = _countyTxData[f.id] || { estimatedMW: 0, miles: 0, lineCount: 0 };
    const mw = tx.estimatedMW >= 1000
      ? `${(tx.estimatedMW / 1000).toFixed(1)} GW`
      : `${tx.estimatedMW.toLocaleString()} MW`;
    const html = `
      <div class="tt-title">${_countyNames[f.id] || f.id}</div>
      <div class="tt-row"><span>TX Capacity</span><strong>${mw}</strong></div>
      <div class="tt-row"><span>Line Miles</span><strong>${Math.round(tx.miles).toLocaleString()} mi</strong></div>
      <div class="tt-row"><span>Line Segments</span><strong>${tx.lineCount}</strong></div>
    `;
    showCountyTooltip(event, html);
  } else {
    const score = _countyScoresRaw[f.id] || 0;
    const gens  = (_countyGenListsRaw[f.id] || []).slice(0, 5);
    const genStr = gens.length
      ? gens.map(g => `<li>${g['plant-name'] || '—'} (${Math.round(+(g['nameplate-capacity-mw']||0))} MW, ${fuelLabel(g['energy-source-code'])})</li>`).join('')
      : '<li>No generators within 25 km</li>';
    const html = `
      <div class="tt-title">${_countyNames[f.id] || f.id}</div>
      <div class="tt-row"><span>Infra Score</span><strong>${score.toFixed(0)}/100</strong></div>
      <div class="tt-subhead">Nearby generators:</div>
      <ul class="tt-list">${genStr}</ul>
    `;
    showCountyTooltip(event, html);
  }
}

function setCountyMapMode(mode) {
  if (!_countyGeoJsonLayer) return;
  _countyMapMode = mode;

  document.querySelectorAll('.county-mode-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.mode === mode)
  );

  if (mode === 'tx' && _countyTxData) {
    _applyTxColoring();
  } else if (mode === 'util' && _countyTxData) {
    _applyUtilColoring();
  } else {
    if (!_countyColorScale) return;
    _countyGeoJsonLayer.setStyle(feature => ({
      fillColor: _countyColorScale(_countyScoresRaw[feature.id] || 0),
      fillOpacity: 0.45, color: 'rgba(255,255,255,0.35)', weight: 0.8,
    }));
    renderCountyLegend(_countyColorScale, 'Gen Score');
  }
}

function _applyTxColoring() {
  if (!_countyGeoJsonLayer || !_countyTxData) return;
  const vals  = Object.values(_countyTxData).map(d => d.estimatedMW).filter(v => v > 0);
  const maxMW = vals.length ? Math.max(...vals) : 1;
  const txScale = d3.scaleSequential()
    .domain([0, maxMW])
    .interpolator(d3.interpolateRgb('#1e3a5f', '#f59e0b'));

  _countyGeoJsonLayer.setStyle(feature => ({
    fillColor:   (_countyTxData[feature.id]?.estimatedMW || 0) > 0
                 ? txScale(_countyTxData[feature.id].estimatedMW) : '#1e3a5f',
    fillOpacity: 0.55, color: 'rgba(255,255,255,0.35)', weight: 0.8,
  }));
  renderCountyLegend(txScale, 'TX Capacity', maxMW);
}

// Called from app.js after transmission data loads
function updateCountyTxCapacity(byCounty, peakGW) {
  _countyTxData = byCounty;
  _countyStatePeakMW = (peakGW || 0) * 1000;
  // Enable TX and Utilization toggle buttons now that data is available
  document.querySelectorAll('.county-mode-btn[data-mode="tx"], .county-mode-btn[data-mode="util"]').forEach(btn => {
    btn.disabled = false;
    btn.title = '';
  });
  if (_countyMapMode === 'tx')   _applyTxColoring();
  if (_countyMapMode === 'util') _applyUtilColoring();
}

function _applyUtilColoring() {
  if (!_countyGeoJsonLayer || !_countyTxData) return;

  const totalGenMW = Object.values(_countyGenMWRaw).reduce((s, v) => s + v, 0);
  const utilByCounty = {};
  for (const id in _countyTxData) {
    const txMW = _countyTxData[id]?.estimatedMW || 0;
    if (txMW === 0) { utilByCounty[id] = null; continue; }
    const genMW = _countyGenMWRaw[id] || 0;
    const demandProxy = totalGenMW > 0 ? _countyStatePeakMW * (genMW / totalGenMW) : 0;
    utilByCounty[id] = Math.min(99, Math.round(demandProxy / txMW * 100));
  }

  const utilScale = d3.scaleSequential()
    .domain([0, 80])
    .interpolator(d3.interpolateRgb('#1e4620', '#ef4444'))
    .clamp(true);

  _countyGeoJsonLayer.setStyle(feature => ({
    fillColor:   utilByCounty[feature.id] != null ? utilScale(utilByCounty[feature.id]) : '#1e3a5f',
    fillOpacity: 0.55, color: 'rgba(255,255,255,0.35)', weight: 0.8,
  }));

  const el = document.getElementById('county-legend');
  if (el) {
    const steps = 5;
    let html = '<span class="cl-label">0%</span>';
    for (let i = 0; i <= steps; i++)
      html += `<span class="cl-swatch" style="background:${utilScale(i / steps * 80)}"></span>`;
    html += '<span class="cl-label">80%+</span> <span class="cl-title">TX Util</span>';
    el.innerHTML = html;
  }
  _countyUtilData = utilByCounty;
}

function renderCountyLegend(colorScale, title, maxVal) {
  const el = document.getElementById('county-legend');
  if (!el) return;
  const steps = 5;
  let html = '<span class="cl-label">Low</span>';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const val = maxVal != null ? t * maxVal : t * 100;
    html += `<span class="cl-swatch" style="background:${colorScale(val)}"></span>`;
  }
  html += `<span class="cl-label">High</span> <span class="cl-title">${title || 'Score'}</span>`;
  el.innerHTML = html;
}

function renderFuelLegend() {
  const el = document.getElementById('fuel-legend');
  if (!el) return;
  const fuels = [
    ['gas','Natural Gas'],['nuclear','Nuclear'],['solar','Solar'],['wind','Wind'],
    ['coal','Coal'],['hydro','Hydro'],['battery','Battery'],['other','Other'],
  ];
  el.innerHTML = fuels.map(([k, label]) =>
    `<span class="fl-item"><span class="fl-dot" style="background:${FUEL_COLORS[k]}"></span>${label}</span>`
  ).join('');
}

// ── Transmission layer (added after county map renders) ───────────────────────

let _leafletMap          = null;  // Leaflet map instance
let _countyGeoJsonLayer  = null;  // Leaflet GeoJSON layer (choropleth)
let _generatorLayerGroup = null;  // Leaflet LayerGroup for generator dots
let _txLayersByClass     = {};    // { cls: L.layerGroup() } for TX lines
let _txSubLayersByClass  = {};    // { cls: L.layerGroup() } for substations
let _countyFeatures    = [];     // GeoJSON feature array for current state
let _countyNames       = {};     // fips → name
let _countyScoresRaw   = {};     // fips → normalized generator score 0-100
let _countyGenListsRaw = {};     // fips → generator array
let _countyTxData      = null;   // fips → { estimatedMW, miles, lineCount }
let _countyColorScale  = null;   // current d3 color scale
let _countyMapMode     = 'generators';
let _countyGenMWRaw    = {};
let _countyStatePeakMW = 0;
let _countyUtilData    = {};

// Called by app.js after fetchStateTransmission resolves
function addTransmissionToCountyMap(lines, substations) {
  if (!_leafletMap) return;

  // Clear existing TX layers
  for (const cls of TX_CLASSES) {
    if (_txLayersByClass[cls])    _leafletMap.removeLayer(_txLayersByClass[cls]);
    if (_txSubLayersByClass[cls]) _leafletMap.removeLayer(_txSubLayersByClass[cls]);
  }
  _txLayersByClass = {}; _txSubLayersByClass = {};
  for (const cls of TX_CLASSES) {
    _txLayersByClass[cls]    = L.layerGroup();
    _txSubLayersByClass[cls] = L.layerGroup();
  }

  // Transmission lines
  for (const f of (lines.features || [])) {
    if (!f.geometry) continue;
    const cls   = voltageClass(f.properties?.voltage);
    const color = TX_COLORS[cls];
    const weight = TX_WIDTHS[cls] * 1.6;
    const rings = f.geometry.type === 'MultiLineString'
      ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const ring of rings) {
      const pl = L.polyline(ring.map(([lon, lat]) => [lat, lon]),
        { color, weight, opacity: 0.9, interactive: true });
      pl.on('mousemove', e => showCountyTooltip(e.originalEvent, `
        <div class="tt-title">Transmission Line</div>
        <div class="tt-row"><span>Voltage</span><strong>${voltageLabel(f.properties?.voltage)}</strong></div>
        <div class="tt-row"><span>Operator</span><strong>${f.properties?.operator || 'Unknown'}</strong></div>
        <div class="tt-row"><span>Circuits</span><strong>${f.properties?.circuits || '1'}</strong></div>
      `));
      pl.on('mouseout', hideCountyTooltip);
      _txLayersByClass[cls].addLayer(pl);
    }
  }

  // Substations
  for (const f of (substations.features || []).filter(d => d.geometry?.coordinates?.length)) {
    const cls   = voltageClass(f.properties?.voltage);
    const color = TX_COLORS[cls];
    const [lon, lat] = f.geometry.coordinates;
    const mk = L.circleMarker([lat, lon],
      { radius: 5, fillColor: color, color, weight: 1.5, fillOpacity: 0.65 });
    mk.on('mousemove', e => showCountyTooltip(e.originalEvent, `
      <div class="tt-title">${f.properties?.name || 'Substation'}</div>
      <div class="tt-row"><span>Voltage</span><strong>${voltageLabel(f.properties?.voltage)}</strong></div>
    `));
    mk.on('mouseout', hideCountyTooltip);
    _txSubLayersByClass[cls].addLayer(mk);
  }

  // Add groups to map respecting active filter state
  for (const cls of TX_CLASSES) {
    if (typeof _txActive !== 'undefined' && _txActive.has(cls)) {
      _leafletMap.addLayer(_txLayersByClass[cls]);
      _leafletMap.addLayer(_txSubLayersByClass[cls]);
    }
  }

  renderTransmissionLegend();
}

function renderTransmissionLegend() {
  const el = document.getElementById('fuel-legend');
  if (!el) return;
  const fuels = [
    ['gas','Natural Gas'],['nuclear','Nuclear'],['solar','Solar'],['wind','Wind'],
    ['coal','Coal'],['hydro','Hydro'],['battery','Battery'],['other','Other'],
  ];
  const fuelHtml = fuels.map(([k, label]) =>
    `<span class="fl-item"><span class="fl-dot" style="background:${FUEL_COLORS[k]}"></span>${label}</span>`
  ).join('');
  const txHtml = [
    ['110','110 kV'],['150','150 kV'],['230','230 kV'],['345','345 kV'],['500','500+ kV'],
  ].map(([cls, l]) =>
    `<span class="fl-item"><span class="fl-line" style="background:${TX_COLORS[cls]}"></span>${l}</span>`
  ).join('');
  el.innerHTML = fuelHtml +
    `<span class="fl-sep">|</span>` +
    `<span class="fl-item fl-tx-label">Transmission:</span>` + txHtml;
}

// Redraw county map with new generator data (called after API returns)
function updateCountyMap(stateId, generators) {
  renderCountyMap(stateId, generators);
}
