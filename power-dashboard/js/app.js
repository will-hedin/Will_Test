// app.js — routing, state management, view orchestration

let _currentStateId = null;

// ── Theme ─────────────────────────────────────────────────────────────────────

function initTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    applyTheme(e.matches ? 'dark' : 'light');
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
}

// ── View switching ────────────────────────────────────────────────────────────

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ── US map view ───────────────────────────────────────────────────────────────

async function initMapView() {
  try {
    await initUSMap(stateId => navigateToState(stateId));
  } catch (e) {
    console.error('Failed to load US map:', e);
    document.getElementById('us-map').insertAdjacentHTML('afterend',
      `<p class="error-banner">Failed to load map: ${e.message}</p>`);
  }

  // Toggle buttons
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateUSMapColors(btn.dataset.view);
    });
  });
}

// ── State detail view ─────────────────────────────────────────────────────────

async function navigateToState(stateId) {
  _currentStateId = stateId;
  const info = STATE_DATA[stateId];
  if (!info) return;

  // Reset UI
  showView('state-view');
  resetStateView(stateId, info);

  // Start fetching data
  fetchStateData(stateId, (stage, data) => {
    handleDataProgress(stateId, stage, data, info);
  }).catch(e => {
    console.error('fetchStateData error:', e);
    showError('generators-error', e.message);
  });
}

function resetStateView(stateId, info) {
  resetTransmissionFilters();

  // Title + badge
  document.getElementById('state-name').textContent = info.name;
  const badge = document.getElementById('state-iso-badge');
  badge.textContent = info.iso;
  badge.style.background = (ISO_COLORS[info.iso] || '#6b7280') + '33';
  badge.style.color = ISO_COLORS[info.iso] || '#6b7280';
  badge.style.borderColor = ISO_COLORS[info.iso] || '#6b7280';

  // Reset metric cards to loading state
  setCard('capacity',   '—', 'Loading...');
  setCard('generators', '—', 'Loading...');
  setCard('price',      '—', 'Loading...');
  setCard('iso',        info.iso, info.utility);
  setCard('fuel',       topFuel(info.mix).charAt(0).toUpperCase() + topFuel(info.mix).slice(1), 'By installed capacity (estimated)');
  setCard('headroom',     '—', 'Loading...');
  setCard('transmission', '—', 'Loading OSM + HIFLD…');

  // Reset source badges
  ['src-eia', 'src-osm', 'src-hifld', 'src-gridstatus'].forEach(id => setSrcBadge(id, false));

  // eGRID CO₂ rate — static EPA data, available immediately
  const eg = egridForState(stateId);
  if (eg) {
    setCard('co2', `${eg.co2.toLocaleString()} lbs`, `${eg.name} · EPA eGRID 2022`);
  } else {
    setCard('co2', '—', 'eGRID subregion unknown');
  }

  // Reset county map
  document.getElementById('county-loading').style.display = '';
  document.getElementById('county-loading').textContent = 'Loading map data...';
  d3.select('#county-map').selectAll('*').remove();

  // Reset generators table
  show('generators-loading');
  hide('generators-table');
  hide('generators-error');
  document.getElementById('generators-tbody').innerHTML = '';

  // Reset grid panel
  document.getElementById('grid-panel-iso').textContent = info.iso !== 'Non-ISO' ? `(${info.iso})` : '';
  show('grid-loading');
  hide('grid-non-iso');
  hide('grid-charts');
  hide('grid-error');
  destroyCharts();

  if (info.iso === 'Non-ISO') {
    hide('grid-loading');
    show('grid-non-iso');
    document.getElementById('grid-non-iso').innerHTML = `
      <div class="non-iso-card">
        <strong>${info.name}</strong> is served by <strong>${info.utility}</strong>,
        a vertically integrated non-ISO utility. No real-time public grid data is
        available via GridStatus. EIA federal data (generators, prices, generation)
        is available below.
      </div>`;
  }
}

