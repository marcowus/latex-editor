@echo off
setlocal
cd /d "%~dp0"
title Stop LaTeX Editor

echo Stopping LaTeX Editor service on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [OK] LaTeX Editor stopped.
timeout /t 2 >nul
