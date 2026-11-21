# -*- coding: utf-8 -*-
"""
برنامج تنبيه الوثائق والمهام — نسخة النظام الشامل
-------------------------------------------------
نفس سلوك kababji_notifier.py القديم (صوت + إشعار ويندوز + زر واتساب)،
لكنه يقرأ من قاعدة Firestore الجديدة (docs_documents / docs_tasks)
بدل Google Apps Script.

الإعداد: انسخ config.example.json إلى config.json وعبّئ القيم.
الحساب المستخدم يجب أن يملك صلاحية نظام "الوثائق والمهام" في النظام الشامل.
"""
import json
import os
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime, date

try:
    import requests
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'requests'])
    import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_FILE = os.path.join(BASE_DIR, "notifier_log.txt")
PID_FILE = os.path.join(BASE_DIR, "notifier.pid")
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

with open(CONFIG_FILE, encoding="utf-8") as f:
    CFG = json.load(f)

API_KEY      = CFG["api_key"]
PROJECT_ID   = CFG["project_id"]
USERNAME     = CFG["username"]
PASSWORD     = CFG["password"]
WARN_DAYS    = int(CFG.get("warn_days", 10))
INTERVAL     = int(CFG.get("interval_hours", 2)) * 3600
NOTIFY_START = int(CFG.get("notify_start_hour", 15))   # 3 عصراً
NOTIFY_END   = int(CFG.get("notify_end_hour", 2))      # 2 صباحاً
USER_EMAIL_DOMAIN = "users.all.local"   # يجب أن يطابق core/core.js

with open(PID_FILE, "w") as f:
    f.write(str(os.getpid()))


def log(msg):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] {msg}\n")


# ── تسجيل الدخول (نفس تحويل اسم المستخدم المستخدم في core/core.js) ──
def username_to_email(username):
    u = username.strip().lower()
    if "@" in u:
        return u
    return "u" + u.encode("utf-8").hex() + "@" + USER_EMAIL_DOMAIN


_token = {"id": None, "exp": 0}


def id_token():
    if _token["id"] and time.time() < _token["exp"] - 120:
        return _token["id"]
    r = requests.post(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}",
        json={"email": username_to_email(USERNAME), "password": PASSWORD, "returnSecureToken": True},
        timeout=30,
    )
    r.raise_for_status()
    d = r.json()
    _token["id"] = d["idToken"]
    _token["exp"] = time.time() + int(d.get("expiresIn", 3600))
    return _token["id"]


def fs_value(v):
    if "stringValue" in v:
        return v["stringValue"]
    if "integerValue" in v:
        return int(v["integerValue"])
    if "doubleValue" in v:
        return v["doubleValue"]
    if "booleanValue" in v:
        return v["booleanValue"]
    return None


def list_collection(name):
    url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/{name}"
    out, token = [], None
    while True:
        params = {"pageSize": 300}
        if token:
            params["pageToken"] = token
        r = requests.get(url, params=params, headers={"Authorization": "Bearer " + id_token()}, timeout=30)
        r.raise_for_status()
        d = r.json()
        for doc in d.get("documents", []):
            out.append({k: fs_value(v) for k, v in doc.get("fields", {}).items()})
        token = d.get("nextPageToken")
        if not token:
            return out


def days_until(s):
    try:
        y, m, dd = [int(x) for x in str(s)[:10].split("-")]
        return (date(y, m, dd) - date.today()).days
    except Exception:
        return None


# ── الإشعارات (منقولة من البرنامج القديم كما هي) ──────────────
def is_notification_time():
    hour = datetime.now().hour
    return hour >= NOTIFY_START or hour < NOTIFY_END


def play_sound():
    try:
        import winsound
        for _ in range(3):
            winsound.PlaySound("SystemExclamation", winsound.SND_ALIAS)
            time.sleep(0.8)
    except Exception:
        pass


def xml_esc(t):
    return (str(t).replace('&', '&amp;').replace('<', '&lt;')
                  .replace('>', '&gt;').replace('"', '&quot;'))


