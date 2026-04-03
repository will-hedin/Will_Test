// parcels.js — Clark County NV land parcel search near 345/500 kV transmission lines
//
// Data sources:
//   Transmission lines: HIFLD Open Data (same service used by transmission.js)
//   Parcels:            Clark County Assessor LandApp ArcGIS REST service
//   Owner detail:       Clark County Assessor portal (per-parcel deep link)

const CLARK_PARCELS_URL   = 'https://maps.clarkcountynv.gov/arcgis/rest/services/Assessor/LandApp/MapServer/0/query';
const CLARK_ASSESSOR_BASE = 'https://maps.clarkcountynv.gov/assessor/AssessorParcelDetail/pcl.aspx?parcel=';

// Clark County NV bounding box [xmin, ymin, xmax, ymax]
const CLARK_BBOX = [-116.1, 35.0, -113.9, 37.3];

// 1 mile expressed in degrees at ~lat 36°N
const MILE_KM      = 1.60934;
const MILE_DEG_LAT = 0.01446;
const MILE_DEG_LON = 0.01787;

let _parcelsLoaded = false;

// ── Entry point ───────────────────────────────────────────────────────────────

async function initParcelsView() {
  if (_parcelsLoaded) return;
  _parcelsLoaded = true;

  const statusEl = document.getElementById('parcels-status');
  const countEl  = document.getElementById('parcels-count');

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }
  function clearStatus()  { if (statusEl) statusEl.textContent = ''; }

  try {
    setStatus('Loading 345/500 kV transmission lines for Clark County…');
    const lines = await fetchClarkLines();

    if (!lines.length) {
      setStatus('No 345/500 kV lines found in Clark County.');
      return;
    }

    setStatus(`Found ${lines.length} line segments. Querying parcels ≥100 acres…`);
    const lineBbox  = computeLineBbox(lines);
    const candidates = await fetchClarkParcels(lineBbox);

    setStatus(`Checking ${candidates.length} candidates against 1-mile corridor…`);
    const qualifying = candidates.filter(f => {
      const c = polygonCentroid(f.geometry);
      return c && withinOneMile(c, lines);
    });

    clearStatus();

    if (countEl) {
      countEl.textContent =
        `${qualifying.length} parcel${qualifying.length !== 1 ? 's' : ''} ≥100 acres within 1 mile of 345/500 kV lines`;
    }

    renderParcelsMap(lines, qualifying);
    renderParcelsTable(qualifying);

  } catch (e) {
    _parcelsLoaded = false;  // allow retry on next tab click
    setStatus(`Error: ${e.message}`);
    console.error('Parcels view:', e);
  }
}

// ── HIFLD fetch (345 + 500 kV only, Clark County bbox) ───────────────────────

async function fetchClarkLines() {
  const [xmin, ymin, xmax, ymax] = CLARK_BBOX;
  const params = new URLSearchParams({
    where:             `VOLTAGE IN ('345','500','765')`,
    geometry:          JSON.stringify({ xmin, ymin, xmax, ymax }),
    geometryType:      'esriGeometryEnvelope',
    inSR:              '4326',
    spatialRel:        'esriSpatialRelIntersects',
    outFields:         'OBJECTID,OWNER,VOLTAGE',
    f:                 'geojson',
    returnGeometry:    'true',
    resultRecordCount: '2000',
  });
  const resp = await fetch(`${HIFLD_TX_URL}?${params}`);
  if (!resp.ok) throw new Error(`HIFLD ${resp.status}`);
  const json = await resp.json();
  return (json.features || []).filter(f =>
    f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'
  );
}

// ── Clark County parcel fetch ─────────────────────────────────────────────────

function computeLineBbox(lines) {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const f of lines) {
    const segs = f.geometry.type === 'MultiLineString'
      ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const seg of segs)
      for (const [lon, lat] of seg) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
  }
  return {
    xmin: minLon - MILE_DEG_LON,
    ymin: minLat - MILE_DEG_LAT,
    xmax: maxLon + MILE_DEG_LON,
    ymax: maxLat + MILE_DEG_LAT,
  };
}

