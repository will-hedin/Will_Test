// datacenters.js — Epoch AI Frontier Data Centers map + filterable table
// Data: https://epoch.ai/data/data-centers/ (CC Attribution)
// Bundled as /data/data_centers.js to avoid CORS and ensure availability.

let _dcMapInit      = false;
let _dcProjection   = null;
let _dcFiltered     = [];

// ── Entry point ───────────────────────────────────────────────────────────────

async function initDataCentersView() {
  if (_dcMapInit) {
    // Re-render table in case filters changed (map persists)
    return;
  }
  _dcMapInit = true;

  _dcFiltered = EPOCH_DATA_CENTERS.slice();

  populateDCOwnerFilter();
  attachDCFilterListeners();
  applyDCFilters();

  await renderDCMap(_dcFiltered);
}

// ── Filters ───────────────────────────────────────────────────────────────────

function populateDCOwnerFilter() {
  const sel = document.getElementById('dc-filter-owner');
  if (!sel) return;
  const owners = [...new Set(EPOCH_DATA_CENTERS.map(d => d.owner).filter(Boolean))].sort();
  owners.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    sel.appendChild(opt);
  });
}

function attachDCFilterListeners() {
  ['dc-filter-owner', 'dc-filter-country', 'dc-filter-minpower', 'dc-filter-search']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', applyDCFilters);
    });
  const sortEl = document.getElementById('dc-sort');
  if (sortEl) sortEl.addEventListener('change', applyDCFilters);
}

function applyDCFilters() {
  const owner   = document.getElementById('dc-filter-owner')?.value   || '';
  const country = document.getElementById('dc-filter-country')?.value || '';
  const minPow  = parseFloat(document.getElementById('dc-filter-minpower')?.value) || 0;
  const search  = (document.getElementById('dc-filter-search')?.value || '').toLowerCase();
  const sortBy  = document.getElementById('dc-sort')?.value || 'power-desc';

  _dcFiltered = EPOCH_DATA_CENTERS.filter(d => {
    if (owner   && d.owner   !== owner)   return false;
    if (country && d.country !== country) return false;
    if (d.power < minPow)                 return false;
    if (search && !`${d.name} ${d.owner} ${d.users} ${d.project} ${d.address}`.toLowerCase().includes(search))
      return false;
    return true;
  });

  // Sort
  _dcFiltered.sort((a, b) => {
    switch (sortBy) {
      case 'power-desc':  return b.power - a.power;
      case 'h100-desc':   return b.h100  - a.h100;
      case 'cost-desc':   return b.cost  - a.cost;
      case 'name-asc':    return a.name.localeCompare(b.name);
      default:            return b.power - a.power;
    }
  });

  updateDCMapDots(_dcFiltered);
  renderDCTable(_dcFiltered);

  const countEl = document.getElementById('dc-count');
  if (countEl) countEl.textContent = `${_dcFiltered.length} of ${EPOCH_DATA_CENTERS.length} data centers`;
}

// ── D3 Map ────────────────────────────────────────────────────────────────────

async function renderDCMap(data) {
  const wrapper = document.getElementById('dc-map-wrapper');
  const svg     = d3.select('#dc-map');
  if (!wrapper || svg.empty()) return;

  svg.selectAll('*').remove();
  const W = wrapper.clientWidth  || 900;
  const H = wrapper.clientHeight || 480;
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');

  // Load world atlas for country outlines
  const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  const countries = topojson.feature(world, world.objects.countries);

  // North-America-focused Natural Earth projection
  _dcProjection = d3.geoNaturalEarth1()
    .scale(W * 0.38)
    .translate([W * 0.38, H * 0.58])
    .rotate([100, 0]);  // center on North America

  const path = d3.geoPath().projection(_dcProjection);
  const g    = svg.append('g');

  // Land fill
  g.selectAll('path.country')
    .data(countries.features)
    .enter().append('path')
    .attr('class', 'country')
    .attr('d', path)
    .attr('fill', '#1e2f4a')
    .attr('stroke', 'rgba(255,255,255,0.15)')
    .attr('stroke-width', 0.5);

  // Graticule
  g.append('path')
    .datum(d3.geoGraticule()())
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.05)')
    .attr('stroke-width', 0.4);

  // Dot layer (updated by applyDCFilters)
  g.append('g').attr('class', 'dc-dots');

  updateDCMapDots(data);
}

const OWNER_COLORS = {
  'Amazon':    '#f97316',
  'Microsoft': '#3b82f6',
  'Meta':      '#06b6d4',
  'Google':    '#22c55e',
  'xAI':       '#a855f7',
  'Apple':     '#e5e7eb',
};

function ownerColor(owner) {
  return OWNER_COLORS[owner] || '#94a3b8';
}

function updateDCMapDots(data) {
  if (!_dcProjection) return;
  const svg = d3.select('#dc-map');
  const dotsG = svg.select('g.dc-dots');
  if (dotsG.empty()) return;

  const tooltip = document.getElementById('dc-tooltip');

  const dots = dotsG.selectAll('circle.dc-dot').data(data, d => d.name);

  // Exit
  dots.exit().remove();

  // Enter + Update
  dots.enter().append('circle')
    .attr('class', 'dc-dot')
    .merge(dots)
    .attr('cx', d => {
      const pt = _dcProjection([d.lon, d.lat]);
      return pt ? pt[0] : -999;
    })
    .attr('cy', d => {
      const pt = _dcProjection([d.lon, d.lat]);
      return pt ? pt[1] : -999;
    })
    .attr('r', d => Math.max(5, Math.min(22, Math.sqrt(d.power / 4))))
    .attr('fill', d => ownerColor(d.owner) + 'bb')
    .attr('stroke', d => ownerColor(d.owner))
    .attr('stroke-width', 1.2)
    .style('cursor', 'pointer')
    .on('mousemove', function(event, d) {
      if (!tooltip) return;
      tooltip.innerHTML = `
        <div class="tt-title">${d.name}</div>
        <div class="tt-row"><span>Owner</span><strong>${d.owner}</strong></div>
        <div class="tt-row"><span>Users</span><strong>${d.users || d.owner}</strong></div>
        <div class="tt-row"><span>Power</span><strong>${d.power.toLocaleString()} MW</strong></div>
        <div class="tt-row"><span>H100 equiv.</span><strong>${Math.round(d.h100).toLocaleString()}</strong></div>
        <div class="tt-row"><span>Est. Cost</span><strong>$${d.cost.toFixed(1)}B</strong></div>
        <div class="tt-row"><span>Project</span><strong>${d.project || '—'}</strong></div>
        <div class="tt-row"><span>Location</span><strong>${d.address}</strong></div>
      `;
      tooltip.classList.remove('hidden');
      positionTooltip(tooltip, event);
    })
    .on('mouseleave', () => tooltip?.classList.add('hidden'));
}

// ── Results table ─────────────────────────────────────────────────────────────

function renderDCTable(data) {
  const tbody = document.getElementById('dc-tbody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:20px">No data centers match the current filters.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(d => {
    const color = ownerColor(d.owner);
    const dot   = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:5px"></span>`;
    return `<tr>
      <td>${dot}${d.name}</td>
      <td>${d.owner}</td>
      <td>${d.users || d.owner}</td>
      <td class="num">${d.power.toLocaleString()}</td>
      <td class="num">${Math.round(d.h100 / 1000).toLocaleString()}k</td>
      <td class="num">$${d.cost.toFixed(1)}B</td>
      <td style="font-size:11px;color:var(--text-muted)">${d.address}</td>
    </tr>`;
  }).join('');
}
