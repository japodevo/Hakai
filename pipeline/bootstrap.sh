#!/usr/bin/env bash
# Set up the pipeline venv on macOS (bash login shell — see CLAUDE.md).
# Usage: cd pipeline && ./bootstrap.sh
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 not found. Install Python 3.11+ (brew install python@3.11)." >&2
  exit 1
fi

python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt

cat <<'EOF'

Pipeline venv ready.  Activate it with:
    source pipeline/.venv/bin/activate

Note: rasterio ships manylinux/macOS wheels with GDAL bundled, so no separate
GDAL install is needed on a Mac. If pip tries to build from source, install GDAL
first (brew install gdal) or use conda-forge (conda install -c conda-forge rasterio).
EOF
