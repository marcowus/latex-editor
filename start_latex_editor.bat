@echo off
setlocal
cd /d "%~dp0"
title LaTeX Editor

set NODE_ENV=production
echo ========================================================
echo   LaTeX Editor is starting...
echo   URL: http://127.0.0.1:3000
echo   Press Ctrl+C or close window to stop.
echo ========================================================

start http://127.0.0.1:3000
node dist\server.cjs
pause