function handleDataProgress(stateId, stage, data, info) {
  if (stateId !== _currentStateId) return; // user navigated away

  if (stage === 'eia_error') {
    const msg = data.errors.eia || 'EIA API key not configured';
    show('generators-error');
    document.getElementById('generators-error').innerHTML =
      `<span>⚠️ ${msg}</span>`;
    hide('generators-loading');
    setCard('capacity', '—', 'EIA key needed');
    setCard('generators', '—', '');
    setCard('headroom', '—', 'EIA key needed');

    // Still render county map and fetch transmission lines (no EIA key needed for OSM)
    renderCountyMap(stateId, []).then(bbox => {
      if (stateId !== _currentStateId || !bbox) return;
      fetchStateTransmission(stateId, bbox)
        .then(({ lines, substations }) => {
          if (stateId !== _currentStateId) return;
          addTransmissionToCountyMap(lines, substations);
          setCard('transmission', `${computeLineMiles(lines.features).toLocaleString()} mi`,
            `${substations.features.length} substations · 345/500/765 kV`);
        })
        .catch(e => setCard('transmission', '—', `OSM: ${e.message.slice(0, 50)}`));
    });

    if (info.iso !== 'Non-ISO') {
      hide('grid-loading');
      if (data.errors.grid) {
        show('grid-error');
        document.getElementById('grid-error').innerHTML = `⚠️ ${data.errors.grid}`;
      }
    }
    return;
  }

  if (stage === 'generators' || stage === 'cached') {
    const gens = data.generators || [];
    hide('generators-loading');
    setSrcBadge('src-eia', gens.length > 0);

    // Metric cards from generator data
    const totalMW  = gens.reduce((s, g) => s + +(g['nameplate-capacity-mw'] || 0), 0);
    const totalGW  = totalMW / 1000;
    const topSrc   = topGeneratorFuel(gens);
    setCard('capacity',   `${totalGW.toFixed(1)} GW`, `${gens.length.toLocaleString()} operating units`);
    setCard('generators', gens.length.toLocaleString(), 'Operating units');
    if (topSrc) setCard('fuel', fuelLabel(topSrc.code), `${topSrc.pct}% by capacity`);

    // Available supply: headroom above peak demand + reserve margin
    const peakGW       = info.peak_gw || 0;
    const headroomGW   = totalGW - peakGW;
    const reservePct   = peakGW > 0 ? ((headroomGW / peakGW) * 100).toFixed(0) : '—';
    const headroomStr  = headroomGW >= 0
      ? `+${headroomGW.toFixed(1)} GW`
      : `${headroomGW.toFixed(1)} GW`;
    const reserveLabel = peakGW > 0
      ? `${reservePct}% reserve margin (peak: ${peakGW} GW)`
      : 'Peak demand unknown';
    setCard('headroom', headroomStr, reserveLabel);

    // Render county map; when done, fetch transmission lines from Overpass/OSM
    renderCountyMap(stateId, gens).then(bbox => {
      if (stateId !== _currentStateId || !bbox) return;
      fetchStateTransmission(stateId, bbox)
        .then(({ lines, substations, sources }) => {
          if (stateId !== _currentStateId) return;
          addTransmissionToCountyMap(lines, substations);
          applyTransmissionFilter();   // hide classes that are toggled off
          const miles    = computeLineMiles(lines.features);
          const subCount = substations.features.length;
          const srcLabel = [sources.osm && 'OSM', sources.hifld && 'HIFLD'].filter(Boolean).join('+');
          setCard('transmission', `${miles.toLocaleString()} mi`,
            `${subCount} substations · 110–765 kV · ${srcLabel}`);
          setSrcBadge('src-osm',   sources.osm);
          setSrcBadge('src-hifld', sources.hifld);
        })
        .catch(e => {
          console.warn('Transmission fetch failed:', e);
          setCard('transmission', '—', `OSM: ${e.message.slice(0, 50)}`);
        });
    });

    // Render generators table
    renderGeneratorsTable(gens);

    if (data.errors.generators) {
      show('generators-error');
      document.getElementById('generators-error').innerHTML = `⚠️ ${data.errors.generators}`;
    }
  }

  if (stage === 'retail' || stage === 'cached') {
    const sales = data.retailSales || [];
    const price = sales[0]?.price;
    setCard('price', price ? `${(+price).toFixed(2)}¢` : '—', price ? `${sales[0]?.period || ''} commercial rate` : 'No price data');
  }

  if (stage === 'grid' || stage === 'cached') {
    if (info.iso === 'Non-ISO') return;
    const grid = data.grid;
    hide('grid-loading');

    if (!grid) {
      if (data.errors.grid) {
        show('grid-error');
        document.getElementById('grid-error').innerHTML = `⚠️ ${data.errors.grid}`;
      }
      return;
    }

    show('grid-charts');
    setSrcBadge('src-gridstatus', true);

    if (grid.queue && grid.queue.length > 0) {
      renderQueueChart(grid.queue);
    } else if (grid.errors?.queue) {
      document.getElementById('queue-stats').innerHTML =
        `<p class="no-data">Queue data unavailable: ${grid.errors.queue}</p>`;
    }

    if (grid.fuelmix && grid.fuelmix.length > 0) {
      renderFuelMixChart(grid.fuelmix);
    } else if (grid.errors?.fuelmix) {
      const ctx = document.getElementById('fuelmix-chart');
      if (ctx) ctx.parentElement.innerHTML += `<p class="no-data">Fuel mix unavailable: ${grid.errors.fuelmix}</p>`;
    }
  }

  if (stage === 'done' || stage === 'cached') {
    hide('generators-loading');
    hide('grid-loading');
  }
}

