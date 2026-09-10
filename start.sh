#!/bin/bash
# Portable Starter Script for Runpod AI Studio
# Dynamically resolves project root directory on any machine

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$SCRIPT_DIR" || exit 1

echo -e "\033[1;36m[Runpod AI Studio]\033[0m Starte Anwendung in: $SCRIPT_DIR"

# 1. Install dependencies if node_modules is missing
if [ ! -d "node_modules" ]; then
  echo -e "\033[1;33m[Runpod AI Studio]\033[0m Installiere Abhängigkeiten (npm install)..."
  npm install || exit 1
fi

# 2. Build production frontend if dist is missing
if [ ! -d "dist" ]; then
  echo -e "\033[1;33m[Runpod AI Studio]\033[0m Erstelle Frontend Build (npm run build)..."
  npm run build || exit 1
fi

# 3. Check if server is already running on port 5173
if curl -s --max-time 1 http://localhost:5173/ >/dev/null 2>&1; then
  echo -e "\033[1;32m[Runpod AI Studio]\033[0m Server läuft bereits auf http://localhost:5173"
  (setsid google-chrome http://localhost:5173 >/dev/null 2>&1 &) 2>/dev/null || \
  (setsid xdg-open http://localhost:5173 >/dev/null 2>&1 &) 2>/dev/null || \
  (open http://localhost:5173 >/dev/null 2>&1 &) 2>/dev/null
  exit 0
fi

# 4. Open browser automatically after 1s
(sleep 1 && ( \
  (setsid google-chrome http://localhost:5173 >/dev/null 2>&1 &) 2>/dev/null || \
  (setsid xdg-open http://localhost:5173 >/dev/null 2>&1 &) 2>/dev/null || \
  (open http://localhost:5173 >/dev/null 2>&1 &) 2>/dev/null \
)) &

# 5. Start node server
exec node server.js
