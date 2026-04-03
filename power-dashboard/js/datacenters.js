// datacenters.js — Epoch AI Frontier Data Centers map + filterable table
// Data: https://epoch.ai/data/data-centers/ (CC Attribution)
// Bundled as /data/data_centers.js to avoid CORS and ensure availability.

let _dcMapInit      = false;
let _dcProjection   = null;
let _dcFiltered     = [];

// ── ITU Infrastructure layer ──────────────────────────────────────────────────
let _ituVisible  = false;
let _ituCached   = null;   // { cables, ixps } once fetched

const ITU_WFS = 'https://bbmaps.itu.int/geoserver/wfs';
// North America + adjacent oceans bounding box
const NA_BBOX  = '-170,10,-40,75,EPSG:4326';

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

  const ituBtn = document.getElementById('itu-toggle');
  if (ituBtn) ituBtn.addEventListener('click', toggleITULayer);
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

// ── ITU layer fetch + render ──────────────────────────────────────────────────

function ituWfsUrl(typeName) {
  return `${ITU_WFS}?service=wfs&version=2.0.0&request=GetFeature` +
    `&typeNames=${encodeURIComponent(typeName)}&outputFormat=application/json` +
    `&count=2000&SRSNAME=EPSG:4326&bbox=${NA_BBOX}`;
}

async function fetchITUData() {
  const [cablesRes, ixpsRes] = await Promise.allSettled([
    fetch(ituWfsUrl('ITU:submarine_cables')).then(r => r.json()),
    fetch(ituWfsUrl('ITU:ixp')).then(r => r.json()),
  ]);
  return {
    cables: cablesRes.status === 'fulfilled' ? (cablesRes.value.features || []) : [],
    ixps:   ixpsRes.status  === 'fulfilled' ? (ixpsRes.value.features  || []) : [],
  };
}

