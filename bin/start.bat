@echo off
rem ============================================================
rem Z-DASH start script (Windows)
rem   Start the backend server and open the browser.
rem Usage:  bin\start.bat [port]    default 8000
rem Note: keep this file ASCII/English only - cmd.exe uses the
rem       ANSI codepage (GBK on zh-CN) and UTF-8 Chinese breaks it.
rem ============================================================
setlocal

rem Project root is one level above bin\
cd /d "%~dp0.."

set PORT=%1
if "%PORT%"=="" set PORT=8000

rem Check node availability
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] node not found. Install Node.js 18+ first: https://nodejs.org
  pause
  exit /b 1
)

echo ==^> Starting Z-DASH backend (node server.js %PORT%)
start "Z-DASH server" /min node server.js %PORT%

rem Wait for the port, then open browser
timeout /t 1 /nobreak >nul
start "" "http://localhost:%PORT%/"

echo ==^> Running at http://localhost:%PORT%/
echo ==^> Server runs in a minimized window; close it to stop.
pause
