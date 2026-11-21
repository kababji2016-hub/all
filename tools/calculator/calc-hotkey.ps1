# ============================================================
#  اختصار الآلة الحاسبة على مستوى الجهاز كله (ويندوز)
#  ------------------------------------------------------------
#  اضغط H مطولاً (ربع ثانية تقريباً) ثم مسافة — من أي مكان: سطح المكتب أو أي برنامج.
#  يفتح آلة كبابجي الحاسبة في نافذة صغيرة، ونفس الاختصار يغلقها.
#  (الضغط المطوّل شرط حتى لا تظهر الآلة أثناء الكتابة العادية، مثل "هذا " في اللوحة العربية)
#  يعمل في الخلفية بدون نوافذ. التثبيت: install-calculator.bat — الإزالة: uninstall-calculator.bat
# ============================================================
$ErrorActionPreference = 'Stop'

# نسخة واحدة فقط
$mutex = New-Object System.Threading.Mutex($false, 'Global\KababjiCalcHotkey')
if (-not $mutex.WaitOne(0)) { exit }

$Url      = 'https://all-beige-zeta.vercel.app/calc.html'
$Title    = 'آلة حاسبة كبابجي'      # يجب أن يطابق <title> في public/calc.html
$Profile  = Join-Path $env:LOCALAPPDATA 'KababjiCalc'
$Browser  = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

public static class KababjiCalc {
  const int WH_KEYBOARD_LL = 13, WM_KEYDOWN = 0x100, WM_KEYUP = 0x101, WM_SYSKEYDOWN = 0x104, WM_SYSKEYUP = 0x105;
  const int VK_H = 0x48, VK_SPACE = 0x20;
  const uint WM_CLOSE = 0x10;

  delegate IntPtr LowLevelProc(int nCode, IntPtr wParam, IntPtr lParam);
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] struct KBD { public int vk; public int scan; public int flags; public int time; public IntPtr extra; }

  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, LowLevelProc cb, IntPtr mod, uint tid);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int n, IntPtr w, IntPtr l);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

  public static string Title, Url, Browser, Profile;
  public static int HoldMs = 220;

  static LowLevelProc proc = Hook;
  static IntPtr hook = IntPtr.Zero;
  static bool hDown = false, swallowSpaceUp = false;
  static int hDownTick = 0;

  public static void Run() {
    hook = SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(null), 0);
    Application.Run();
  }

  static IntPtr Hook(int nCode, IntPtr wParam, IntPtr lParam) {
    if (nCode >= 0) {
      KBD k = (KBD)Marshal.PtrToStructure(lParam, typeof(KBD));
      int msg = (int)wParam;
      bool down = msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN;
      bool up = msg == WM_KEYUP || msg == WM_SYSKEYUP;
      bool injected = (k.flags & 0x10) != 0;
      if (!injected && k.vk == VK_H) {
        if (down && !hDown) { hDown = true; hDownTick = Environment.TickCount; }
        else if (up) hDown = false;
      } else if (!injected && k.vk == VK_SPACE) {
        if (down && hDown && Environment.TickCount - hDownTick >= HoldMs) {
          swallowSpaceUp = true;
          ThreadPool.QueueUserWorkItem(delegate { try { Toggle(); } catch { } });
          return (IntPtr)1;   // لا تُمرَّر المسافة (فلا صوت تنبيه)
        }
        if (up && swallowSpaceUp) { swallowSpaceUp = false; return (IntPtr)1; }
      }
    }
    return CallNextHookEx(hook, nCode, wParam, lParam);
  }

  static IntPtr FindCalc() {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      StringBuilder sb = new StringBuilder(256);
      GetWindowText(h, sb, 256);
      if (sb.ToString().StartsWith(Title)) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  static void Toggle() {
    IntPtr w = FindCalc();
    if (w != IntPtr.Zero) {
      if (GetForegroundWindow() == w) { PostMessage(w, WM_CLOSE, IntPtr.Zero, IntPtr.Zero); return; }
      ShowWindow(w, 9);                       // SW_RESTORE
      keybd_event(0x12, 0, 0, UIntPtr.Zero);  // Alt قصير يسمح لويندوز بتقديم النافذة للأمام
      keybd_event(0x12, 0, 2, UIntPtr.Zero);
      SetForegroundWindow(w);
      return;
    }
    if (string.IsNullOrEmpty(Browser)) { Process.Start("calc.exe"); return; }
    var area = Screen.PrimaryScreen.WorkingArea;
    int width = 340, height = 580;
    int x = area.Right - width - 24, y = area.Bottom - height - 24;
    string args = "--app=\"" + Url + "\" --user-data-dir=\"" + Profile + "\" --no-first-run --no-default-browser-check" +
                  " --window-size=" + width + "," + height + " --window-position=" + x + "," + y;
    Process.Start(Browser, args);
  }
}
'@

[KababjiCalc]::Title = $Title
[KababjiCalc]::Url = $Url
[KababjiCalc]::Browser = $Browser
[KababjiCalc]::Profile = $Profile
[KababjiCalc]::Run()
