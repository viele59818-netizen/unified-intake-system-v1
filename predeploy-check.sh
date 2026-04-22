#!/bin/zsh

set -euo pipefail

ROOT="/Users/ethanlam/Documents/Codex/2026-04-22-new-chat"
BACKEND="$ROOT/intake-backend-v1"
FRONTEND="$ROOT/weixin-intake-v1"

echo "Checking deploy candidate..."
echo

test -f "$ROOT/render.yaml"
echo "OK root render.yaml"

test -f "$BACKEND/package.json"
echo "OK backend package.json"

test -f "$BACKEND/server.js"
echo "OK backend server.js"

test -f "$FRONTEND/index.html"
echo "OK frontend index.html"

test -f "$FRONTEND/app.js"
echo "OK frontend app.js"

test -f "$FRONTEND/styles.css"
echo "OK frontend styles.css"

node --check "$BACKEND/server.js"
echo "OK backend syntax"

node --check "$FRONTEND/app.js"
echo "OK frontend syntax"

echo
echo "Deploy candidate check passed."
