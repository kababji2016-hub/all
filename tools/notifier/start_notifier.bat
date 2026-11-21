@echo off
cd /d "%~dp0"

rem تحقق إذا كان البرنامج يعمل بالفعل
if exist notifier.pid (
    set /p OLDPID=<notifier.pid
    tasklist /FI "PID eq %OLDPID%" 2>nul | find "%OLDPID%" >nul
    if not errorlevel 1 (
        echo البرنامج يعمل بالفعل
        pause
        exit /b
    )
)

rem البحث عن Python (py launcher أولاً لأن alias "python" قد يكون معطلاً على ويندوز)
set PYCMD=
where py >nul 2>&1
if not errorlevel 1 set PYCMD=py

if "%PYCMD%"=="" (
    where python >nul 2>&1
    if not errorlevel 1 set PYCMD=python
)

if "%PYCMD%"=="" (
    echo Python غير موجود على هذا الجهاز.
    echo قم بتثبيته من: https://www.python.org/downloads/
    pause
    exit /b
)

rem تشغيل Python بدون نافذة عبر VBScript
echo CreateObject("WScript.Shell").Run "%PYCMD% ""%~dp0notifier.py""", 0, False > "%temp%\run_notifier.vbs"
wscript "%temp%\run_notifier.vbs"

echo تم تشغيل برنامج التنبيه في الخلفية
timeout /t 3 >nul
