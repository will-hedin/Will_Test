// api.js — EIA + GridStatus API calls with in-memory caching

const _cache = {};

// ── EIA helpers ──────────────────────────────────────────────────────────────

function eiaUrl(endpoint, parts) {
  let url = `https://api.eia.gov/v2/${endpoint}/data/?api_key=${CONFIG.EIA_API_KEY}`;
  for (const [k, v] of Object.entries(parts)) {
    if (Array.isArray(v)) {
      v.forEach(item => url += `&${k}=${encodeURIComponent(item)}`);
    } else {
      url += `&${k}=${encodeURIComponent(v)}`;
    }
  }
  return url;
}

async function eiaFetch(endpoint, parts) {
  const url = eiaUrl(endpoint, parts);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`EIA ${endpoint} → HTTP ${resp.status}`);
  const json = await resp.json();
  if (json.response?.error) throw new Error(`EIA error: ${json.response.error}`);
  return json.response?.data || [];
}

// Fetch all operating generators for a state (up to 5000).
// Returns array of objects; key fields: nameplate-capacity-mw, energy-source-code,
// plant-name, county, latitude, longitude
async function fetchGenerators(stateId) {
  return eiaFetch('electricity/operating-generator-capacity', {
    [`facets[stateid][]`]: stateId,
    [`facets[status][]`]: 'OP',
    [`data[]`]: ['nameplate-capacity-mw','energy-source-code','latitude','longitude','plant-name','county'],
    [`sort[0][column]`]: 'nameplate-capacity-mw',
    [`sort[0][direction]`]: 'desc',
    length: 5000,
  });
}

// Fetch recent commercial electricity price for a state.
// Returns array; key field: price (cents/kWh)
async function fetchRetailSales(stateId) {
  return eiaFetch('electricity/retail-sales', {
    [`facets[stateid][]`]: stateId,
    [`facets[sectorid][]`]: 'COM',
    [`data[]`]: 'price',
    frequency: 'annual',
    [`sort[0][column]`]: 'period',
    [`sort[0][direction]`]: 'desc',
    length: 5,
  });
}

// Fetch plant-level annual generation for a state (top 200 by generation).
async function fetchFacilityFuel(stateId) {
  return eiaFetch('electricity/facility-fuel', {
    [`facets[state][]`]: stateId,
    [`data[]`]: 'generation',
    frequency: 'annual',
    [`sort[0][column]`]: 'generation',
    [`sort[0][direction]`]: 'desc',
    length: 200,
  });
}

// ── GridStatus helpers ────────────────────────────────────────────────────────

const GS_BASE = 'https://api.gridstatus.io/v1';

function gsHeaders() {
  return { 'x-api-key': CONFIG.GRIDSTATUS_API_KEY };
}

async function gsFetch(path, params = {}) {
  const qs = new URLSearchParams({ limit: 300, ...params }).toString();
  const url = `${GS_BASE}${path}?${qs}`;
  const resp = await fetch(url, { headers: gsHeaders() });
  if (resp.status === 404) {
    const err = new Error('NOT_FOUND');
    err.status = 404;
    throw err;
  }
  if (!resp.ok) throw new Error(`GridStatus ${path} → HTTP ${resp.status}`);
  const json = await resp.json();
  return json.data || json;
}

// List available datasets and find one matching a pattern
async function gsFindDataset(pattern) {
  const datasets = await gsFetch('/datasets');
  const list = Array.isArray(datasets) ? datasets : (datasets.data || []);
  return list.find(d => (d.id || d.name || '').toLowerCase().includes(pattern.toLowerCase()));
}

async function gsDataset(datasetId, limit = 300) {
  try {
    return await gsFetch(`/datasets/${datasetId}/query`, { limit });
  } catch (err) {
    if (err.status === 404) {
      // Try to find a matching dataset
      const prefix = datasetId.split('_')[0];
      const suffix = datasetId.split('_').slice(1).join('_');
      const found = await gsFindDataset(`${prefix}_${suffix}`).catch(() => null);
      if (found) return gsFetch(`/datasets/${found.id}/query`, { limit });
    }
    throw err;
  }
}

