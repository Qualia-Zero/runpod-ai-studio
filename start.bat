@echo off
:: Portable Starter Script for Windows
cd /d "%~dp0"

echo [Runpod AI Studio] Starte Anwendung in %CD%...

if not exist node_modules (
    echo [Runpod AI Studio] Installiere Abhängigkeiten...
    call npm install
)

if not exist dist (
    echo [Runpod AI Studio] Erstelle Frontend Build...
    call npm run build
)

start http://localhost:5173
node server.js
