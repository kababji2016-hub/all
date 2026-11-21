@echo off
chcp 65001 > nul
cd /d "%~dp0"
rem يضيف الاختصار لبدء تشغيل ويندوز (يعمل تلقائياً بعد كل إعادة تشغيل) ويشغّله الآن
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Kababji Calculator.lnk'); $s.TargetPath='wscript.exe'; $s.Arguments='\"%~dp0launcher.vbs\"'; $s.WorkingDirectory='%~dp0'; $s.Description='Kababji calculator hotkey (hold H + Space)'; $s.Save()"
wscript.exe "%~dp0launcher.vbs"
echo.
echo  تم التثبيت. اضغط H مطولاً ثم مسافة من أي مكان لفتح الآلة الحاسبة.
echo  Installed. Hold H then press Space anywhere to open the calculator.
echo.
timeout /t 6 > nul