async function fetchClarkParcels(bbox) {
  const params = new URLSearchParams({
    where:             'CALC_ACRES >= 100',
    geometry:          JSON.stringify(bbox),
    geometryType:      'esriGeometryEnvelope',
    inSR:              '4326',
    spatialRel:        'esriSpatialRelIntersects',
    outFields:         'APN,CALC_ACRES,ASSR_ACRES,status_cd',
    returnGeometry:    'true',
    f:                 'geojson',
    resultRecordCount: '2000',
  });
  const resp = await fetch(`${CLARK_PARCELS_URL}?${params}`);
  if (!resp.ok) throw new Error(`Clark County API ${resp.status}`);
  const json = await resp.json();
  if (json.error) throw new Error(json.error.message || 'Clark County API error');
  return json.features || [];
}

// ── Spatial helpers ───────────────────────────────────────────────────────────

// Returns [lon, lat] centroid for any geometry type.
// The Clark County LandApp layer returns Point centroids directly.
function polygonCentroid(geometry) {
  if (!geometry) return null;
  // Point — already a centroid
  if (geometry.type === 'Point') return geometry.coordinates;
  // Polygon / MultiPolygon — compute centroid from ring
  const ring = geometry.type === 'Polygon'
    ? geometry.coordinates[0]
    : geometry.type === 'MultiPolygon'
    ? geometry.coordinates[0][0]
    : null;
  if (!ring?.length) return null;
  let lon = 0, lat = 0;
  for (const [x, y] of ring) { lon += x; lat += y; }
  return [lon / ring.length, lat / ring.length];
}

function haversineKm2(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Minimum distance from point P to line segment A→B (planar approximation, fine for ~1 mile)
function ptSegKm(pLat, pLon, aLat, aLon, bLat, bLon) {
  const dx = bLon - aLon, dy = bLat - aLat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversineKm2(pLat, pLon, aLat, aLon);
  const t = Math.max(0, Math.min(1,
    ((pLon - aLon) * dx + (pLat - aLat) * dy) / lenSq
  ));
  return haversineKm2(pLat, pLon, aLat + t * dy, aLon + t * dx);
}

function withinOneMile([pLon, pLat], lines) {
  for (const f of lines) {
    const segs = f.geometry.type === 'MultiLineString'
      ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const seg of segs)
      for (let i = 1; i < seg.length; i++) {
        const d = ptSegKm(pLat, pLon,
          seg[i-1][1], seg[i-1][0], seg[i][1], seg[i][0]);
        if (d <= MILE_KM) return true;
      }
  }
  return false;
}

// ── D3 map ────────────────────────────────────────────────────────────────────

