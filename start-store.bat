@echo off
title STORE server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed on this computer.
  echo  Opening the download page - install the LTS version, then run this file again.
  start "" https://nodejs.org/en/download
  echo.
  pause
  exit /b
)
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
node server.js
echo.
echo  The server stopped. See the message above.
pause
