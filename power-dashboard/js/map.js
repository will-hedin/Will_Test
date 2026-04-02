// map.js — D3 choropleth US map + state-level county map with generator overlay

const TOPO_STATES   = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
const TOPO_COUNTIES = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json';

let _usTopojson       = null;
let _countiesTopojson = null;
let _usProjection     = null;
let _usPath           = null;
let _statePaths       = null;   // d3 selection of state <path> elements
let _currentView      = 'score';

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

  _usProjection = d3.geoAlbersUsa().scale(w * 1.2).translate([w / 2, h / 2]);
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

  // Handle resize
  const ro = new ResizeObserver(() => {
    const { w: nw, h: nh } = getSize();
    svg.attr('viewBox', `0 0 ${nw} ${nh}`).attr('width', nw).attr('height', nh);
    _usProjection.scale(nw * 1.2).translate([nw / 2, nh / 2]);
    _usPath = d3.geoPath().projection(_usProjection);
    svg.selectAll('path.state').attr('d', _usPath);
    svg.selectAll('path.state-border').attr('d', _usPath);
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
  const stateInfo = STATE_DATA[stateId];
  const stateFipsInt = parseInt(stateInfo.fips);

  // Load counties TopoJSON (cached after first load)
  if (!_countiesTopojson) {
    _countiesTopojson = await d3.json(TOPO_COUNTIES);
  }

  const countiesGeo = topojson.feature(_countiesTopojson, _countiesTopojson.objects.counties);
  const stateCounties = countiesGeo.features.filter(f =>
    Math.floor(+f.id / 1000) === stateFipsInt
  );

  if (stateCounties.length === 0) {
    document.getElementById('county-loading').textContent = 'No county data found for this state.';
    return;
  }

  // County name lookup from properties
  const countyNames = {};
  for (const f of stateCounties) {
    countyNames[f.id] = f.properties?.name || `County ${f.id}`;
  }

  // Compute county infrastructure scores from generators
  const countyScores   = {};
  const countyGenLists = {};

  if (generators && generators.length > 0) {
    const centroids = {};
    for (const f of stateCounties) {
      centroids[f.id] = d3.geoCentroid(f); // [lon, lat]
    }

    for (const f of stateCounties) {
      const [clon, clat] = centroids[f.id];
      let totalMW = 0;
      const genList = [];
      for (const g of generators) {
        const lat = +g.latitude;
        const lon = +g.longitude;
        if (!lat || !lon) continue;
        const dist = haversineKm(clat, clon, lat, lon);
        if (dist <= 25) {
          const mw = +(g['nameplate-capacity-mw'] || 0);
          totalMW += mw;
          if (mw >= 10) genList.push(g);
        }
      }
      countyScores[f.id] = totalMW;
      countyGenLists[f.id] = genList;
    }

    // Normalize 0–100
    const maxScore = Math.max(1, ...Object.values(countyScores));
    for (const k in countyScores) {
      countyScores[k] = (countyScores[k] / maxScore) * 100;
    }
  }

  // Color scale: teal ramp
  const colorScale = d3.scaleSequential()
    .domain([0, 100])
    .interpolator(d3.interpolateRgb('#E1F5EE', '#085041'));

  // Setup SVG
  const wrapper = document.getElementById('county-map-wrapper');
  const svg = d3.select('#county-map');
  svg.selectAll('*').remove();

  const W = wrapper.clientWidth  || 640;
  const H = wrapper.clientHeight || 480;
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');

  const countyFC = { type: 'FeatureCollection', features: stateCounties };
  const bounds   = d3.geoBounds(countyFC);
  // bbox = [minLon, minLat, maxLon, maxLat]
  const stateBbox = [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]];

  const projection = d3.geoMercator().fitExtent([[20, 20], [W - 20, H - 20]], countyFC);
  const path = d3.geoPath().projection(projection);

  // Store for transmission layer additions
  _countyProjection = projection;

  const g = svg.append('g');

  // Draw counties
  g.selectAll('path.county')
    .data(stateCounties)
    .enter().append('path')
    .attr('class', 'county')
    .attr('d', path)
    .attr('fill', f => {
      const score = countyScores[f.id];
      return score != null ? colorScale(score) : '#e5e7eb';
    })
    .attr('stroke', 'var(--county-border)')
    .attr('stroke-width', 0.5)
    .on('mousemove', (event, f) => {
      const score = countyScores[f.id] || 0;
      const gens  = (countyGenLists[f.id] || []).slice(0, 5);
      const genStr = gens.length
        ? gens.map(g => `<li>${g['plant-name'] || '—'} (${Math.round(+(g['nameplate-capacity-mw']||0))} MW, ${fuelLabel(g['energy-source-code'])})</li>`).join('')
        : '<li>No generators within 25 km</li>';
      const html = `
        <div class="tt-title">${countyNames[f.id] || f.id}</div>
        <div class="tt-row"><span>Infra Score</span><strong>${score.toFixed(0)}/100</strong></div>
        <div class="tt-subhead">Nearby generators:</div>
        <ul class="tt-list">${genStr}</ul>
      `;
      showCountyTooltip(event, html);
    })
    .on('mouseleave', hideCountyTooltip);

  // County borders mesh
  g.append('path')
    .datum(topojson.mesh(_countiesTopojson, _countiesTopojson.objects.counties,
      (a, b) => a !== b && Math.floor(+a.id / 1000) === stateFipsInt && Math.floor(+b.id / 1000) === stateFipsInt))
    .attr('class', 'county-border')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', 'var(--county-border)')
    .attr('stroke-width', 0.5);

  // Store G for post-render transmission layer injection
  _countyG = g;

  // ── Generator overlay ────────────────────────────────────────────────────────
  if (generators && generators.length > 0) {
    const largeGens = generators.filter(g =>
      +(g['nameplate-capacity-mw'] || 0) >= 10 && +g.latitude && +g.longitude
    );

    const genGroup = g.append('g').attr('class', 'generators');  // transmission is inserted before this
    const tt = document.getElementById('county-tooltip');

    genGroup.selectAll('circle.gen')
      .data(largeGens)
      .enter().append('circle')
      .attr('class', 'gen')
      .attr('cx', d => {
        const pt = projection([+d.longitude, +d.latitude]);
        return pt ? pt[0] : null;
      })
      .attr('cy', d => {
        const pt = projection([+d.longitude, +d.latitude]);
        return pt ? pt[1] : null;
      })
      .attr('r', d => Math.max(3, Math.sqrt(+(d['nameplate-capacity-mw'] || 0) / 100)))
      .attr('fill', d => fuelColor(d['energy-source-code']) + 'aa')
      .attr('stroke', d => fuelColor(d['energy-source-code']))
      .attr('stroke-width', 0.8)
      .style('pointer-events', 'all')
      .on('mousemove', (event, d) => {
        const html = `
          <div class="tt-title">${d['plant-name'] || 'Unknown Plant'}</div>
          <div class="tt-row"><span>Capacity</span><strong>${Math.round(+(d['nameplate-capacity-mw']||0))} MW</strong></div>
          <div class="tt-row"><span>Fuel</span><strong>${fuelLabel(d['energy-source-code'])}</strong></div>
          <div class="tt-row"><span>County</span><strong>${d.county || '—'}</strong></div>
        `;
        showCountyTooltip(event, html);
        event.stopPropagation();
      })
      .on('mouseleave', hideCountyTooltip);
  }

  // Hide loading spinner
  document.getElementById('county-loading').style.display = 'none';

  // Render county legend
  renderCountyLegend(colorScale);
  renderFuelLegend();

  return stateBbox; // caller uses this for Overpass bbox query
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

function renderCountyLegend(colorScale) {
  const el = document.getElementById('county-legend');
  if (!el) return;
  const steps = 5;
  let html = '<span class="cl-label">Low</span>';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    html += `<span class="cl-swatch" style="background:${colorScale(t * 100)}"></span>`;
  }
  html += '<span class="cl-label">High</span> <span class="cl-title">Infra Score</span>';
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

let _countyProjection = null;
let _countyG          = null;

// Called by app.js after fetchStateTransmission resolves
function addTransmissionToCountyMap(lines, substations) {
  if (!_countyG || !_countyProjection) return;
  _countyG.selectAll('.tx-layer').remove();

  // Insert below generators so plants remain on top
  const txG = _countyG.insert('g', '.generators').attr('class', 'tx-layer');

  // Draw lines
  const path = d3.geoPath().projection(_countyProjection);
  txG.selectAll('path.tx-line')
    .data(lines.features || [])
    .enter().append('path')
    .attr('class', 'tx-line')
    .attr('data-kv', d => voltageClass(d.properties?.voltage))
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', d => txColor(d.properties?.voltage))
    .attr('stroke-width', d => txWidth(d.properties?.voltage))
    .attr('stroke-linecap', 'round')
    .attr('opacity', 0.9)
    .on('mousemove', (event, d) => {
      const html = `
        <div class="tt-title">Transmission Line</div>
        <div class="tt-row"><span>Voltage</span><strong>${voltageLabel(d.properties?.voltage)}</strong></div>
        <div class="tt-row"><span>Operator</span><strong>${d.properties?.operator || 'Unknown'}</strong></div>
        <div class="tt-row"><span>Circuits</span><strong>${d.properties?.circuits || '1'}</strong></div>
        <div class="tt-note" style="margin-top:6px;font-size:10px">Source: OpenStreetMap via OpenInfraMap</div>
      `;
      showCountyTooltip(event, html);
      event.stopPropagation();
    })
    .on('mouseleave', hideCountyTooltip);

  // Draw substations
  const validSubs = (substations.features || []).filter(d => d.geometry?.coordinates?.length);
  txG.selectAll('circle.tx-sub')
    .data(validSubs)
    .enter().append('circle')
    .attr('class', 'tx-sub')
    .attr('data-kv', d => voltageClass(d.properties?.voltage))
    .attr('cx', d => { const p = _countyProjection(d.geometry.coordinates); return p ? p[0] : -999; })
    .attr('cy', d => { const p = _countyProjection(d.geometry.coordinates); return p ? p[1] : -999; })
    .attr('r', 5)
    .attr('fill', d => txColor(d.properties?.voltage) + '99')
    .attr('stroke', d => txColor(d.properties?.voltage))
    .attr('stroke-width', 1.5)
    .on('mousemove', (event, d) => {
      const html = `
        <div class="tt-title">${d.properties?.name || 'Substation'}</div>
        <div class="tt-row"><span>Voltage</span><strong>${voltageLabel(d.properties?.voltage)}</strong></div>
        <div class="tt-note" style="margin-top:6px;font-size:10px">Source: OpenStreetMap via OpenInfraMap</div>
      `;
      showCountyTooltip(event, html);
      event.stopPropagation();
    })
    .on('mouseleave', hideCountyTooltip);

  // Update fuel legend to also show transmission classes
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
