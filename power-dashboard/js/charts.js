// charts.js — Chart.js rendering for grid data panels

let _queueChart = null;
let _fuelmixChart = null;

function destroyCharts() {
  if (_queueChart)   { _queueChart.destroy();   _queueChart = null; }
  if (_fuelmixChart) { _fuelmixChart.destroy(); _fuelmixChart = null; }
}

function chartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text:   style.getPropertyValue('--text').trim()   || '#1a1a1a',
    muted:  style.getPropertyValue('--text-muted').trim() || '#6b7280',
    border: style.getPropertyValue('--border').trim() || 'rgba(0,0,0,0.12)',
    bg:     style.getPropertyValue('--bg-card').trim() || '#ffffff',
  };
}

// Aggregate interconnection queue by fuel type
// GridStatus queue rows have fields like fuel_type, capacity_mw, status, etc.
function aggregateQueue(rows) {
  const groups = {};
  let activeCount = 0;
  let activeMW = 0;

  for (const row of rows) {
    // Field names vary by ISO; try common ones
    const fuel = row.fuel_type || row.generation_type || row.type || row.technology || 'Unknown';
    const mw = +(row.capacity_mw || row.mw || row.summer_capacity_mw || row.nameplate_mw || 0);
    const status = (row.status || row.queue_status || '').toLowerCase();

    const key = normFuel(fuel);
    groups[key] = (groups[key] || 0) + mw;

    if (!status.includes('withdraw') && !status.includes('cancel') && mw > 0) {
      activeCount++;
      activeMW += mw;
    }
  }

  const sorted = Object.entries(groups)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return { entries: sorted, activeCount, activeMW };
}

// Non-fuel metadata columns to skip in wide-format detection
const _META_COLS = new Set([
  'interval_start_utc','interval_end_utc','interval_start','interval_end',
  'load_mw','net_load_mw','total_mw','timestamp','period','iso',
]);

// Aggregate fuel mix data
// GridStatus fuel_mix rows come in two wide formats:
//   A) columns ending in _mw  (e.g. natural_gas_mw, solar_mw)
//   B) plain fuel columns     (e.g. natural_gas, solar, wind) — ERCOT style
// Or long format with fuel_type + mw columns.
function aggregateFuelMix(rows) {
  const groups = {};
  if (!rows.length) return [];

  const first = rows[0];

  // Wide format A: _mw-suffixed columns
  const mwCols = Object.keys(first).filter(k =>
    k.endsWith('_mw') && !_META_COLS.has(k)
  );

  // Wide format B: plain numeric columns that look like fuel names (not metadata)
  const plainCols = Object.keys(first).filter(k =>
    !_META_COLS.has(k) && !k.endsWith('_utc') && !k.endsWith('_mw') &&
    typeof first[k] === 'number' && first[k] >= 0
  );

  if (mwCols.length > 2) {
    const recent = rows[0];
    for (const col of mwCols) {
      const key = normFuel(col.replace(/_mw$/, ''));
      const val = +(recent[col] || 0);
      if (val > 0) groups[key] = (groups[key] || 0) + val;
    }
  } else if (plainCols.length > 2) {
    const recent = rows[0];
    for (const col of plainCols) {
      const key = normFuel(col);
      const val = +(recent[col] || 0);
      if (val > 0) groups[key] = (groups[key] || 0) + val;
    }
  } else {
    // Long format — one row per fuel type
    for (const row of rows) {
      const fuel = row.fuel_type || row.source || row.fuel || 'Other';
      const mw = +(row.mw || row.load_mw || row.net_generation_mw || row.generation_mw || 0);
      if (mw > 0) {
        const key = normFuel(fuel);
        groups[key] = (groups[key] || 0) + mw;
      }
    }
  }

  return Object.entries(groups)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
}

