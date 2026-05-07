// parcels.js — Clark County NV land parcel search near 345/500 kV transmission lines
//
// Data sources:
//   Transmission lines: HIFLD Open Data (same service used by transmission.js)
//   Parcels:            Clark County Assessor LandApp ArcGIS REST service
//   Owner detail:       Clark County Assessor portal (per-parcel deep link)

const CLARK_PARCELS_URL   = 'https://maps.clarkcountynv.gov/arcgis/rest/services/Assessor/LandApp/MapServer/0/query';
// ParcelHistory.aspx?instance=pcl2 is a direct GET URL that returns owner history
// (pcl.aspx is a POST-only form; this endpoint bypasses it)
const CLARK_ASSESSOR_BASE = 'https://maps.clarkcountynv.gov/assessor/AssessorParcelDetail/ParcelHistory.aspx?instance=pcl2&parcel=';

// Clark County NV bounding box [xmin, ymin, xmax, ymax]
const CLARK_BBOX = [-116.1, 35.0, -113.9, 37.3];

// 1 mile expressed in degrees at ~lat 36°N
const MILE_KM      = 1.60934;
const MILE_DEG_LAT = 0.01446;
const MILE_DEG_LON = 0.01787;

let _parcelsLoaded = false;

// ── Entry point ───────────────────────────────────────────────────────────────

async function initParcelsView() {
  setupParcelsRegionSelector();
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
    // Clark County APN: 11-digit raw string from API; display formatted, URL uses raw digits
    const apnRaw = apn.replace(/[-\s]/g, '');
    const apnFmt = apnRaw.length === 11
      ? `${apnRaw.slice(0,3)}-${apnRaw.slice(3,5)}-${apnRaw.slice(5,8)}-${apnRaw.slice(8,11)}`
      : apnRaw;
    const hasApn = apnRaw.length >= 5;
    // ParcelHistory.aspx expects the raw APN (no dashes)
    const link = hasApn
      ? `<a href="${CLARK_ASSESSOR_BASE}${apnRaw}" target="_blank" rel="noopener" class="assessor-link">View Owner →</a>`
      : '—';
    const copyBtn = hasApn
      ? `<button class="copy-apn-btn" data-apn="${apnFmt}" title="Copy APN to clipboard">Copy APN</button>`
      : '';
    return `<tr>
      <td class="mono">${apnFmt}</td>
      <td class="num">${acres}</td>
      <td>${status}</td>
      <td class="owner-cell">${copyBtn}${link}</td>
    </tr>`;
  }).join('');

  if (panel) panel.style.display = '';

  // Copy APN buttons
  tbody.querySelectorAll('.copy-apn-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const apn = btn.dataset.apn;
      navigator.clipboard.writeText(apn).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
      }).catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = apn;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy APN'; btn.classList.remove('copied'); }, 1500);
      });
    });
  });
}

// ── Iowa county data ──────────────────────────────────────────────────────────

