#!/usr/bin/env bash
# Publishes the Site Monitor to a SpaceFast space.
# Usage: ./scripts/publish.sh [space-slug] [message]
set -euo pipefail

SPACE="${1:-site-monitor}"
MESSAGE="${2:-site monitor publish}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)/sf-publish"

rm -rf "$OUT"
mkdir -p "$OUT"
cp -a "$ROOT/public/." "$OUT/"
cp -a "$ROOT/functions" "$ROOT/sf.jsonc" "$OUT/"

# Dashboard is a single page; no SPA rewrites needed.
sf publish "$OUT" --space "$SPACE" -m "$MESSAGE" -y --wait