async function renderParcelsMap(lines, parcels) {
  const wrapper = document.getElementById('parcels-map-wrapper');
  const svg     = d3.select('#parcels-map');
  if (!wrapper || svg.empty()) return;

  svg.selectAll('*').remove();
  const W = wrapper.clientWidth  || 640;
  const H = wrapper.clientHeight || 480;
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');

  // Load counties TopoJSON (share cache with map.js if available)
  let topo = typeof _countiesTopojson !== 'undefined' ? _countiesTopojson : null;
  if (!topo) topo = await d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json');

  const countiesGeo = topojson.feature(topo, topo.objects.counties);
  // Clark County NV FIPS = 32003
  const clarkFeature = countiesGeo.features.find(f => +f.id === 32003);
  if (!clarkFeature) return;

  const countyFC = { type: 'FeatureCollection', features: [clarkFeature] };
  const projection = d3.geoMercator().fitExtent([[20, 20], [W - 20, H - 20]], countyFC);
  const path = d3.geoPath().projection(projection);
  const g = svg.append('g');

  // County fill
  g.append('path')
    .datum(clarkFeature)
    .attr('d', path)
    .attr('fill', '#1e3a5f')
    .attr('stroke', 'rgba(255,255,255,0.3)')
    .attr('stroke-width', 1);

  // Qualifying parcels — draw as circles (API returns centroids, not polygons)
  if (parcels.length) {
    g.selectAll('circle.parcel')
      .data(parcels)
      .enter().append('circle')
      .attr('class', 'parcel')
      .attr('cx', f => {
        const c = polygonCentroid(f.geometry);
        const pt = c ? projection(c) : null;
        return pt ? pt[0] : -999;
      })
      .attr('cy', f => {
        const c = polygonCentroid(f.geometry);
        const pt = c ? projection(c) : null;
        return pt ? pt[1] : -999;
      })
      .attr('r', f => {
        // Scale dot size loosely by acreage
        const ac = f.properties?.CALC_ACRES || 100;
        return Math.max(4, Math.min(12, Math.sqrt(ac / 20)));
      })
      .attr('fill', '#f59e0b99')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 1.2);
  }

  // Transmission lines
  const lineFC = { type: 'FeatureCollection', features: lines };
  const voltageColors = { '345': '#f59e0b', '500': '#f97316', '765': '#f97316' };
  g.selectAll('path.tx-clark')
    .data(lines)
    .enter().append('path')
    .attr('class', 'tx-clark')
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', d => voltageColors[d.properties?.VOLTAGE] || '#f59e0b')
    .attr('stroke-width', 2)
    .attr('stroke-linecap', 'round')
    .attr('opacity', 0.95);

  // Map legend
  const leg = g.append('g').attr('transform', `translate(12,${H - 64})`);
  [['#f59e0b', '345 kV line'], ['#f97316', '500+ kV line']].forEach(([color, label], i) => {
    const y = i * 18;
    leg.append('rect').attr('x', 0).attr('y', y).attr('width', 18).attr('height', 4).attr('y', y + 4)
      .attr('fill', color);
    leg.append('text').attr('x', 24).attr('y', y + 9)
      .attr('fill', 'rgba(255,255,255,0.85)').attr('font-size', 11).text(label);
  });
  // Parcel dot legend entry
  leg.append('circle').attr('cx', 9).attr('cy', 44).attr('r', 5)
    .attr('fill', '#f59e0b99').attr('stroke', '#f59e0b').attr('stroke-width', 1.2);
  leg.append('text').attr('x', 24).attr('y', 48)
    .attr('fill', 'rgba(255,255,255,0.85)').attr('font-size', 11).text('≥100 ac parcel');
}

// ── Results table ─────────────────────────────────────────────────────────────

function renderParcelsTable(parcels) {
  const tbody = document.getElementById('parcels-tbody');
  const panel = document.getElementById('parcels-table-panel');
  if (!tbody) return;

  if (!parcels.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">No qualifying parcels found.</td></tr>';
    if (panel) panel.style.display = '';
    return;
  }

  // Sort by acreage descending
  const sorted = [...parcels].sort((a, b) =>
    (b.properties?.CALC_ACRES || 0) - (a.properties?.CALC_ACRES || 0)
  );

  tbody.innerHTML = sorted.map(f => {
    const p      = f.properties || {};
    const apn    = p.APN || '—';
    const acres  = p.CALC_ACRES != null ? (+p.CALC_ACRES).toFixed(1) : (p.ASSR_ACRES != null ? (+p.ASSR_ACRES).toFixed(1) : '—');
    const status = p.status_cd || '—';
    // Clark County APN: 11-digit string → formatted XXX-XX-XXX-XXX for portal
    const apnRaw = apn.replace(/[-\s]/g, '');
    const apnFmt = apnRaw.length === 11
      ? `${apnRaw.slice(0,3)}-${apnRaw.slice(3,5)}-${apnRaw.slice(5,8)}-${apnRaw.slice(8,11)}`
      : apnRaw;
    const link = apnFmt.length > 3
      ? `<a href="${CLARK_ASSESSOR_BASE}${apnFmt}" target="_blank" rel="noopener" class="assessor-link">View Owner →</a>`
      : '—';
    return `<tr>
      <td class="mono">${apnFmt}</td>
      <td class="num">${acres}</td>
      <td>${status}</td>
      <td>${link}</td>
    </tr>`;
  }).join('');

  if (panel) panel.style.display = '';
}
