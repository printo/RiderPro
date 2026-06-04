#!/usr/bin/env bash
# =============================================================================
# setup-osrm.sh — One-time OSRM road data preparation for RiderPro
#
# Run this ONCE on the server before starting the osrm Docker service.
# The processed files are stored in ./osrm-data/ and mounted into the
# container by docker-compose.yml.
#
# Usage:
#   bash scripts/setup-osrm.sh [region]
#
# Examples:
#   bash scripts/setup-osrm.sh               # defaults to india
#   bash scripts/setup-osrm.sh india
#   bash scripts/setup-osrm.sh karnataka     # smaller state extract
#
# Available region keys and their Geofabrik download URLs:
#   india       https://download.geofabrik.de/asia/india-latest.osm.pbf      (~700 MB)
#   karnataka   https://download.geofabrik.de/asia/india/karnataka-latest.osm.pbf (~90 MB)
#   tamil-nadu  https://download.geofabrik.de/asia/india/tamil-nadu-latest.osm.pbf (~70 MB)
#   maharashtra https://download.geofabrik.de/asia/india/maharashtra-latest.osm.pbf (~140 MB)
#
# After this script finishes, start the service:
#   docker compose up osrm -d
#
# To switch routing provider back to Haversine (no OSRM needed):
#   ROUTING_PROVIDER=haversine docker compose up -d
# =============================================================================

set -euo pipefail

OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:v5.27.1"
DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/osrm-data"
REGION="${1:-india}"

declare -A REGION_URLS=(
    [india]="https://download.geofabrik.de/asia/india-latest.osm.pbf"
    [karnataka]="https://download.geofabrik.de/asia/india/karnataka-latest.osm.pbf"
    [tamil-nadu]="https://download.geofabrik.de/asia/india/tamil-nadu-latest.osm.pbf"
    [maharashtra]="https://download.geofabrik.de/asia/india/maharashtra-latest.osm.pbf"
    [kerala]="https://download.geofabrik.de/asia/india/kerala-latest.osm.pbf"
    [delhi]="https://download.geofabrik.de/asia/india/delhi-latest.osm.pbf"
)

if [[ -z "${REGION_URLS[$REGION]+_}" ]]; then
    echo "ERROR: Unknown region '$REGION'."
    echo "Available regions: ${!REGION_URLS[*]}"
    exit 1
fi

OSM_URL="${REGION_URLS[$REGION]}"
OSM_FILE="$DATA_DIR/region.osm.pbf"
OSRM_FILE="$DATA_DIR/region.osrm"

echo "=== RiderPro OSRM Setup ==="
echo "Region  : $REGION"
echo "URL     : $OSM_URL"
echo "Data dir: $DATA_DIR"
echo ""

mkdir -p "$DATA_DIR"

# ── Step 1: Download OSM data ────────────────────────────────────────────────
if [[ -f "$OSM_FILE" ]]; then
    echo "✓ OSM data already downloaded at $OSM_FILE — skipping download."
    echo "  (Delete the file and re-run to force a fresh download.)"
else
    echo "→ Downloading OSM data for '$REGION'..."
    wget -q --show-progress -O "$OSM_FILE" "$OSM_URL"
    echo "✓ Download complete."
fi

# ── Step 2: Extract ──────────────────────────────────────────────────────────
if [[ -f "$OSRM_FILE" ]]; then
    echo "✓ OSRM extract already exists — skipping extract step."
else
    echo "→ Extracting (this may take several minutes for large regions)..."
    docker run --rm -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
        osrm-extract -p /opt/car.lua /data/region.osm.pbf
    echo "✓ Extract complete."
fi

# ── Step 3: Partition ────────────────────────────────────────────────────────
if [[ -f "$DATA_DIR/region.osrm.partition" ]]; then
    echo "✓ Partition already exists — skipping."
else
    echo "→ Partitioning..."
    docker run --rm -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
        osrm-partition /data/region.osrm
    echo "✓ Partition complete."
fi

# ── Step 4: Customize ────────────────────────────────────────────────────────
if [[ -f "$DATA_DIR/region.osrm.mldgr" ]]; then
    echo "✓ Customization already exists — skipping."
else
    echo "→ Customizing..."
    docker run --rm -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
        osrm-customize /data/region.osrm
    echo "✓ Customization complete."
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Start the OSRM service with:"
echo "  docker compose up osrm -d"
echo ""
echo "Verify it's running:"
echo "  curl 'http://localhost:5000/table/v1/driving/77.5946,12.9716;77.6000,12.9800?annotations=duration,distance'"
echo ""
echo "To switch back to straight-line distances (no OSRM required):"
echo "  ROUTING_PROVIDER=haversine docker compose up -d"