function renderITULayer(cables, ixps) {
  const svg  = d3.select('#dc-map');
  if (svg.empty() || !_dcProjection) return;

  svg.select('g.itu-layer').remove();
  const g    = svg.select('g');          // main group
  const itu  = g.insert('g', 'g.dc-dots').attr('class', 'itu-layer');

  const path = d3.geoPath().projection(_dcProjection);
  const tooltip = document.getElementById('dc-tooltip');

  // Submarine cables — lines
  const cablesG = itu.append('g').attr('class', 'itu-cables');
  cablesG.selectAll('path.itu-cable')
    .data(cables)
    .enter().append('path')
    .attr('class', 'itu-cable')
    .attr('d', d => path(d.geometry))
    .attr('fill', 'none')
    .attr('stroke', '#38bdf8')
    .attr('stroke-width', 1.2)
    .attr('stroke-opacity', 0.55)
    .style('cursor', 'pointer')
    .on('mousemove', function(event, d) {
      if (!tooltip) return;
      const p = d.properties || {};
      tooltip.innerHTML = `
        <div class="tt-title">${p.cable_name || p.name || 'Submarine Cable'}</div>
        ${p.owners     ? `<div class="tt-row"><span>Owner(s)</span><strong>${p.owners}</strong></div>` : ''}
        ${p.rfs_year   ? `<div class="tt-row"><span>Ready</span><strong>${p.rfs_year}</strong></div>` : ''}
        ${p.length_km  ? `<div class="tt-row"><span>Length</span><strong>${Number(p.length_km).toLocaleString()} km</strong></div>` : ''}
        ${p.capacity_tbps ? `<div class="tt-row"><span>Capacity</span><strong>${p.capacity_tbps} Tbps</strong></div>` : ''}
      `;
      tooltip.classList.remove('hidden');
      positionTooltip(tooltip, event);
    })
    .on('mouseleave', () => tooltip?.classList.add('hidden'));

  // IXPs — diamond markers
  const ixpsG = itu.append('g').attr('class', 'itu-ixps');
  ixpsG.selectAll('path.itu-ixp')
    .data(ixps.filter(f => f.geometry?.type === 'Point'))
    .enter().append('path')
    .attr('class', 'itu-ixp')
    .attr('d', d => {
      const pt = _dcProjection(d.geometry.coordinates);
      if (!pt) return '';
      const [x, y] = pt, s = 5;
      return `M${x},${y-s} L${x+s},${y} L${x},${y+s} L${x-s},${y} Z`;
    })
    .attr('fill', '#a78bfa')
    .attr('stroke', '#7c3aed')
    .attr('stroke-width', 0.8)
    .attr('fill-opacity', 0.8)
    .style('cursor', 'pointer')
    .on('mousemove', function(event, d) {
      if (!tooltip) return;
      const p = d.properties || {};
      tooltip.innerHTML = `
        <div class="tt-title">${p.name || p.long_name || 'IXP'}</div>
        <div class="tt-row"><span>Type</span><strong>Internet Exchange Point</strong></div>
        ${p.city    ? `<div class="tt-row"><span>City</span><strong>${p.city}</strong></div>` : ''}
        ${p.country ? `<div class="tt-row"><span>Country</span><strong>${p.country}</strong></div>` : ''}
        ${p.website ? `<div class="tt-row"><span>Website</span><strong>${p.website}</strong></div>` : ''}
      `;
      tooltip.classList.remove('hidden');
      positionTooltip(tooltip, event);
    })
    .on('mouseleave', () => tooltip?.classList.add('hidden'));

  // Map legend entries
  let leg = svg.select('g.itu-legend');
  if (leg.empty()) {
    const W = +svg.attr('viewBox').split(' ')[2] || 900;
    const H = +svg.attr('viewBox').split(' ')[3] || 480;
    leg = svg.append('g').attr('class', 'itu-legend')
      .attr('transform', `translate(${W - 160}, ${H - 56})`);
  }
  leg.selectAll('*').remove();
  leg.append('rect').attr('x', -8).attr('y', -8).attr('width', 160).attr('height', 56)
    .attr('fill', 'rgba(0,0,0,0.45)').attr('rx', 4);
  // Cable entry
  leg.append('line').attr('x1', 0).attr('y1', 8).attr('x2', 18).attr('y2', 8)
    .attr('stroke', '#38bdf8').attr('stroke-width', 2);
  leg.append('text').attr('x', 24).attr('y', 12)
    .attr('fill', 'rgba(255,255,255,0.9)').attr('font-size', 11).text('Submarine cable');
  // IXP entry
  const ix = 9, iy = 30;
  leg.append('path').attr('d', `M${ix},${iy-5} L${ix+5},${iy} L${ix},${iy+5} L${ix-5},${iy} Z`)
    .attr('fill', '#a78bfa').attr('stroke', '#7c3aed').attr('stroke-width', 0.8);
  leg.append('text').attr('x', 24).attr('y', iy + 4)
    .attr('fill', 'rgba(255,255,255,0.9)').attr('font-size', 11).text('IXP');
}

async function toggleITULayer() {
  const btn    = document.getElementById('itu-toggle');
  const status = document.getElementById('itu-status');

  _ituVisible = !_ituVisible;

  if (!_ituVisible) {
    d3.select('#dc-map g.itu-layer').remove();
    d3.select('#dc-map g.itu-legend').remove();
    if (btn) btn.classList.remove('active');
    if (btn) btn.textContent = 'ITU Infrastructure: OFF';
    if (status) status.textContent = '';
    return;
  }

  if (btn) { btn.classList.add('active'); btn.textContent = 'ITU Infrastructure: ON'; }
  if (status) status.textContent = 'Loading…';

  try {
    if (!_ituCached) _ituCached = await fetchITUData();
    renderITULayer(_ituCached.cables, _ituCached.ixps);
    const nCables = _ituCached.cables.length;
    const nIxps   = _ituCached.ixps.length;
    if (status) status.textContent = `${nCables} cables · ${nIxps} IXPs`;
  } catch (e) {
    if (status) status.textContent = `Error: ${e.message}`;
    _ituVisible = false;
    if (btn) { btn.classList.remove('active'); btn.textContent = 'ITU Infrastructure: OFF'; }
  }
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
