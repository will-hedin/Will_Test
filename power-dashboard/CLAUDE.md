# Power Infrastructure Dashboard — Claude Code Instructions

Live URL: https://will-hedin.github.io/Will_Test/power-dashboard/dc-power-intel.html
(index.html at /power-dashboard/ redirects to dc-power-intel.html)
GitHub:   https://github.com/will-hedin/Will_Test  (remote alias: `will_test`)
Branch:   main → auto-deploys via GitHub Pages

## Monthly Update Agent

When the user says **"national-update-power-and-parcel"**, execute the steps below in order.

---

### Step 1 — Update Epoch AI Frontier Data Centers

The bundled file `data/data_centers.js` must be refreshed from the Epoch AI dataset.

1. Download the latest CSV:
   ```
   curl -L "https://epoch.ai/data/data-centers/download" -o /tmp/epoch_dc.csv
   ```
   If that URL redirects or fails, visit https://epoch.ai/data/data-centers/ and find the current download link.

2. Parse the CSV and regenerate `data/data_centers.js`:
   - Fields needed: name, power (MW), h100 (H100 equiv), cost ($B), owner, users, project, country, address, lat, lon
   - Convert DMS coordinates to decimal if needed (use Python: `degrees + minutes/60 + seconds/3600`)
   - Strip `#confident` or similar suffixes from owner names
   - Filter: only include records where coordinates are available
   - Format as `const EPOCH_DATA_CENTERS = [ ... ];`

3. Verify the output has the correct JS structure before writing.

---

### Step 2 — Check for notable data changes

Briefly scan for:
- New entries in the Epoch AI dataset not previously in the file
- Any data centers with updated power figures (>10% change)
- New owners not already in `OWNER_COLORS` in `js/datacenters.js` (add a color if needed)

Report a summary of changes found.

---

### Step 2b — Refresh FERC Infrastructure Data

The `_FERC_STATIC` constant in `dc-power-intel.html` must be refreshed monthly (FERC API requires same-origin headers, so data is embedded at build time).

```bash
python3 << 'PYEOF'
import urllib.request, json
headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://data.ferc.gov',
    'Referer': 'https://data.ferc.gov/nepa-schedule-for-pending-infrastructure-projects/nepa-schedule-for-pending-infrastructure-projects/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
}
cols = ['Docket_Number','Applicant__s___','Project_Name','NEPA_Document_Type',
        'Final_NEPA_Document_Target_Issuance_Date','Final_NEPA_Document_Actual_Issuance_Date']
all_rows = []
for start in range(0, 400, 100):
    payload = json.dumps({'startRow':start,'endRow':start+100,'sortModel':[],'filterModel':{},'castData':[],'columns':cols}).encode()
    req = urllib.request.Request('https://data.ferc.gov/api/v1/dataset/27/', data=payload, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=15) as r:
        d = json.loads(r.read())
    rows = d.get('rowData', [])
    all_rows.extend(rows)
    if len(rows) < 100: break
records = [{'docket':r['Docket_Number'],'applicant':r['Applicant__s___'],'name':r['Project_Name'],
            'nepaType':r.get('NEPA_Document_Type','') or '',
            'targetDate':(r.get('Final_NEPA_Document_Target_Issuance_Date') or '').split('T')[0],
            'actualDate':(r.get('Final_NEPA_Document_Actual_Issuance_Date') or '').split('T')[0]} for r in all_rows]
print(f'const _FERC_STATIC = {json.dumps(records, separators=(",",":"))};\n// {len(records)} projects fetched')
PYEOF
```

Replace the `const _FERC_STATIC = [...]` block in `dc-power-intel.html` with the new output. Update the "Dataset as of" date in `loadFercData()`.

---

### Step 3 — Commit and push

```bash
git add data/data_centers.js js/datacenters.js
git commit -m "Monthly update: refresh Epoch AI data centers ($(date +%b %Y))"
git push will_test main
```

Then provide the updated live link: https://will-hedin.github.io/Will_Test/power-dashboard/

---

## Project Architecture

| File | Purpose |
|------|---------|
| `dc-power-intel.html` | **Primary tool** — merged single-page app, 8 tabs |
| `index.html` | Redirect only → points to dc-power-intel.html |
| `config.js` | EIA API key |
| `js/app.js` | Routing, state management, view orchestration |
| `js/map.js` | US choropleth + Leaflet satellite county maps |
| `js/transmission.js` | OSM/HIFLD TX line fetch + capacity math |
| `js/api.js` | EIA v2 API calls |
| `js/datacenters.js` | Epoch AI DC map + filters (D3 + ITU layer) |
| `js/parcels.js` | Clark County NV parcel search |
| `js/data.js` | Static state data, ISO codes, eGRID |
| `js/charts.js` | Chart.js fuel-mix chart |
| `data/data_centers.js` | Bundled Epoch AI dataset (update monthly) |
| `css/style.css` | All styles, dark/light theme vars |

## Key Reference Sources

- **Open Grid Works** — transmission lines, data centers, substations, ROW map: https://opengridworks.com/power-plants?layers=tx%2Cdatacenters%2Chpoints%2CrowTx%2CrowSubs&panel=closed

## Key External APIs (live, no update needed)

- **EIA v2** — generators, retail prices, BA load (key in config.js)
- **OpenStreetMap Overpass** — transmission lines per state
- **HIFLD Open Data** — federal TX line layer
- **ITU BBMaps WFS** — submarine cables + IXPs (toggled layer)
- **Clark County Assessor ArcGIS** — NV parcel search
- **ESRI World Imagery** — satellite tile base for state maps

## Deployment

```bash
git push will_test main   # triggers GitHub Pages rebuild (~60s)
```

GitHub remote `will_test` = https://github.com/will-hedin/Will_Test.git
