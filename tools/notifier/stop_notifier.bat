@echo off
cd /d "%~dp0"

if not exist notifier.pid (
    echo البرنامج غير مشغل
    pause
    exit /b
)

set /p PID=<notifier.pid
taskkill /F /PID %PID% >nul 2>&1
del notifier.pid >nul 2>&1
echo تم ايقاف برنامج التنبيه
pause
