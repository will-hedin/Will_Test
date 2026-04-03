// transmission.js — multi-source transmission infrastructure layer
//
// Sources:
//   1. OpenStreetMap via Overpass API  (openinframap.org uses the same data)
//   2. HIFLD Open Data (DHS/CISA)      https://hifld-geoplatform.hub.arcgis.com
//
// Both are fetched in parallel and merged. Each feature carries a `source`
// property ('osm' | 'hifld') for tooltip attribution.

const OVERPASS_URL  = 'https://overpass-api.de/api/interpreter';
const HIFLD_TX_URL  = 'https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Power_Transmission_Lines/FeatureServer/0/query';
const HIFLD_SUB_URL = 'https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Substations/FeatureServer/0/query';

// ── Voltage classification ────────────────────────────────────────────────────
// Five user-facing filter buckets mapping to real voltage classes:
//   '110'  →  110 / 115 / 138 kV   (sub-transmission backbone)
//   '150'  →  150 / 161 kV         (regional transmission)
//   '230'  →  230 kV               (bulk transmission)
//   '345'  →  345 kV               (high-voltage bulk)
//   '500'  →  500 / 765 kV         (extra/ultra-high voltage)

const TX_CLASSES = ['110', '150', '230', '345', '500'];

const TX_COLORS = {
  '110': '#94a3b8',  // slate
  '150': '#60a5fa',  // blue
  '230': '#22d3ee',  // cyan
  '345': '#f59e0b',  // amber
  '500': '#f97316',  // orange
};
const TX_WIDTHS = { '110': 0.8, '150': 1.0, '230': 1.2, '345': 1.6, '500': 2.0 };

// Default on: 230 kV and above (110/150 kV are very numerous; user enables selectively)
const TX_DEFAULT_ON = new Set(['230', '345', '500']);

// Normalise an OSM or HIFLD voltage string to kV (numeric)
// OSM stores volts ("345000") or kV ("345") or compound ("345000;138000")
// HIFLD stores kV as a plain string ("345")
function _maxKv(tag) {
  if (!tag) return 0;
  const nums = String(tag).split(';').map(v => parseInt(v)).filter(n => !isNaN(n) && n > 0);
  if (!nums.length) return 0;
  const max = Math.max(...nums);
  return max > 1000 ? max / 1000 : max;
}

function voltageClass(tag) {
  const kv = _maxKv(tag);
  if (kv >= 450) return '500';
  if (kv >= 300) return '345';
  if (kv >= 195) return '230';
  if (kv >= 140) return '150';
  return '110';
}

function voltageLabel(tag) {
  const kv = _maxKv(tag);
  return kv ? `${Math.round(kv)} kV` : 'Unknown kV';
}

function txColor(tag) { return TX_COLORS[voltageClass(tag)] || TX_COLORS['110']; }
function txWidth(tag) { return TX_WIDTHS[voltageClass(tag)] || TX_WIDTHS['110']; }

// ── Overpass (OSM) ────────────────────────────────────────────────────────────