function topGeneratorFuel(generators) {
  const groups = {};
  let total = 0;
  for (const g of generators) {
    const key = g['energy-source-code'] || 'OTH';
    const mw  = +(g['nameplate-capacity-mw'] || 0);
    groups[key] = (groups[key] || 0) + mw;
    total += mw;
  }
  if (total === 0) return null;
  const top = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
  return { code: top[0], pct: ((top[1] / total) * 100).toFixed(1) };
}

function renderGeneratorsTable(generators) {
  const top15 = generators.slice(0, 15);
  const tbody = document.getElementById('generators-tbody');
  tbody.innerHTML = top15.map(g => {
    const mw   = Math.round(+(g['nameplate-capacity-mw'] || 0));
    const fuel = fuelLabel(g['energy-source-code']);
    const color = fuelColor(g['energy-source-code']);
    return `<tr>
      <td title="${g['plant-name'] || ''}">${truncate(g['plant-name'] || '—', 28)}</td>
      <td><span class="fuel-tag" style="background:${color}22;color:${color};border:1px solid ${color}88">${fuel}</span></td>
      <td class="num">${mw.toLocaleString()}</td>
      <td>${truncate(g.county || '—', 18)}</td>
    </tr>`;
  }).join('');
  show('generators-table');
}

// ── Back button ───────────────────────────────────────────────────────────────

document.getElementById('back-btn').addEventListener('click', () => {
  _currentStateId = null;
  showView('map-view');
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function setCard(id, value, sub) {
  const valEl = document.getElementById(`val-${id}`);
  const subEl = document.getElementById(`sub-${id}`);
  if (valEl) valEl.textContent = value;
  if (subEl && sub !== undefined) subEl.textContent = sub;
}

function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = `⚠️ ${msg}`; el.classList.remove('hidden'); }
}
function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function setSrcBadge(id, active) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('src-active', !!active);
}

// ── Transmission voltage filters ─────────────────────────────────────────────

// Tracks which voltage buckets are currently visible
let _txActive = new Set(TX_DEFAULT_ON);

function initTransmissionFilters() {
  document.querySelectorAll('.tx-filter').forEach(btn => {
    const kv = btn.dataset.kv;
    // Set initial visual state from TX_DEFAULT_ON
    if (!_txActive.has(kv)) btn.classList.remove('active');

    btn.addEventListener('click', () => {
      if (_txActive.has(kv)) {
        _txActive.delete(kv);
        btn.classList.remove('active');
      } else {
        _txActive.add(kv);
        btn.classList.add('active');
      }
      applyTransmissionFilter();
    });
  });
}

function resetTransmissionFilters() {
  _txActive = new Set(TX_DEFAULT_ON);
  document.querySelectorAll('.tx-filter').forEach(btn => {
    if (_txActive.has(btn.dataset.kv)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  // Don't call applyTransmissionFilter here — new lines haven't rendered yet
}

// Show/hide rendered SVG elements by their data-kv attribute
function applyTransmissionFilter() {
  const svg = document.getElementById('county-map');
  if (!svg) return;
  svg.querySelectorAll('path.tx-line, circle.tx-sub').forEach(el => {
    el.style.display = _txActive.has(el.getAttribute('data-kv')) ? '' : 'none';
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  initTheme();
  initTransmissionFilters();
  showView('map-view');
  await initMapView();
}

document.addEventListener('DOMContentLoaded', init);
