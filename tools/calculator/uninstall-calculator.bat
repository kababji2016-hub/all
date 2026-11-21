@echo off
chcp 65001 > nul
rem يوقف الاختصار ويزيله من بدء تشغيل ويندوز
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*calc-hotkey.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Remove-Item -Force -ErrorAction SilentlyContinue ([Environment]::GetFolderPath('Startup')+'\Kababji Calculator.lnk')"
echo.
echo  تمت الإزالة. / Removed.
echo.
timeout /t 4 > nul