function buildOverpassQuery(bbox) {
  const [w, s, e, n] = bbox;
  const area    = `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  const voltRe  = '110|115|138|150|161|230|345|500|765';
  return `[out:json][timeout:60];
(
  way["power"="line"]["voltage"~"${voltRe}"]${area};
  node["power"="substation"]["voltage"~"${voltRe}"]${area};
  way["power"="substation"]["voltage"~"${voltRe}"]${area};
);
out center geom;`;
}

async function fetchOSM(bbox) {
  const resp = await fetchWithTimeout(OVERPASS_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `data=${encodeURIComponent(buildOverpassQuery(bbox))}`,
  }, 30000);
  if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
  const json = await resp.json();
  if (json.remark?.toLowerCase().includes('exceeded'))
    throw new Error('Overpass timeout');

  const lines = [], subs = [];
  for (const el of (json.elements || [])) {
    const t = el.tags || {};
    if (t.power === 'line' && el.geometry?.length > 1) {
      lines.push({
        type: 'Feature', id: `osm-${el.id}`,
        properties: { voltage: t.voltage, operator: t.operator || t.name || '', circuits: t.circuits || '1', source: 'osm' },
        geometry: { type: 'LineString', coordinates: el.geometry.map(p => [p.lon, p.lat]) },
      });
    } else if (t.power === 'substation') {
      let lon, lat;
      if (el.type === 'node')  { lon = el.lon; lat = el.lat; }
      else if (el.center)      { lon = el.center.lon; lat = el.center.lat; }
      if (lon != null) subs.push({
        type: 'Feature', id: `osm-${el.id}`,
        properties: { voltage: t.voltage, name: t.name || t.operator || '', source: 'osm' },
        geometry: { type: 'Point', coordinates: [lon, lat] },
      });
    }
  }
  return { lines, subs };
}

// ── HIFLD Open Data ───────────────────────────────────────────────────────────

function hifldBboxParam(bbox) {
  return JSON.stringify({ xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3] });
}

async function fetchHIFLDLines(bbox) {
  const params = new URLSearchParams({
    where:            `VOLTAGE IN ('110','115','138','150','161','230','345','500','765')`,
    geometry:         hifldBboxParam(bbox),
    geometryType:     'esriGeometryEnvelope',
    inSR:             '4326',
    spatialRel:       'esriSpatialRelIntersects',
    outFields:        'OBJECTID,OWNER,VOLTAGE',
    f:                'geojson',
    returnGeometry:   'true',
    resultRecordCount: '5000',
  });
  const resp = await fetch(`${HIFLD_TX_URL}?${params}`);
  if (!resp.ok) throw new Error(`HIFLD lines ${resp.status}`);
  const json = await resp.json();

  return (json.features || [])
    .filter(f => f.geometry && (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'))
    .map(f => ({
      type: 'Feature', id: `hifld-${f.properties?.OBJECTID}`,
      properties: {
        voltage:  String(f.properties?.VOLTAGE || ''),
        operator: f.properties?.OWNER || '',
        circuits: '1',
        source:   'hifld',
      },
      geometry: f.geometry,
    }));
}

async function fetchHIFLDSubstations(bbox) {
  const params = new URLSearchParams({
    where:            `MAX_VOLT >= 110`,
    geometry:         hifldBboxParam(bbox),
    geometryType:     'esriGeometryEnvelope',
    inSR:             '4326',
    spatialRel:       'esriSpatialRelIntersects',
    outFields:        'OBJECTID,NAME,OWNER,MAX_VOLT,TYPE',
    f:                'geojson',
    returnGeometry:   'true',
    resultRecordCount: '2000',
  });
  const resp = await fetch(`${HIFLD_SUB_URL}?${params}`);
  if (!resp.ok) throw new Error(`HIFLD subs ${resp.status}`);
  const json = await resp.json();

  return (json.features || [])
    .filter(f => f.geometry?.type === 'Point')
    .map(f => ({
      type: 'Feature', id: `hifld-sub-${f.properties?.OBJECTID}`,
      properties: {
        voltage: String(f.properties?.MAX_VOLT || ''),
        name:    f.properties?.NAME || f.properties?.OWNER || '',
        type:    f.properties?.TYPE || '',
        source:  'hifld',
      },
      geometry: f.geometry,
    }));
}

// ── Merge ─────────────────────────────────────────────────────────────────────
// Simple spatial deduplication: an HIFLD line is suppressed if a collinear OSM
// line already covers it (checked by comparing midpoint proximity < 500m).
// Substations: always show all; duplicates are unlikely to be confusing.

function _hkm(lat1, lon1, lat2, lon2) {
  const R = 6371, dL = (lat2-lat1)*Math.PI/180, dO = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dO/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function lineMidpoint(feature) {
  const coords = feature.geometry.type === 'MultiLineString'
    ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
  const mid = coords[Math.floor(coords.length / 2)];
  return mid ? [mid[1], mid[0]] : null;   // [lat, lon]
}

function deduplicateHIFLD(osmLines, hifldLines) {
  if (!osmLines.length) return hifldLines;

  // Build a rough grid of OSM midpoints for fast proximity checking
  const osmMids = osmLines.map(lineMidpoint).filter(Boolean);

  return hifldLines.filter(hf => {
    const hm = lineMidpoint(hf);
    if (!hm) return false;
    // Keep HIFLD line only if no OSM line midpoint is within 0.5 km
    return !osmMids.some(om => _hkm(hm[0], hm[1], om[0], om[1]) < 0.5);
  });
}

// ── Line-miles ────────────────────────────────────────────────────────────────

function computeLineMiles(features) {
  let km = 0;
  for (const f of features) {
    if (!f.geometry) continue;
    const segs = f.geometry.type === 'MultiLineString'
      ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const seg of segs)
      for (let i = 1; i < seg.length; i++)
        km += _hkm(seg[i-1][1], seg[i-1][0], seg[i][1], seg[i][0]);
  }
  return Math.round(km * 0.621371);
}

// ── Main fetch + cache ────────────────────────────────────────────────────────

const _txCache = {};

// Returns { lines: FeatureCollection, substations: FeatureCollection,
//           sources: { osm: bool, hifld: bool } }
async function fetchStateTransmission(stateId, bbox) {
  if (_txCache[stateId]) return _txCache[stateId];

  const [osmResult, hifldLines, hifldSubs] = await Promise.allSettled([
    fetchOSM(bbox),
    fetchHIFLDLines(bbox),
    fetchHIFLDSubstations(bbox),
  ]);

  const osmOk    = osmResult.status   === 'fulfilled';
  const hifldOk  = hifldLines.status  === 'fulfilled';
  const hSubsOk  = hifldSubs.status   === 'fulfilled';

  const osmLines = osmOk   ? osmResult.value.lines : [];
  const osmSubs  = osmOk   ? osmResult.value.subs  : [];
  const hLines   = hifldOk ? deduplicateHIFLD(osmLines, hifldLines.value) : [];
  const hSubs    = hSubsOk ? hifldSubs.value : [];

  if (!osmOk)   console.warn('Overpass fetch failed:', osmResult.reason?.message);
  if (!hifldOk) console.warn('HIFLD lines fetch failed:', hifldLines.reason?.message);
  if (!hSubsOk) console.warn('HIFLD subs fetch failed:', hifldSubs.reason?.message);

  const result = {
    lines:       { type: 'FeatureCollection', features: [...osmLines, ...hLines] },
    substations: { type: 'FeatureCollection', features: [...osmSubs,  ...hSubs]  },
    sources:     { osm: osmOk, hifld: hifldOk || hSubsOk },
    errors:      {
      osm:   osmOk   ? null : osmResult.reason?.message,
      hifld: hifldOk ? null : hifldLines.reason?.message,
    },
  };

  _txCache[stateId] = result;
  return result;
}

function clearTransmissionCache(stateId) {
  if (stateId) delete _txCache[stateId];
  else Object.keys(_txCache).forEach(k => delete _txCache[k]);
}

// ── Capacity estimation ────────────────────────────────────────────────────────

// Typical thermal capacity in MW per route-mile for each voltage class.
// Using line-miles avoids overcounting from OSM segment fragmentation
// (a single physical line split into 50 OSM ways would otherwise multiply SIL × 50).
// Values reflect representative US single-circuit thermal ratings per corridor-mile.
const TX_MW_PER_MILE = {
  '110': 0.8,    // 110–138 kV
  '150': 1.5,    // 150–161 kV
  '230': 2.5,    // 230 kV
  '345': 5.0,    // 345 kV
  '500': 10.0,   // 500+ kV (incl. 765 kV)
};

// Returns { byClass: { cls: { miles, lineCount, estimatedMW } }, totalMW }
// estimatedMW = miles × MW/mile — avoids inflation from OSM segment fragmentation.
function computeCapacityByClass(lines) {
  const stats = {};
  for (const cls of TX_CLASSES) {
    stats[cls] = { miles: 0, lineCount: 0, estimatedMW: 0 };
  }

  for (const f of (lines.features || [])) {
    const cls  = voltageClass(f.properties?.voltage);
    const segs = f.geometry?.type === 'MultiLineString'
      ? f.geometry.coordinates : [f.geometry.coordinates || []];
    let km = 0;
    for (const seg of segs)
      for (let i = 1; i < seg.length; i++)
        km += _hkm(seg[i-1][1], seg[i-1][0], seg[i][1], seg[i][0]);
    stats[cls].miles    += km * 0.621371;
    stats[cls].lineCount++;
  }

  let totalMW = 0;
  for (const cls of TX_CLASSES) {
    stats[cls].miles       = Math.round(stats[cls].miles);
    stats[cls].estimatedMW = Math.round(stats[cls].miles * TX_MW_PER_MILE[cls]);
    totalMW += stats[cls].estimatedMW;
  }

  return { byClass: stats, totalMW };
}

// Returns { byClass: { cls: count } } — substation count per voltage class
function computeSubstationsByClass(substations) {
  const counts = {};
  for (const cls of TX_CLASSES) counts[cls] = 0;

  for (const f of (substations.features || [])) {
    const cls = voltageClass(f.properties?.voltage);
    counts[cls]++;
  }
  return counts;
}

// Assign transmission lines to counties by midpoint, summing estimated capacity per county.
// countyFeatures: GeoJSON feature array from TopoJSON (us-atlas counties).
// Returns { [countyId]: { estimatedMW, miles, lineCount } }
function computeCountyTxCapacity(lines, countyFeatures) {
  const byCounty = {};
  for (const f of countyFeatures) {
    byCounty[f.id] = { estimatedMW: 0, miles: 0, lineCount: 0 };
  }

  for (const line of (lines.features || [])) {
    if (!line.geometry) continue;
    const coords = line.geometry.type === 'MultiLineString'
      ? line.geometry.coordinates[0] : line.geometry.coordinates;
    if (!coords || coords.length === 0) continue;

    const mid = coords[Math.floor(coords.length / 2)];
    if (!mid) continue;

    // Find county whose polygon contains this midpoint
    for (const county of countyFeatures) {
      if (d3.geoContains(county, mid)) {
        const cls = voltageClass(line.properties?.voltage);
        const segs = line.geometry.type === 'MultiLineString'
          ? line.geometry.coordinates : [line.geometry.coordinates];
        let km = 0;
        for (const seg of segs)
          for (let i = 1; i < seg.length; i++)
            km += _hkm(seg[i-1][1], seg[i-1][0], seg[i][1], seg[i][0]);
        const mi = km * 0.621371;
        byCounty[county.id].estimatedMW += mi * TX_MW_PER_MILE[cls];
        byCounty[county.id].miles       += mi;
        byCounty[county.id].lineCount++;
        break;
      }
    }
  }

  // Round MW values
  for (const id in byCounty) byCounty[id].estimatedMW = Math.round(byCounty[id].estimatedMW);
  return byCounty;
}