def show_toast(title, message, wa_text=None):
    action_xml = ""
    if wa_text:
        wa_url = "https://wa.me/?text=" + urllib.parse.quote(wa_text[:800])
        action_xml = f'<actions><action content="ارسال واتساب" activationType="protocol" arguments="{xml_esc(wa_url)}"/></actions>'
    toast_xml = (
        '<toast duration="long"><visual><binding template="ToastGeneric">'
        f'<text>{xml_esc(title)}</text>'
        f'<text>{xml_esc(message)}</text>'
        f'</binding></visual>{action_xml}</toast>'
    )
    ps_file = os.path.join(os.environ.get('TEMP', BASE_DIR), 'all_toast.ps1')
    ps_content = (
        '$null = [Windows.UI.Notifications.ToastNotificationManager,'
        ' Windows.UI.Notifications, ContentType = WindowsRuntime]\n'
        '$null = [Windows.UI.Notifications.ToastNotification,'
        ' Windows.UI.Notifications, ContentType = WindowsRuntime]\n'
        '$null = [Windows.Data.Xml.Dom.XmlDocument,'
        ' Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]\n'
        '$xml = New-Object Windows.Data.Xml.Dom.XmlDocument\n'
        '$toastXml = @"\n' + toast_xml + '\n"@\n'
        '$xml.LoadXml($toastXml)\n'
        '$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)\n'
        '[Windows.UI.Notifications.ToastNotificationManager]'
        '::CreateToastNotifier("Kababji").Show($toast)\n'
    )
    with open(ps_file, 'w', encoding='utf-8-sig') as f:
        f.write(ps_content)
    si = subprocess.STARTUPINFO()
    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    si.wShowWindow = 0
    subprocess.Popen(['powershell', '-ExecutionPolicy', 'Bypass', '-File', ps_file], startupinfo=si)


def check():
    if not is_notification_time():
        log(f"خارج وقت التنبيه ({datetime.now().hour}:00) — لا إشعار")
        return
    try:
        docs = list_collection("docs_documents")
        for d in docs:
            d["days"] = days_until(d.get("expiry"))
        expiring = sorted(
            [d for d in docs if d.get("name") and isinstance(d["days"], int) and 0 < d["days"] <= WARN_DAYS],
            key=lambda x: x["days"])

        tasks = list_collection("docs_tasks")
        for t in tasks:
            t["daysLeft"] = days_until(t.get("date"))
        due_tasks = sorted(
            [t for t in tasks if t.get("name") and isinstance(t["daysLeft"], int) and t["daysLeft"] <= 0],
            key=lambda x: x["daysLeft"])

        if not expiring and not due_tasks:
            log("لا وثائق ولا مهام تحتاج تنبيه")
            return

        play_sound()
        wa_lines = ["تنبيه كبابجي"]

        if expiring:
            doc_lines = [f"- {d['name']} ({d.get('type', '')}) : {d['days']} يوم" for d in expiring[:5]]
            if len(expiring) > 5:
                doc_lines.append(f"و{len(expiring) - 5} وثائق اخرى")
            show_toast("تنبيه وثائق كبابجي", "\n".join(doc_lines))
            wa_lines += ["\nوثائق تقترب من الانتهاء:"] + doc_lines
            log(f"تنبيه وثائق: {len(expiring)} وثيقة")

        if due_tasks:
            time.sleep(3)
            play_sound()

            def task_label(t):
                dl = t['daysLeft']
                return f"- {t['name']} ({'اليوم' if dl == 0 else f'متاخرة {abs(dl)} يوم'})"
            task_lines = [task_label(t) for t in due_tasks[:5]]
            if len(due_tasks) > 5:
                task_lines.append(f"و{len(due_tasks) - 5} مهام اخرى")
            show_toast("مهام مطلوبة — كبابجي", "\n".join(task_lines))
            wa_lines += ["\nمهام مطلوبة:"] + task_lines
            log(f"تنبيه مهام: {len(due_tasks)} مهمة")

        time.sleep(3)
        show_toast("ملخص التنبيهات — كبابجي", f"وثائق: {len(expiring)}  |  مهام: {len(due_tasks)}",
                   wa_text="\n".join(wa_lines))

    except requests.exceptions.ConnectionError:
        log("لا يوجد اتصال بالإنترنت")
    except Exception as e:
        log(f"خطأ: {e}")


log("=== بدء تشغيل برنامج التنبيه (النظام الشامل) ===")
while True:
    check()
    log(f"الفحص القادم بعد {INTERVAL // 3600} ساعة")
    time.sleep(INTERVAL)
