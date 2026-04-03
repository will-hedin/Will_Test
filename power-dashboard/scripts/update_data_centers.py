#!/usr/bin/env python3
"""
Download latest Epoch AI frontier data center CSV and regenerate data/data_centers.js.
Only includes North America (United States, Canada, Mexico).
"""

import csv
import json
import re
import sys
import urllib.request
from pathlib import Path

EPOCH_DOWNLOAD_URL = "https://epoch.ai/data/data-centers/download"
OUTPUT_JS = Path(__file__).parent.parent / "data" / "data_centers.js"
NA_COUNTRIES = {"United States", "Canada", "Mexico"}

# Map common CSV column name variants to canonical field names
COL_ALIASES = {
    "name": ["name", "facility_name", "data_center_name"],
    "power": ["power", "power_mw", "capacity_mw", "total_power_mw"],
    "h100": ["h100", "h100_equivalents", "h100_equiv", "gpu_h100_equiv"],
    "cost": ["cost", "cost_bn", "cost_usd_bn", "investment_bn"],
    "owner": ["owner", "owner_operator", "operator"],
    "users": ["users", "primary_user", "tenant", "customer"],
    "project": ["project", "project_name"],
    "country": ["country", "country_name"],
    "address": ["address", "location", "full_address"],
    "lat": ["lat", "latitude", "lat_dd"],
    "lon": ["lon", "longitude", "lng", "lon_dd"],
}


def dms_to_decimal(dms_str):
    """Convert DMS string like '41°41'36\"N' to decimal degrees."""
    dms_str = dms_str.strip()
    negative = dms_str.endswith(("S", "W"))
    parts = re.findall(r"[\d.]+", dms_str)
    if not parts:
        return None
    degrees = float(parts[0])
    minutes = float(parts[1]) if len(parts) > 1 else 0
    seconds = float(parts[2]) if len(parts) > 2 else 0
    decimal = degrees + minutes / 60 + seconds / 3600
    return -decimal if negative else decimal


def parse_coord(val):
    """Return float coordinate or None."""
    if not val or str(val).strip() in ("", "nan", "None", "N/A"):
        return None
    val = str(val).strip()
    # Already decimal
    try:
        return float(val)
    except ValueError:
        pass
    # Try DMS
    return dms_to_decimal(val)


def parse_float(val, default=None):
    if not val or str(val).strip() in ("", "nan", "None", "N/A"):
        return default
    try:
        return float(str(val).replace(",", "").strip())
    except ValueError:
        return default


def strip_owner_suffixes(name):
    """Remove confidence markers like '#confident' from owner names."""
    return re.sub(r"\s*#\w+\s*$", "", name).strip()


def resolve_col(headers_lower, field):
    """Return actual header name for a canonical field, or None."""
    for alias in COL_ALIASES.get(field, [field]):
        if alias in headers_lower:
            return headers_lower[alias]
    return None


def download_csv(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8-sig")


def parse_csv(content):
    reader = csv.DictReader(content.splitlines())
    headers_lower = {h.lower().strip(): h for h in reader.fieldnames or []}

    cols = {field: resolve_col(headers_lower, field) for field in COL_ALIASES}

    records = []
    for row in reader:
        def get(field, default=None):
            col = cols.get(field)
            return row.get(col, default) if col else default

        lat = parse_coord(get("lat"))
        lon = parse_coord(get("lon"))
        if lat is None or lon is None:
            continue  # skip records without coordinates

        country = (get("country") or "").strip()
        if country not in NA_COUNTRIES:
            continue

        owner = strip_owner_suffixes(get("owner") or "")
        users = strip_owner_suffixes(get("users") or owner)

        records.append({
            "name": (get("name") or "").strip(),
            "power": parse_float(get("power")),
            "h100": int(parse_float(get("h100"), 0)),
            "cost": parse_float(get("cost")),
            "owner": owner,
            "users": users,
            "project": (get("project") or "").strip(),
            "country": country,
            "address": (get("address") or "").strip(),
            "lat": round(lat, 6),
            "lon": round(lon, 6),
        })

    # Sort by power descending
    records.sort(key=lambda r: r["power"] or 0, reverse=True)
    return records


def write_js(records, path):
    body = json.dumps(records, indent=2, ensure_ascii=False)
    js = f"const EPOCH_DATA_CENTERS = {body};\n"
    path.write_text(js, encoding="utf-8")


def main():
    print(f"Downloading Epoch AI data from {EPOCH_DOWNLOAD_URL} ...")
    try:
        content = download_csv(EPOCH_DOWNLOAD_URL)
    except Exception as e:
        print(f"ERROR: Download failed: {e}", file=sys.stderr)
        sys.exit(1)

    print("Parsing CSV ...")
    records = parse_csv(content)
    print(f"  {len(records)} North America records with coordinates")

    write_js(records, OUTPUT_JS)
    print(f"Wrote {OUTPUT_JS}")


if __name__ == "__main__":
    main()
