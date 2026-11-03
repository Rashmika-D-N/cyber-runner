@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24, then run this file again.
  pause
  exit /b 1
)
node scripts/check-assets.mjs
if errorlevel 1 (
  echo See docs\ASSET-SETUP.md for the missing local assets.
  pause
  exit /b 1
)
start "" http://127.0.0.1:5173/
node server.mjs
pause