const IOWA_COUNTIES = [
  { name: 'Adair',         fips: 19001, url: 'http://adair.iowaassessors.com' },
  { name: 'Adams',         fips: 19003, url: 'http://adams.iowaassessors.com' },
  { name: 'Allamakee',     fips: 19005, url: 'http://beacon.schneidercorp.com/?site=AllamakeeCountyIA' },
  { name: 'Appanoose',     fips: 19007, url: 'http://appanoose.iowaassessors.com' },
  { name: 'Audubon',       fips: 19009, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=96&LayerID=957&PageTypeID=2&PageID=602' },
  { name: 'Benton',        fips: 19011, url: 'http://beacon.schneidercorp.com/?site=BentonCountyIA' },
  { name: 'Black Hawk',    fips: 19013, url: 'https://beacon.schneidercorp.com/Application.aspx?App=BlackHawkCountyIA&PageType=Search' },
  { name: 'Boone',         fips: 19015, url: 'http://beacon.schneidercorp.com/?site=BooneCountyIA' },
  { name: 'Bremer',        fips: 19017, url: 'http://beacon.schneidercorp.com/?site=BremerCountyIA' },
  { name: 'Buchanan',      fips: 19019, url: 'https://beacon.schneidercorp.com/' },
  { name: 'Buena Vista',   fips: 19021, url: 'https://beacon.schneidercorp.com/Application.aspx?App=BuenaVistaCountyIA&PageType=Search' },
  { name: 'Butler',        fips: 19023, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=1300&LayerID=44496&PageTypeID=2&PageID=16788' },
  { name: 'Calhoun',       fips: 19025, url: 'http://calhoun.iowaassessors.com' },
  { name: 'Carroll',       fips: 19027, url: 'http://carroll.iowaassessors.com' },
  { name: 'Cass',          fips: 19029, url: 'https://beacon.schneidercorp.com/?site=CassCountyIA' },
  { name: 'Cedar',         fips: 19031, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=1233&LayerID=39179&PageTypeID=2&PageID=14567' },
  { name: 'Cerro Gordo',   fips: 19033, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=408&LayerID=6228&PageTypeID=2&PageID=3318' },
  { name: 'Cherokee',      fips: 19035, url: 'http://cherokee.iowaassessors.com' },
  { name: 'Chickasaw',     fips: 19037, url: 'https://beaconbeta.schneidercorp.com/Application.aspx?AppID=47&LayerID=261&PageTypeID=2&PageID=302' },
  { name: 'Clarke',        fips: 19039, url: 'http://clarke.iowaassessors.com' },
  { name: 'Clay',          fips: 19041, url: 'http://clay.iowaassessors.com' },
  { name: 'Clayton',       fips: 19043, url: 'http://beacon.schneidercorp.com/?site=ClaytonCountyIA' },
  { name: 'Clinton',       fips: 19045, url: 'http://clinton.iowaassessors.com/' },
  { name: 'Crawford',      fips: 19047, url: 'http://crawford.iowaassessors.com' },
  { name: 'Dallas',        fips: 19049, url: 'https://beacon.schneidercorp.com/?site=DallasCountyIA' },
  { name: 'Davis',         fips: 19051, url: 'http://beacon.schneidercorp.com/?site=DavisCountyIA' },
  { name: 'Decatur',       fips: 19053, url: 'http://decatur.iowaassessors.com/' },
  { name: 'Delaware',      fips: 19055, url: 'http://delaware.iowaassessors.com' },
  { name: 'Des Moines',    fips: 19057, url: 'http://desmoines.iowaassessors.com' },
  { name: 'Dickinson',     fips: 19059, url: 'http://dickinson.iowaassessors.com' },
  { name: 'Dubuque',       fips: 19061, url: 'https://www.dubuquecountyiowa.gov/159/Assessor---Dubuque-County' },
  { name: 'Emmet',         fips: 19063, url: 'http://beacon.schneidercorp.com/default.aspx?site=EmmetCountyIA' },
  { name: 'Fayette',       fips: 19065, url: 'http://beacon.schneidercorp.com/?site=FayetteCountyIA' },
  { name: 'Floyd',         fips: 19067, url: 'http://floyd.iowaassessors.com' },
  { name: 'Franklin',      fips: 19069, url: 'http://beacon.schneidercorp.com/?site=FranklinCountyIA' },
  { name: 'Fremont',       fips: 19071, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=825&LayerID=14967&PageTypeID=2&PageID=6729' },
  { name: 'Greene',        fips: 19073, url: 'https://beacon.schneidercorp.com/?site=GreeneCountyIA' },
  { name: 'Grundy',        fips: 19075, url: 'http://beacon.schneidercorp.com/?site=GrundyCountyIA' },
  { name: 'Guthrie',       fips: 19077, url: 'https://beacon.schneidercorp.com/?site=GuthrieCountyIA' },
  { name: 'Hamilton',      fips: 19079, url: 'https://www.hamiltoncounty.iowa.gov/departments/assessor/index.php' },
  { name: 'Hancock',       fips: 19081, url: 'http://hancock.iowaassessors.com' },
  { name: 'Hardin',        fips: 19083, url: 'http://beacon.schneidercorp.com/?site=HardinCountyIA' },
  { name: 'Harrison',      fips: 19085, url: 'http://beacon.schneidercorp.com/?site=HarrisonCountyIA' },
  { name: 'Henry',         fips: 19087, url: 'http://beacon.schneidercorp.com/?site=HenryCountyIA' },
  { name: 'Howard',        fips: 19089, url: 'http://howard.iowaassessors.com' },
  { name: 'Humboldt',      fips: 19091, url: 'http://humboldt.iowaassessors.com' },
  { name: 'Ida',           fips: 19093, url: 'http://ida.iowaassessors.com' },
  { name: 'Iowa',          fips: 19095, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=1126&LayerID=28385&PageTypeID=2&PageID=11829' },
  { name: 'Jackson',       fips: 19097, url: 'https://beaconbeta.schneidercorp.com/?site=JacksonCountyIA' },
  { name: 'Jasper',        fips: 19099, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=325&LayerID=3398&PageTypeID=2&PageID=2260' },
  { name: 'Jefferson',     fips: 19101, url: 'http://jefferson.iowaassessors.com' },
  { name: 'Johnson',       fips: 19103, url: 'http://beacon.schneidercorp.com/?site=JohnsonCountyIA' },
  { name: 'Jones',         fips: 19105, url: 'http://beacon.schneidercorp.com/?site=JonesCountyIA' },
  { name: 'Keokuk',        fips: 19107, url: 'http://beacon.schneidercorp.com/?site=KeokukCountyIA' },
  { name: 'Kossuth',       fips: 19109, url: 'http://kossuth.iowaassessors.com' },
  { name: 'Lee',           fips: 19111, url: 'http://beacon.schneidercorp.com/Application.aspx?AppID=177&LayerID=2207&PageTypeID=2&PageID=1132' },
  { name: 'Linn',          fips: 19113, url: 'http://linn.iowaassessors.com' },
  { name: 'Louisa',        fips: 19115, url: 'http://beacon.schneidercorp.com/?site=LouisaCountyIA' },
  { name: 'Lucas',         fips: 19117, url: 'http://lucas.iowaassessors.com' },
  { name: 'Lyon',          fips: 19119, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=594' },
  { name: 'Madison',       fips: 19121, url: 'http://madison.iowaassessors.com' },
  { name: 'Mahaska',       fips: 19123, url: 'http://beacon.schneidercorp.com/?site=MahaskaCountyIA' },
  { name: 'Marion',        fips: 19125, url: 'https://beacon.schneidercorp.com/' },
  { name: 'Marshall',      fips: 19127, url: 'https://beacon.schneidercorp.com/?site=MarshallCountyIA' },
  { name: 'Mills',         fips: 19129, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=153&LayerID=2009&PageTypeID=2&PageID=1025' },
  { name: 'Mitchell',      fips: 19131, url: 'http://mitchell.iowaassessors.com' },
  { name: 'Monona',        fips: 19133, url: 'http://monona.iowaassessors.com' },
  { name: 'Monroe',        fips: 19135, url: 'http://monroe.iowaassessors.com' },
  { name: 'Montgomery',    fips: 19137, url: 'https://montgomery.iowaassessors.com/' },
  { name: 'Muscatine',     fips: 19139, url: 'http://beacon.schneidercorp.com/?site=MuscatineCountyIA' },
  { name: "O'Brien",       fips: 19141, url: 'https://obrien.iowaassessors.com/' },
  { name: 'Osceola',       fips: 19143, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=611&LayerID=10180&PageTypeID=2&PageID=4439' },
  { name: 'Page',          fips: 19145, url: 'http://beacon.schneidercorp.com/?site=PageCountyIA' },
  { name: 'Palo Alto',     fips: 19147, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=218&LayerID=2977&PageTypeID=2&PageID=1615' },
  { name: 'Plymouth',      fips: 19149, url: 'http://plymouth.iowaassessors.com' },
  { name: 'Pocahontas',    fips: 19151, url: 'http://beacon.schneidercorp.com/?site=PocahontasCountyIA' },
  { name: 'Polk',          fips: 19153, url: 'https://www.assess.co.polk.ia.us/' },
  { name: 'Pottawattamie', fips: 19155, url: 'http://www.pottco.org' },
  { name: 'Poweshiek',     fips: 19157, url: 'http://beacon.schneidercorp.com/?site=PoweshiekCountyIA' },
  { name: 'Ringgold',      fips: 19159, url: 'https://beacon.schneidercorp.com/Application.aspx?AppId=508&LayerId=7874&PageTypeId=2&PageID=3842' },
  { name: 'Sac',           fips: 19161, url: 'http://beacon.schneidercorp.com/?site=SacCountyIA' },
  { name: 'Scott',         fips: 19163, url: 'http://www.scottcountyiowa.com/assessor/' },
  { name: 'Shelby',        fips: 19165, url: 'http://beacon.schneidercorp.com/?site=ShelbyCountyIA' },
  { name: 'Sioux',         fips: 19167, url: 'http://siouxcounty.org/departments/assessor/' },
  { name: 'Story',         fips: 19169, url: 'http://beacon.schneidercorp.com/?site=StoryCountyIA' },
  { name: 'Tama',          fips: 19171, url: 'http://tama.iowaassessors.com' },
  { name: 'Taylor',        fips: 19173, url: 'http://taylor.iowaassessors.com' },
  { name: 'Union',         fips: 19175, url: 'http://beacon.schneidercorp.com/?site=UnionCountyIA' },
  { name: 'Van Buren',     fips: 19177, url: 'http://vanburen.iowaassessors.com' },
  { name: 'Wapello',       fips: 19179, url: 'http://wapello.iowaassessors.com' },
  { name: 'Warren',        fips: 19181, url: 'http://beacon.schneidercorp.com/?site=WarrenCountyIA' },
  { name: 'Washington',    fips: 19183, url: 'http://washington.iowaassessors.com' },
  { name: 'Wayne',         fips: 19185, url: 'http://wayne.iowaassessors.com' },
  { name: 'Webster',       fips: 19187, url: 'https://beacon.schneidercorp.com/?site=WebsterCountyIA' },
  { name: 'Winnebago',     fips: 19189, url: 'http://beacon.schneidercorp.com/?site=WinnebagoCountyIA' },
  { name: 'Winneshiek',    fips: 19191, url: 'http://beacon.schneidercorp.com/?site=WinneshiekCountyIA' },
  { name: 'Woodbury',      fips: 19193, url: 'http://beacon.schneidercorp.com/?site=WoodburyCountyIA' },
  { name: 'Worth',         fips: 19195, url: 'http://worth.iowaassessors.com' },
  { name: 'Wright',        fips: 19197, url: 'https://beacon.schneidercorp.com/?site=WrightCountyIA' },
];

// Major Iowa cities have separate city assessors (for properties inside city limits)
const IOWA_CITY_ASSESSORS = [
  { name: 'Cedar Rapids (City)',  fips: 19113, url: 'http://cedarrapids.iowaassessors.com' },
  { name: 'Davenport (City)',     fips: 19163, url: 'http://cityofdavenportiowa.com/cms/one.aspx?portalId=6481456&pageId=7653290' },
  { name: 'Dubuque (City)',       fips: 19061, url: 'https://www.dubuquecountyiowa.gov/155/Assessor---City-of-Dubuque' },
  { name: 'Iowa City (City)',     fips: 19103, url: 'http://iowacity.iowaassessors.com/' },
  { name: 'Mason City (City)',    fips: 19033, url: 'http://www.masoncityassessor.net' },
];

// ── Nebraska county data ──────────────────────────────────────────────────────

const NEBRASKA_COUNTIES = [
  { name: 'Adams',       fips: 31001, url: 'http://adams.nebraskaassessors.com' },
  { name: 'Antelope',    fips: 31003, url: 'https://antelopecounty.nebraska.gov/county-assessor' },
  { name: 'Arthur',      fips: 31005, url: 'https://arthur.gworks.com/' },
  { name: 'Banner',      fips: 31007, url: 'https://bannercountyne.gov/government/officials/assessor' },
  { name: 'Blaine',      fips: 31009, url: 'https://blaine.gworks.com/' },
  { name: 'Boone',       fips: 31011, url: 'https://boone.gworks.com/' },
  { name: 'Box Butte',   fips: 31013, url: 'http://boxbutte.assessor.gisworkshop.com/' },
  { name: 'Boyd',        fips: 31015, url: 'https://boyd.gworks.com/' },
  { name: 'Brown',       fips: 31017, url: 'http://brown.gisworkshop.com/' },
  { name: 'Buffalo',     fips: 31019, url: 'https://buffalocounty.ne.gov/ASSESSOR' },
  { name: 'Burt',        fips: 31021, url: 'http://www.burtcounty.ne.gov/webpages/assessor/assessor.html' },
  { name: 'Butler',      fips: 31023, url: 'http://butler.gisworkshop.com/' },
  { name: 'Cass',        fips: 31025, url: 'https://www.casscountyne.gov/county-assessor' },
  { name: 'Cedar',       fips: 31027, url: 'http://cedar.gisworkshop.com/' },
  { name: 'Chase',       fips: 31029, url: 'https://chase.nebraskaassessors.com/' },
  { name: 'Cherry',      fips: 31031, url: 'https://beacon.schneidercorp.com/Application.aspx?App=CherryCountyNE&PageType=Search' },
  { name: 'Cheyenne',    fips: 31033, url: 'http://cheyenne.gisworkshop.com/' },
  { name: 'Clay',        fips: 31035, url: 'http://clay.assessor.gisworkshop.com/' },
  { name: 'Colfax',      fips: 31037, url: 'http://www.colfaxne.com/webpages/assessor/assessor.html' },
  { name: 'Cuming',      fips: 31039, url: 'https://cumingcountyne.gov/assessor/' },
  { name: 'Custer',      fips: 31041, url: 'http://www.co.custer.ne.us/webpages/assessor/assessor.html' },
  { name: 'Dakota',      fips: 31043, url: 'http://dakota.gisworkshop.com/' },
  { name: 'Dawes',       fips: 31045, url: 'https://dawes.gworks.com/?&t=assessor/' },
  { name: 'Dawson',      fips: 31047, url: 'http://dawson.gisworkshop.com/' },
  { name: 'Deuel',       fips: 31049, url: 'https://deuel.gworks.com/' },
  { name: 'Dixon',       fips: 31051, url: 'http://www.co.dixon.ne.us/webpages/assessor/assessor.html' },
  { name: 'Dodge',       fips: 31053, url: 'http://dodge.nebraskaassessors.com' },
  { name: 'Douglas',     fips: 31055, url: 'http://www.dcassessor.org/' },
  { name: 'Dundy',       fips: 31057, url: 'https://dundycounty.nebraska.gov/webpages/assessor/assessor.html' },
  { name: 'Fillmore',    fips: 31059, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=1265&LayerID=42728&PageTypeID=2&PageID=15630' },
  { name: 'Franklin',    fips: 31061, url: 'https://franklin.gworks.com/' },
  { name: 'Frontier',    fips: 31063, url: 'http://frontier.nebraskaassessors.com' },
  { name: 'Furnas',      fips: 31065, url: 'https://furnascounty.ne.gov/webpages/assessor/assessor.html' },
  { name: 'Gage',        fips: 31067, url: 'http://gage.assessor.gisworkshop.com/' },
  { name: 'Garden',      fips: 31069, url: 'http://garden.gisworkshop.com/' },
  { name: 'Garfield',    fips: 31071, url: 'http://garfield.gisworkshop.com/' },
  { name: 'Gosper',      fips: 31073, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=1274&LayerID=43594&PageTypeID=2&PageID=15887' },
  { name: 'Grant',       fips: 31075, url: 'http://grant.gisworkshop.com/' },
  { name: 'Greeley',     fips: 31077, url: 'http://greeley.gisworkshop.com/' },
  { name: 'Hall',        fips: 31079, url: 'https://www.hallcountyne.gov/departments/assessor/index.php' },
  { name: 'Hamilton',    fips: 31081, url: 'http://hamilton.gisworkshop.com/' },
  { name: 'Harlan',      fips: 31083, url: 'http://harlan.gisworkshop.com/' },
  { name: 'Hayes',       fips: 31085, url: 'http://www.hayes.assessor.gisworkshop.com/' },
  { name: 'Hitchcock',   fips: 31087, url: 'http://hitchcock.gisworkshop.com/' },
  { name: 'Holt',        fips: 31089, url: 'http://holt.nebraskaassessors.com' },
  { name: 'Hooker',      fips: 31091, url: 'https://hooker.gworks.com/' },
  { name: 'Howard',      fips: 31093, url: 'http://howard.gisworkshop.com/' },
  { name: 'Jefferson',   fips: 31095, url: 'https://jeffersoncounty.nebraska.gov/assessor' },
  { name: 'Johnson',     fips: 31097, url: 'http://johnson.gisworkshop.com/' },
  { name: 'Kearney',     fips: 31099, url: 'http://kearney.gisworkshop.com/' },
  { name: 'Keith',       fips: 31101, url: 'http://keith.gisworkshop.com/' },
  { name: 'Keya Paha',   fips: 31103, url: 'http://keyapaha.gisworkshop.com/' },
  { name: 'Kimball',     fips: 31105, url: 'http://kimball.assessor.gisworkshop.com/' },
  { name: 'Knox',        fips: 31107, url: 'http://knox.gisworkshop.com/' },
  { name: 'Lancaster',   fips: 31109, url: 'http://orion.lancaster.ne.gov/Appraisal/PublicAccess/' },
  { name: 'Lincoln',     fips: 31111, url: 'http://lincoln.gisworkshop.com/' },
  { name: 'Logan',       fips: 31113, url: 'https://logan.gworks.com/' },
  { name: 'Loup',        fips: 31115, url: 'https://loup.gworks.com/?&t=assessor/' },
  { name: 'Madison',     fips: 31117, url: 'http://madison.gisworkshop.com/' },
  { name: 'McPherson',   fips: 31119, url: 'https://mcpherson.gworks.com/' },
  { name: 'Merrick',     fips: 31121, url: 'http://merrick.gisworkshop.com/' },
  { name: 'Morrill',     fips: 31123, url: 'http://www.morrillcountyne.gov/assessor.html' },
  { name: 'Nance',       fips: 31125, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=1229&LayerID=39090&PageTypeID=1&PageID=14515' },
  { name: 'Nemaha',      fips: 31127, url: 'http://nemaha.nebraskaassessors.com/' },
  { name: 'Nuckolls',    fips: 31129, url: 'http://nuckolls.gisworkshop.com/' },
  { name: 'Otoe',        fips: 31131, url: 'http://otoe.nebraskaassessors.com/' },
  { name: 'Pawnee',      fips: 31133, url: 'http://pawnee.gisworkshop.com/' },
  { name: 'Perkins',     fips: 31135, url: 'https://perkins.gworks.com/' },
  { name: 'Phelps',      fips: 31137, url: 'http://phelps.gisworkshop.com/' },
  { name: 'Pierce',      fips: 31139, url: 'http://pierce.assessor.gisworkshop.com/' },
  { name: 'Platte',      fips: 31141, url: 'http://platte.gisworkshop.com/' },
  { name: 'Polk',        fips: 31143, url: 'http://polk.gisworkshop.com/' },
  { name: 'Red Willow',  fips: 31145, url: 'http://redwillow.gisworkshop.com/' },
  { name: 'Richardson',  fips: 31147, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=1312&LayerID=44856&PageTypeID=2&PageID=17241' },
  { name: 'Rock',        fips: 31149, url: 'http://rock.assessor.gisworkshop.com/' },
  { name: 'Saline',      fips: 31151, url: 'http://saline.assessor.gisworkshop.com/' },
  { name: 'Sarpy',       fips: 31153, url: 'https://www.sarpy.gov/159/Assessor' },
  { name: 'Saunders',    fips: 31155, url: 'http://saunders.nebraskaassessors.com/' },
  { name: 'Scotts Bluff',fips: 31157, url: 'https://scottsbluffcountyne.gov/county-assessor/' },
  { name: 'Seward',      fips: 31159, url: 'http://seward.nebraskaassessors.com' },
  { name: 'Sheridan',    fips: 31161, url: 'http://sheridan.gisworkshop.com/' },
  { name: 'Sherman',     fips: 31163, url: 'http://sherman.assessor.gisworkshop.com/' },
  { name: 'Sioux',       fips: 31165, url: 'http://sioux.gisworkshop.com/' },
  { name: 'Stanton',     fips: 31167, url: 'https://beacon.schneidercorp.com/Application.aspx?AppID=1258&LayerID=41213&PageTypeID=2&PageID=15250' },
  { name: 'Thayer',      fips: 31169, url: 'http://thayer.nebraskaassessors.com' },
  { name: 'Thomas',      fips: 31171, url: 'http://thomas.assessor.gisworkshop.com/' },
  { name: 'Thurston',    fips: 31173, url: 'http://thurston.gisworkshop.com/' },
  { name: 'Valley',      fips: 31175, url: 'https://valley.gworks.com/' },
  { name: 'Washington',  fips: 31177, url: 'http://www.co.washington.ne.us/assessor.html' },
  { name: 'Wayne',       fips: 31179, url: 'http://www.waynecountyne.org/index.aspx?nid=96' },
  { name: 'Webster',     fips: 31181, url: 'http://webster.gisworkshop.com/' },
  { name: 'Wheeler',     fips: 31183, url: 'http://www.wheelercounty.ne.gov/webpages/assessor/assessor.html' },
  { name: 'York',        fips: 31185, url: 'http://york.nebraskaassessors.com/' },
];

// ── Georgia county data ───────────────────────────────────────────────────────

const GEORGIA_COUNTIES = [
  { name: 'Appling',       fips: 13001, url: 'http://www.qpublic.net/ga/appling/index.html' },
  { name: 'Atkinson',      fips: 13003, url: 'http://www.qpublic.net/ga/atkinson/index.html' },
  { name: 'Bacon',         fips: 13005, url: 'http://qpublic.net/ga/bacon/' },
  { name: 'Baker',         fips: 13007, url: 'http://qpublic.net/ga/baker/' },
  { name: 'Baldwin',       fips: 13009, url: 'http://qpublic.net/ga/baldwin/' },
  { name: 'Banks',         fips: 13011, url: 'https://www.bankscountyga.org/1602/Record-Search' },
  { name: 'Barrow',        fips: 13013, url: 'http://www.qpublic.net/ga/barrow/' },
  { name: 'Bartow',        fips: 13015, url: 'http://www.qpublic.net/ga/bartow/' },
  { name: 'Ben Hill',      fips: 13017, url: 'http://www.qpublic.net/ga/benhill/' },
  { name: 'Berrien',       fips: 13019, url: 'http://qpublic.net/ga/berrien/' },
  { name: 'Bibb',          fips: 13021, url: 'https://www.maconbibbtax.us/#/' },
  { name: 'Bleckley',      fips: 13023, url: 'http://www.qpublic.net/ga/bleckley/' },
  { name: 'Brantley',      fips: 13025, url: 'http://qpublic.net/ga/brantley/' },
  { name: 'Brooks',        fips: 13027, url: 'http://qpublic.net/ga/brooks/' },
  { name: 'Bryan',         fips: 13029, url: 'http://qpublic.net/ga/bryan/' },
  { name: 'Bulloch',       fips: 13031, url: 'https://bullochcounty.net/tax-commissioner/' },
  { name: 'Burke',         fips: 13033, url: 'http://qpublic.net/ga/burke/' },
  { name: 'Butts',         fips: 13035, url: 'http://www.qpublic.net/ga/butts/' },
  { name: 'Calhoun',       fips: 13037, url: 'http://qpublic.net/ga/calhoun/' },
  { name: 'Camden',        fips: 13039, url: 'http://qpublic.net/ga/camden/' },
  { name: 'Candler',       fips: 13041, url: 'http://qpublic.net/ga/candler/' },
  { name: 'Carroll',       fips: 13043, url: 'http://qpublic.net/ga/carroll/' },
  { name: 'Catoosa',       fips: 13045, url: 'http://qpublic.net/ga/catoosa/' },
  { name: 'Charlton',      fips: 13047, url: 'http://qpublic.net/ga/charlton/' },
  { name: 'Chatham',       fips: 13049, url: 'https://boa.chathamcounty.org/' },
  { name: 'Chattahoochee', fips: 13051, url: 'http://www.qpublic.net/ga/chattahoochee/' },
  { name: 'Chattooga',     fips: 13053, url: 'http://qpublic.net/ga/chattooga/' },
  { name: 'Cherokee',      fips: 13055, url: 'https://www.qpublic.net/ga/cherokee/' },
  { name: 'Clarke',        fips: 13057, url: 'http://www.qpublic.net/ga/clarke/' },
  { name: 'Clay',          fips: 13059, url: 'http://qpublic.net/ga/clay/' },
  { name: 'Clayton',       fips: 13061, url: 'https://www.claytoncountyga.gov/government/tax-assessor/property-search-information' },
  { name: 'Clinch',        fips: 13063, url: 'http://qpublic.net/ga/clinch/' },
  { name: 'Cobb',          fips: 13065, url: 'https://cobbassessor.org/' },
  { name: 'Coffee',        fips: 13067, url: 'http://coffeecountygov.com/' },
  { name: 'Colquitt',      fips: 13069, url: 'http://qpublic.net/ga/colquitt/' },
  { name: 'Columbia',      fips: 13071, url: 'https://www.columbiacountyga.gov/157/Tax-Commissioner' },
  { name: 'Cook',          fips: 13073, url: 'http://qpublic.net/ga/cook/' },
  { name: 'Coweta',        fips: 13075, url: 'https://www.coweta.ga.us/departments-services/departments-r-z/tax-assessors-office' },
  { name: 'Crawford',      fips: 13077, url: 'http://www.qpublic.net/ga/crawford/' },
  { name: 'Crisp',         fips: 13079, url: 'http://qpublic.net/ga/crisp/' },
  { name: 'Dade',          fips: 13081, url: 'http://qpublic.net/ga/dade/' },
  { name: 'Dawson',        fips: 13083, url: 'https://qpublic.schneidercorp.com/Application.aspx?App=DawsonCountyGA&Layer=Parcels&PageType=Search' },
  { name: 'Decatur',       fips: 13085, url: 'http://qpublic.net/ga/decatur/' },
  { name: 'DeKalb',        fips: 13087, url: 'https://publicaccess.dekalbtax.org/search/commonsearch.aspx?mode=realprop' },
  { name: 'Dodge',         fips: 13089, url: 'http://www.qpublic.net/ga/dodge/' },
  { name: 'Dooly',         fips: 13091, url: 'http://www.qpublic.net/ga/dooly/' },
  { name: 'Dougherty',     fips: 13093, url: 'http://www.qpublic.net/ga/dougherty/' },
  { name: 'Douglas',       fips: 13095, url: 'http://qpublic.net/ga/douglas/' },
  { name: 'Early',         fips: 13097, url: 'http://qpublic.net/ga/early/' },
  { name: 'Echols',        fips: 13099, url: 'http://qpublic.net/ga/echols/' },
  { name: 'Effingham',     fips: 13101, url: 'http://www.qpublic.net/ga/effingham/' },
  { name: 'Elbert',        fips: 13103, url: 'http://qpublic.net/ga/elbert/' },
  { name: 'Emanuel',       fips: 13105, url: 'http://www.qpublic.net/ga/emanuel/' },
  { name: 'Evans',         fips: 13107, url: 'http://www.qpublic.net/ga/evans/' },
  { name: 'Fannin',        fips: 13109, url: 'http://www.qpublic.net/ga/fannin/' },
  { name: 'Fayette',       fips: 13111, url: 'http://www.fayettecountyga.gov/assessors_office/mapping.htm' },
  { name: 'Floyd',         fips: 13113, url: 'https://www.floydcountytax.com/' },
  { name: 'Forsyth',       fips: 13115, url: 'http://www.qpublic.net/ga/forsyth/' },
  { name: 'Franklin',      fips: 13117, url: 'http://www.qpublic.net/ga/franklin/' },
  { name: 'Fulton',        fips: 13119, url: 'http://fultonassessor.org/' },
  { name: 'Gilmer',        fips: 13121, url: 'http://www.gilmerassessors.com/' },
  { name: 'Glascock',      fips: 13123, url: 'http://qpublic.net/ga/glascock/' },
  { name: 'Glynn',         fips: 13125, url: 'http://qpublic.net/ga/glynn/' },
  { name: 'Gordon',        fips: 13127, url: 'http://qpublic.net/ga/gordon/' },
  { name: 'Grady',         fips: 13129, url: 'http://qpublic.net/ga/grady/' },
  { name: 'Greene',        fips: 13131, url: 'http://qpublic.net/ga/greene/' },
  { name: 'Gwinnett',      fips: 13133, url: 'http://www.gwinnettcounty.com' },
  { name: 'Habersham',     fips: 13135, url: 'http://www.qpublic.net/ga/habersham/index.html' },
  { name: 'Hall',          fips: 13137, url: 'https://qpublic.schneidercorp.com/Application.aspx?App=HallCountyGA&Layer=Parcels&PageType=Search' },
  { name: 'Hancock',       fips: 13139, url: 'http://www.qpublic.net/ga/hancock/' },
  { name: 'Haralson',      fips: 13141, url: 'http://qpublic.net/ga/haralson/' },
  { name: 'Harris',        fips: 13143, url: 'http://qpublic.net/ga/harris/' },
  { name: 'Hart',          fips: 13145, url: 'http://qpublic.net/ga/hart/' },
  { name: 'Heard',         fips: 13147, url: 'http://www.qpublic.net/ga/heard/' },
  { name: 'Henry',         fips: 13149, url: 'http://www.qpublic.net/ga/henry/' },
  { name: 'Houston',       fips: 13151, url: 'http://www.qpublic.net/ga/houston/' },
  { name: 'Irwin',         fips: 13153, url: 'http://www.qpublic.net/ga/irwin/' },
  { name: 'Jackson',       fips: 13155, url: 'http://www.qpublic.net/ga/jackson/' },
  { name: 'Jasper',        fips: 13157, url: 'http://qpublic.net/ga/jasper/' },
  { name: 'Jeff Davis',    fips: 13159, url: 'http://www.qpublic.net/ga/jeffdavis/' },
  { name: 'Jefferson',     fips: 13161, url: 'http://qpublic.net/ga/jefferson/' },
  { name: 'Jenkins',       fips: 13163, url: 'http://qpublic.net/ga/jenkins/' },
  { name: 'Johnson',       fips: 13165, url: 'http://www.qpublic.net/ga/johnson/' },
  { name: 'Jones',         fips: 13167, url: 'https://qpublic.schneidercorp.com/Application.aspx?App=JonesCountyGA&Layer=Parcels&PageType=Search' },
  { name: 'Lamar',         fips: 13169, url: 'http://www.qpublic.net/ga/lamar/' },
  { name: 'Lanier',        fips: 13171, url: 'http://qpublic.net/ga/lanier/' },
  { name: 'Laurens',       fips: 13173, url: 'http://qpublic.net/ga/laurens/' },
  { name: 'Lee',           fips: 13175, url: 'http://www.qpublic.net/ga/lee/' },
  { name: 'Liberty',       fips: 13177, url: 'http://www.libertycountyga.com/101/Services' },
  { name: 'Lincoln',       fips: 13179, url: 'http://qpublic.net/ga/lincoln/' },
  { name: 'Long',          fips: 13181, url: 'http://www.qpublic.net/ga/long/' },
  { name: 'Lowndes',       fips: 13183, url: 'http://qpublic.net/ga/lowndes/' },
  { name: 'Lumpkin',       fips: 13185, url: 'https://qpublic.schneidercorp.com/Application.aspx?App=LumpkinCountyGA&Layer=Parcels&PageType=Search' },
  { name: 'Macon',         fips: 13187, url: 'http://qpublic.net/ga/macon/' },
  { name: 'Madison',       fips: 13189, url: 'http://qpublic.net/ga/madison/' },
  { name: 'Marion',        fips: 13191, url: 'http://qpublic.net/ga/marion/' },
  { name: 'McDuffie',      fips: 13193, url: 'http://qpublic.net/ga/mcduffie/' },
  { name: 'McIntosh',      fips: 13195, url: 'http://www.qpublic.net/ga/mcintosh/' },
  { name: 'Meriwether',    fips: 13197, url: 'http://www.qpublic.net/ga/meriwether/' },
  { name: 'Miller',        fips: 13199, url: 'http://qpublic.net/ga/miller/' },
  { name: 'Mitchell',      fips: 13201, url: 'http://qpublic.net/ga/mitchell/' },
  { name: 'Monroe',        fips: 13203, url: 'http://www.qpublic.net/ga/monroe/' },
  { name: 'Montgomery',    fips: 13205, url: 'http://qpublic.net/ga/montgomery/' },
  { name: 'Morgan',        fips: 13207, url: 'http://qpublic.net/ga/morgan/' },
  { name: 'Murray',        fips: 13209, url: 'http://qpublic.net/ga/murray/' },
  { name: 'Muscogee',      fips: 13211, url: 'https://www.columbusga.org/TaxAssessors/' },
  { name: 'Newton',        fips: 13213, url: 'http://www.qpublic.net/ga/newton/' },
  { name: 'Oconee',        fips: 13215, url: 'http://qpublic.net/ga/oconee/' },
  { name: 'Oglethorpe',    fips: 13217, url: 'http://qpublic.net/ga/oglethorpe/' },
  { name: 'Paulding',      fips: 13219, url: 'http://www.paulding.gov/index.aspx' },
  { name: 'Peach',         fips: 13221, url: 'http://www.qpublic.net/ga/peach/' },
  { name: 'Pickens',       fips: 13223, url: 'http://qpublic.net/ga/pickens/' },
  { name: 'Pierce',        fips: 13225, url: 'http://qpublic.net/ga/pierce/' },
  { name: 'Pike',          fips: 13227, url: 'http://www.qpublic.net/ga/pike/' },
  { name: 'Polk',          fips: 13229, url: 'http://www.qpublic.net/ga/polk/' },
  { name: 'Pulaski',       fips: 13231, url: 'http://qpublic.net/ga/pulaski/' },
  { name: 'Putnam',        fips: 13233, url: 'http://qpublic.net/ga/putnam/' },
  { name: 'Quitman',       fips: 13235, url: 'http://qpublic.net/ga/quitman/' },
  { name: 'Rabun',         fips: 13237, url: 'http://www.qpublic.net/ga/rabun/' },
  { name: 'Randolph',      fips: 13239, url: 'http://qpublic.net/ga/randolph/' },
  { name: 'Richmond',      fips: 13241, url: 'https://www.augustaga.gov/742/Tax-Assessor' },
  { name: 'Rockdale',      fips: 13243, url: 'https://qpublic.schneidercorp.com/Application.aspx?App=RockdaleCountyGA&Layer=Parcels&PageType=Search' },
  { name: 'Schley',        fips: 13245, url: 'http://qpublic.net/ga/schley/' },
  { name: 'Screven',       fips: 13247, url: 'http://qpublic.net/ga/screven/' },
  { name: 'Seminole',      fips: 13249, url: 'http://qpublic.net/ga/seminole/' },
  { name: 'Spalding',      fips: 13251, url: 'http://www.qpublic.net/ga/spalding/' },
  { name: 'Stephens',      fips: 13253, url: 'http://qpublic.net/ga/stephens/' },
  { name: 'Stewart',       fips: 13255, url: 'http://www.qpublic.net/ga/stewart/' },
  { name: 'Sumter',        fips: 13257, url: 'http://www.qpublic.net/ga/sumter/' },
  { name: 'Talbot',        fips: 13259, url: 'http://qpublic.net/ga/talbot/' },
  { name: 'Taliaferro',    fips: 13261, url: 'http://qpublic.net/ga/taliaferro/' },
  { name: 'Tattnall',      fips: 13263, url: 'http://www.qpublic.net/ga/tattnall/' },
  { name: 'Taylor',        fips: 13265, url: 'http://qpublic.net/ga/taylor/' },
  { name: 'Telfair',       fips: 13267, url: 'http://qpublic.net/ga/telfair/' },
  { name: 'Terrell',       fips: 13269, url: 'http://qpublic.net/ga/terrell/' },
  { name: 'Thomas',        fips: 13271, url: 'http://qpublic.net/ga/thomas/' },
  { name: 'Tift',          fips: 13273, url: 'http://www.qpublic.net/ga/tift/' },
  { name: 'Toombs',        fips: 13275, url: 'http://www.qpublic.net/ga/toombs/' },
  { name: 'Towns',         fips: 13277, url: 'http://qpublic.net/ga/towns/' },
  { name: 'Treutlen',      fips: 13279, url: 'http://qpublic.net/ga/treutlen/' },
  { name: 'Troup',         fips: 13281, url: 'http://qpublic.net/ga/troup/' },
  { name: 'Turner',        fips: 13283, url: 'http://qpublic.net/ga/turner/' },
  { name: 'Twiggs',        fips: 13285, url: 'http://www.qpublic.net/ga/twiggs/' },
  { name: 'Union',         fips: 13287, url: 'http://www.qpublic.net/ga/union/' },
  { name: 'Upson',         fips: 13289, url: 'http://qpublic.net/ga/upson/' },
  { name: 'Walker',        fips: 13291, url: 'http://www.qpublic.net/ga/walker/' },
  { name: 'Walton',        fips: 13293, url: 'http://www.qpublic.net/ga/walton/' },
  { name: 'Ware',          fips: 13295, url: 'http://qpublic.net/ga/ware/' },
  { name: 'Warren',        fips: 13297, url: 'http://qpublic.net/ga/warren/' },
  { name: 'Washington',    fips: 13299, url: 'http://www.qpublic.net/ga/washington/' },
  { name: 'Wayne',         fips: 13301, url: 'http://qpublic.net/ga/wayne/' },
  { name: 'Webster',       fips: 13303, url: 'http://qpublic.net/ga/webster/' },
  { name: 'Wheeler',       fips: 13305, url: 'http://qpublic.net/ga/wheeler/' },
  { name: 'White',         fips: 13307, url: 'http://qpublic.net/ga/white/' },
  { name: 'Whitfield',     fips: 13309, url: 'https://www.whitfieldpay.com/' },
  { name: 'Wilcox',        fips: 13311, url: 'http://qpublic.net/ga/wilcox/' },
  { name: 'Wilkes',        fips: 13313, url: 'http://qpublic.net/ga/wilkes/' },
  { name: 'Wilkinson',     fips: 13315, url: 'http://www.qpublic.net/ga/wilkinson/' },
  { name: 'Worth',         fips: 13317, url: 'http://qpublic.net/ga/worth/' },
];

// ── State selector state ──────────────────────────────────────────────────────

let _stateCurrentFips    = null;
let _currentStateCounties = [];
let _currentCityAssessors = [];
let _stateSelectSetup     = false;

// ── County select setup (wires change handler once) ───────────────────────────

function setupParcelsRegionSelector() {
  if (_stateSelectSetup) return;
  _stateSelectSetup = true;

  const sel = document.getElementById('state-county-select');
  if (!sel) return;

  sel.addEventListener('change', () => {
    const val = sel.value;
    if (!val) return;
    const entry = val.startsWith('city')
      ? _currentCityAssessors[parseInt(val.slice(4), 10)]
      : _currentStateCounties[parseInt(val, 10)];
    if (entry) loadStateCounty(entry);
  });
}

// ── Switch views ──────────────────────────────────────────────────────────────

function switchToClarkView() {
  document.getElementById('state-county-row').style.display  = 'none';
  document.getElementById('state-info-panel').style.display  = 'none';
  const sub = document.getElementById('parcels-subtitle');
  if (sub) sub.textContent = 'Parcels ≥ 100 acres within 1 mile of high-voltage transmission infrastructure. Owner details via Clark County Assessor.';
  document.getElementById('parcels-count').textContent  = '';
  document.getElementById('parcels-status').textContent = '';
  document.getElementById('parcels-table-panel').style.display = 'none';
  d3.select('#parcels-map').selectAll('*').remove();
  _stateCurrentFips = null;
  _parcelsLoaded    = false;
  initParcelsView();
}

// Populate the county dropdown and switch to state parcel view.
// counties: array of {name, fips, url}; cityAssessors: optional supplemental array
function switchToStateView(stateLabel, counties, cityAssessors) {
  _currentStateCounties = counties;
  _currentCityAssessors = cityAssessors || [];

  const sel = document.getElementById('state-county-select');
  if (sel) {
    sel.innerHTML = '<option value="">— select a county —</option>';
    const cGroup = document.createElement('optgroup');
    cGroup.label = stateLabel + ' Counties';
    counties.forEach((c, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = c.name + ' County';
      cGroup.appendChild(opt);
    });
    sel.appendChild(cGroup);
    if (_currentCityAssessors.length) {
      const vGroup = document.createElement('optgroup');
      vGroup.label = 'City Assessors';
      _currentCityAssessors.forEach((c, i) => {
        const opt = document.createElement('option');
        opt.value = 'city' + i;
        opt.textContent = c.name;
        vGroup.appendChild(opt);
      });
      sel.appendChild(vGroup);
    }
  }

  document.getElementById('state-county-row').style.display   = 'flex';
  document.getElementById('parcels-table-panel').style.display = 'none';
  const sub = document.getElementById('parcels-subtitle');
  if (sub) sub.textContent = `Select a county to view 345/500 kV transmission lines and open the ${stateLabel} county assessor for parcel research.`;
  document.getElementById('parcels-count').textContent  = '';
  document.getElementById('parcels-status').textContent = '';
  d3.select('#parcels-map').selectAll('*').remove();

  const panel = document.getElementById('state-info-panel');
  if (panel) panel.style.display = '';
  document.getElementById('state-tx-summary').textContent   = 'Select a county from the dropdown above to load transmission data.';
  document.getElementById('state-assessor-cta').style.display = 'none';
  document.getElementById('state-assessor-btn').style.display = 'none';
  document.getElementById('state-platform-note').textContent  = '';
}

// ── County load ───────────────────────────────────────────────────────────────

async function loadStateCounty(county) {
  _stateCurrentFips = county.fips;
  const thisFips    = county.fips;

  const statusEl  = document.getElementById('parcels-status');
  const countEl   = document.getElementById('parcels-count');
  const setStatus = msg => { if (statusEl) statusEl.textContent = msg; };

  const assessorBtn = document.getElementById('state-assessor-btn');
  if (assessorBtn) { assessorBtn.href = county.url; assessorBtn.style.display = ''; }
  const ctaLink = document.getElementById('state-assessor-cta');
  if (ctaLink) { ctaLink.href = county.url; ctaLink.style.display = 'none'; }

  document.getElementById('state-info-panel').style.display = '';
  document.getElementById('state-tx-summary').textContent   = '';

  try {
    setStatus('Loading county boundary…');

    let topo = typeof _countiesTopojson !== 'undefined' ? _countiesTopojson : null;
    if (!topo) topo = await d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json');

    if (thisFips !== _stateCurrentFips) return;

    const countiesGeo   = topojson.feature(topo, topo.objects.counties);
    const countyFeature = countiesGeo.features.find(f => +f.id === county.fips);
    if (!countyFeature) {
      setStatus(`County boundary not found (FIPS ${county.fips})`);
      return;
    }

    const bounds = d3.geoBounds(countyFeature);
    const pad    = 0.05;
    const bbox   = {
      xmin: bounds[0][0] - pad, ymin: bounds[0][1] - pad,
      xmax: bounds[1][0] + pad, ymax: bounds[1][1] + pad,
    };

    setStatus(`Fetching 345/500 kV lines for ${county.name}…`);
    const lines = await fetchHifldLines(bbox);

    if (thisFips !== _stateCurrentFips) return;

    setStatus('');

    const n = lines.length;
    if (countEl) countEl.textContent = n
      ? `${n} line segment${n !== 1 ? 's' : ''} (345/500 kV) — ${county.name} County`
      : `No 345/500 kV lines in ${county.name} County`;

    const summary = document.getElementById('state-tx-summary');
    if (summary) summary.textContent = n
      ? `Found ${n} high-voltage segment${n !== 1 ? 's' : ''} crossing ${county.name} County. Use the assessor portal to identify large parcels within 1 mile of these corridors.`
      : `No 345/500 kV transmission lines found in ${county.name} County. Use the assessor portal to search for parcels — lower-voltage infrastructure or nearby county lines may still apply.`;

    if (ctaLink) ctaLink.style.display = '';

    renderStateCountyMap(lines, countyFeature, county.name);

    const note = document.getElementById('state-platform-note');
    if (note) note.textContent = platformNote(county.url);

  } catch (e) {
    setStatus(`Error: ${e.message}`);
    console.error('County load:', e);
  }
}

function platformNote(url) {
  if (url.includes('schneidercorp') || url.includes('beacon'))
    return 'Portal: Beacon Schneidercorp GIS platform.';
  if (url.includes('iowaassessors'))
    return 'Portal: Iowa State Association of Assessors platform.';
  if (url.includes('nebraskaassessors'))
    return 'Portal: Nebraska Assessors platform.';
  if (url.includes('gisworkshop') || url.includes('gworks'))
    return 'Portal: GIS Workshop platform.';
  if (url.includes('qpublic.net'))
    return 'Portal: QPublic GIS platform.';
  return 'County-operated assessor portal.';
}

// ── Shared HIFLD fetch ────────────────────────────────────────────────────────

async function fetchHifldLines(bbox) {
  const { xmin, ymin, xmax, ymax } = bbox;
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

// ── County D3 map (shared for all state views) ────────────────────────────────

function renderStateCountyMap(lines, countyFeature, countyName) {
  const wrapper = document.getElementById('parcels-map-wrapper');
  const svg     = d3.select('#parcels-map');
  if (!wrapper || svg.empty()) return;

  svg.selectAll('*').remove();
  const W = wrapper.clientWidth  || 640;
  const H = wrapper.clientHeight || 480;
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');

  const countyFC   = { type: 'FeatureCollection', features: [countyFeature] };
  const projection = d3.geoMercator().fitExtent([[20, 20], [W - 20, H - 20]], countyFC);
  const path       = d3.geoPath().projection(projection);
  const g          = svg.append('g');

  g.append('path')
    .datum(countyFeature)
    .attr('d', path)
    .attr('fill', '#1e3a5f')
    .attr('stroke', 'rgba(255,255,255,0.3)')
    .attr('stroke-width', 1);

  const [cx, cy] = path.centroid(countyFeature);
  if (isFinite(cx) && isFinite(cy)) {
    g.append('text')
      .attr('x', cx).attr('y', cy)
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
      .attr('fill', 'rgba(255,255,255,0.35)')
      .attr('font-size', 13).attr('font-weight', 500)
      .attr('pointer-events', 'none')
      .text(countyName + ' County');
  }

  const voltColors = { '345': '#f59e0b', '500': '#f97316', '765': '#f97316' };
  if (lines.length) {
    g.selectAll('path.tx-state')
      .data(lines)
      .enter().append('path')
      .attr('class', 'tx-state')
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', d => voltColors[d.properties?.VOLTAGE] || '#f59e0b')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.95);
  } else {
    g.append('text')
      .attr('x', W / 2).attr('y', H - 30)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(255,255,255,0.45)')
      .attr('font-size', 12)
      .text('No 345/500 kV lines in this county');
  }

  const leg = g.append('g').attr('transform', `translate(12,${H - 64})`);
  [['#f59e0b', '345 kV'], ['#f97316', '500+ kV']].forEach(([color, label], i) => {
    const y = i * 18;
    leg.append('rect').attr('x', 0).attr('y', y + 3).attr('width', 18).attr('height', 4).attr('fill', color);
    leg.append('text').attr('x', 24).attr('y', y + 9)
      .attr('fill', 'rgba(255,255,255,0.85)').attr('font-size', 11).text(label);
  });
}