// Normalize fuel type strings to standard keys
function normFuel(s) {
  s = (s || '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
  if (s.includes('gas') || s.includes('ng') || s.includes('natural'))  return 'Natural Gas';
  if (s.includes('solar') || s.includes('sun') || s.includes('pv'))    return 'Solar';
  if (s.includes('wind'))                                                return 'Wind';
  if (s.includes('nuclear') || s.includes('nuc'))                       return 'Nuclear';
  if (s.includes('coal') || s.includes('bit') || s.includes('sub'))     return 'Coal';
  if (s.includes('hydro') || s.includes('water') || s.includes('wat'))  return 'Hydro';
  if (s.includes('batter') || s.includes('storage') || s.includes('mwh')) return 'Battery';
  if (s.includes('oil') || s.includes('diesel') || s.includes('dfo'))   return 'Oil';
  if (s.includes('geo'))                                                 return 'Geothermal';
  if (s.includes('bio') || s.includes('wood') || s.includes('waste'))   return 'Biomass';
  return s.length > 1 ? s.charAt(0).toUpperCase() + s.slice(1) : 'Other';
}

const CHART_FUEL_COLORS = {
  'Natural Gas': '#f97316',
  'Solar':       '#eab308',
  'Wind':        '#22c55e',
  'Nuclear':     '#3b82f6',
  'Coal':        '#78716c',
  'Hydro':       '#06b6d4',
  'Battery':     '#ec4899',
  'Oil':         '#b45309',
  'Geothermal':  '#a3e635',
  'Biomass':     '#84cc16',
  'Other':       '#a855f7',
};

function fuelChartColor(label) {
  return CHART_FUEL_COLORS[label] || '#a855f7';
}

// Render interconnection queue bar chart
function renderQueueChart(queueRows) {
  const ctx = document.getElementById('queue-chart');
  if (!ctx) return;
  if (_queueChart) { _queueChart.destroy(); _queueChart = null; }

  const { entries, activeCount, activeMW } = aggregateQueue(queueRows);

  if (entries.length === 0) {
    ctx.parentElement.innerHTML += '<p class="no-data">No queue data available</p>';
    return;
  }

  const c = chartColors();
  _queueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        label: 'MW in Queue',
        data: entries.map(([, v]) => Math.round(v)),
        backgroundColor: entries.map(([k]) => fuelChartColor(k) + 'cc'),
        borderColor:     entries.map(([k]) => fuelChartColor(k)),
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y.toLocaleString()} MW`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: c.muted, font: { size: 11 }, maxRotation: 35 },
          grid:  { color: c.border },
        },
        y: {
          ticks: {
            color: c.muted, font: { size: 11 },
            callback: v => v >= 1000 ? `${(v/1000).toFixed(0)}GW` : `${v}MW`,
          },
          grid: { color: c.border },
        },
      },
    },
  });

  // Update stats
  const statsEl = document.getElementById('queue-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="queue-stats">
        <span><strong>${activeCount.toLocaleString()}</strong> active projects</span>
        <span><strong>${(activeMW/1000).toFixed(1)} GW</strong> total queued capacity</span>
      </div>`;
  }
}

// Render current fuel mix donut chart
function renderFuelMixChart(fuelmixRows) {
  const ctx = document.getElementById('fuelmix-chart');
  if (!ctx) return;
  if (_fuelmixChart) { _fuelmixChart.destroy(); _fuelmixChart = null; }

  const entries = aggregateFuelMix(fuelmixRows);
  if (entries.length === 0) {
    ctx.parentElement.innerHTML += '<p class="no-data">No fuel mix data available</p>';
    return;
  }

  const c = chartColors();
  _fuelmixChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([, v]) => Math.round(v)),
        backgroundColor: entries.map(([k]) => fuelChartColor(k) + 'cc'),
        borderColor:     entries.map(([k]) => fuelChartColor(k)),
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: c.text, font: { size: 11 }, boxWidth: 12, padding: 8 },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return `${ctx.label}: ${ctx.parsed.toLocaleString()} MW (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// Re-render charts after theme change
function refreshChartTheme() {
  // Charts will pick up new CSS variables on next render; destroy & re-render via app
}
