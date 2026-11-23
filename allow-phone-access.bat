@echo off
title Allow phones to open STORE
rem Opens port 3000 in Windows Firewall for private (home) Wi-Fi networks only. Asks for administrator permission.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath \"%~f0\" -Verb RunAs"
  exit /b
)
netsh advfirewall firewall delete rule name="STORE shop (port 3000)" >nul 2>&1
netsh advfirewall firewall add rule name="STORE shop (port 3000)" dir=in action=allow protocol=TCP localport=3000 profile=private
echo.
echo  Done. Phones on your home Wi-Fi can now open the store.
echo  If it still does not open, set this Wi-Fi to "Private network" in Windows Settings - Network.
echo.
pause