// Fetch interconnection queue, fuel mix, and load for an ISO
async function fetchGridStatus(isoName) {
  const prefix = ISO_GRID_PREFIXES[isoName];
  if (!prefix) throw new Error(`No GridStatus prefix for ISO: ${isoName}`);

  const results = { queue: [], fuelmix: [], load: [], errors: {} };

  const [qR, fR, lR] = await Promise.allSettled([
    gsDataset(`${prefix}_interconnection_queue`, 300),
    gsDataset(`${prefix}_fuel_mix`, 100),
    gsDataset(`${prefix}_load`, 100),
  ]);

  if (qR.status === 'fulfilled') results.queue   = qR.value; else results.errors.queue   = qR.reason?.message;
  if (fR.status === 'fulfilled') results.fuelmix  = fR.value; else results.errors.fuelmix  = fR.reason?.message;
  if (lR.status === 'fulfilled') results.load     = lR.value; else results.errors.load     = lR.reason?.message;

  return results;
}

// ── Main entry point ─────────────────────────────────────────────────────────

// Fetch all data for a state, calling onProgress(stage, data) as each part lands.
// Results are cached per state.
async function fetchStateData(stateId, onProgress) {
  if (_cache[stateId]) {
    onProgress('cached', _cache[stateId]);
    return _cache[stateId];
  }

  const stateInfo = STATE_DATA[stateId];
  if (!stateInfo) throw new Error(`Unknown state: ${stateId}`);

  const result = { generators: [], retailSales: [], facilityFuel: [], grid: null, errors: {} };

  // Check for placeholder keys
  const hasEIA = CONFIG.EIA_API_KEY && CONFIG.EIA_API_KEY !== 'YOUR_EIA_API_KEY_HERE' && CONFIG.EIA_API_KEY !== 'REPLACE_WITH_YOUR_EIA_API_KEY';
  const hasGS  = CONFIG.GRIDSTATUS_API_KEY && CONFIG.GRIDSTATUS_API_KEY !== 'YOUR_GRIDSTATUS_API_KEY_HERE' && CONFIG.GRIDSTATUS_API_KEY !== 'REPLACE_WITH_YOUR_GRIDSTATUS_API_KEY';

  if (!hasEIA) {
    result.errors.eia = 'EIA API key not configured — add your key to config.js (get one free at eia.gov/opendata)';
    onProgress('eia_error', result);
  } else {
    // EIA: generators first (used for map), then retail sales + facility fuel
    try {
      result.generators = await fetchGenerators(stateId);
      onProgress('generators', result);
    } catch (e) {
      result.errors.generators = e.message;
      onProgress('generators_error', result);
    }

    await new Promise(r => setTimeout(r, 200)); // rate limit buffer

    try {
      result.retailSales = await fetchRetailSales(stateId);
      onProgress('retail', result);
    } catch (e) {
      result.errors.retail = e.message;
    }

    await new Promise(r => setTimeout(r, 200));

    try {
      result.facilityFuel = await fetchFacilityFuel(stateId);
      onProgress('facility', result);
    } catch (e) {
      result.errors.facility = e.message;
    }
  }

  // GridStatus (ISO states only)
  const iso = stateInfo.iso;
  if (iso !== 'Non-ISO') {
    if (!hasGS) {
      result.errors.grid = 'GridStatus API key not configured — add your key to config.js (get one free at gridstatus.io)';
    } else {
      try {
        result.grid = await fetchGridStatus(iso);
        onProgress('grid', result);
      } catch (e) {
        result.errors.grid = e.message;
      }
    }
  }

  _cache[stateId] = result;
  onProgress('done', result);
  return result;
}

// Clear cache for a state (or all if no arg)
function clearCache(stateId) {
  if (stateId) delete _cache[stateId];
  else Object.keys(_cache).forEach(k => delete _cache[k]);
}
