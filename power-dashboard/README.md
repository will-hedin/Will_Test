# US Power Infrastructure Dashboard

Interactive web app for data center site selection — maps US power infrastructure
across all 50 states with live EIA and GridStatus data.

## Quick start

```bash
cd power-dashboard
python -m http.server 8080
# open http://localhost:8080
```

Or just open `index.html` directly in a browser (file:// works for static data;
API calls require a local server to avoid CORS issues on some browsers).

## API keys

Keys live in `config.js` (gitignored). Copy the template if you need to reset:

```bash
cp config.example.js config.js
# edit config.js and fill in your keys
```

- **EIA**: free at https://www.eia.gov/opendata/register.php
- **GridStatus**: free tier at https://www.gridstatus.io/api (1M rows/month)

## What it does

**US map view** — D3 choropleth with three toggle views:
- Infrastructure Score (composite 0–100, hardcoded reference data)
- ISO Coverage (categorical: PJM / ERCOT / MISO / CAISO / NYISO / ISO-NE / SPP / Non-ISO)
- DC Demand (market intensity index, hardcoded reference data)

Hover any state for capacity, peak demand, fuel mix, ISO, utility, and DC market note.
Click a state to drill into the detail view.

**State detail view** — live data from EIA and GridStatus:
- Metric cards: installed capacity, generator count, commercial electricity price, ISO, top fuel
- County-level heat map colored by transmission infrastructure score (sum of generator
  nameplate capacity within 25 km of each county centroid, normalized 0–100)
- Power plant overlay: every generator >10 MW plotted at its real lat/lon, colored by fuel type
- Top 15 generators table
- GridStatus panel (ISO states): interconnection queue bar chart + current fuel mix donut

## File structure

```
power-dashboard/
├── index.html
├── config.js          ← gitignored, real API keys
├── config.example.js  ← template
├── js/
│   ├── app.js         routing, state management, view orchestration
│   ├── map.js         D3 US choropleth + county heatmap + generator overlay
│   ├── api.js         EIA + GridStatus fetches with in-memory caching
│   ├── charts.js      Chart.js queue bar + fuel mix donut
│   └── data.js        static state reference data (FIPS, ISO, utility, mix, scores)
├── css/
│   └── style.css      dark/light mode, responsive layout
└── .gitignore
```

## Notes

- All API results are cached in memory; re-clicking a state costs zero additional API calls.
- Non-ISO states (FL, GA, TX-non-ERCOT fringe, etc.) skip GridStatus and show a utility card.
- If a GridStatus dataset returns 404, the app tries `/datasets` to list available IDs.
- Generator overlay is filtered to ≥10 MW for readability; county scoring uses all generators.
