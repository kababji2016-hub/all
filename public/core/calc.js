// ============================================================
//  الآلة الحاسبة الموحّدة — اختصار: H ثم مسافة (أو الاثنين معاً)
//  ------------------------------------------------------------
//  • تعمل في الواجهة الرئيسية وفي كل نظام (تُحمَّل عبر core.js).
//  • داخل الواجهة: الاختصار من أي نظام يفتح الآلة في الصفحة الرئيسية (نسخة واحدة).
//  • لا تعمل أثناء الكتابة داخل حقل إدخال.
//  • تعتمد على زر H نفسه (event.code) فتعمل مع لوحة المفاتيح العربية.
// ============================================================
(function () {
  'use strict';
  var inShell = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();
  // وضع النافذة المستقلة (calc.html) — يفتحها برنامج الاختصار على مستوى الجهاز
  var STANDALONE = !!window.ALL_CALC_STANDALONE;

  // ── كشف الاختصار ─────────────────────────────────────────
  var hDown = false, lastH = 0;
  function isTyping(t) {
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable;
  }
  function trigger() {
    if (inShell) { try { window.top.postMessage({ type: 'all:calc' }, location.origin); return; } catch (e) {} }
    Calc.toggle();
  }
  if (!STANDALONE) document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (Calc.isOpen() && document.getElementById('allCalc').contains(e.target)) return; // الآلة نفسها تتعامل مع الأزرار
    if (isTyping(e.target)) return;
    if (e.code === 'KeyH') { hDown = true; lastH = Date.now(); return; }
    if (e.code === 'Space' && (hDown || Date.now() - lastH < 900)) {
      e.preventDefault(); lastH = 0; trigger();
    }
  }, true);
  document.addEventListener('keyup', function (e) { if (e.code === 'KeyH') hDown = false; }, true);
  window.addEventListener('blur', function () { hDown = false; });
  if (!inShell) {
    window.addEventListener('message', function (e) {
      if (e.origin === location.origin && e.data && e.data.type === 'all:calc') Calc.toggle();
    });
  }

  // ── الواجهة ──────────────────────────────────────────────
  var CSS =
    '#allCalc{position:fixed;left:24px;bottom:24px;width:290px;z-index:2147483000;background:#fff;border-radius:16px;' +
    'box-shadow:0 22px 60px rgba(15,34,64,.35);overflow:hidden;font-family:"Segoe UI",Tahoma,Arial,sans-serif;direction:ltr;outline:none;user-select:none}' +
    '#allCalc .ac-h{display:flex;align-items:center;justify-content:space-between;background:#0f2942;color:#fff;padding:9px 12px;cursor:move;direction:rtl}' +
    '#allCalc .ac-h b{font-size:.86rem;font-weight:700}' +
    '#allCalc .ac-h small{font-size:.68rem;opacity:.6;margin-right:6px;font-weight:600}' +
    '#allCalc .ac-x{border:0;background:rgba(255,255,255,.12);color:#fff;width:26px;height:26px;border-radius:7px;cursor:pointer;font-size:15px;line-height:1}' +
    '#allCalc .ac-x:hover{background:rgba(255,255,255,.25)}' +
    '#allCalc .ac-d{padding:12px 14px 8px;text-align:right;background:#f8f9fa;border-bottom:1px solid #e9ecef}' +
    '#allCalc .ac-e{min-height:18px;font-size:.8rem;color:#888;word-break:break-all}' +
    '#allCalc .ac-v{font-size:1.9rem;font-weight:700;color:#212529;line-height:1.25;word-break:break-all}' +
    '#allCalc .ac-g{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px}' +
    '#allCalc .ac-g button{height:46px;border:0;border-radius:10px;background:#f1f3f6;color:#212529;font:inherit;font-size:1.1rem;font-weight:700;cursor:pointer;transition:background .12s}' +
    '#allCalc .ac-g button:hover{background:#e3e8ef}' +
    '#allCalc .ac-g button:active{transform:scale(.97)}' +
    '#allCalc .ac-g .op{background:#e3f2fd;color:#1565c0}' +
    '#allCalc .ac-g .fn{background:#eceff1;color:#455a64;font-size:.95rem}' +
    '#allCalc .ac-g .eq{background:#1e88e5;color:#fff}' +
    '#allCalc .ac-g .eq:hover{background:#1565c0}' +
    '#allCalc .ac-f{display:flex;justify-content:space-between;align-items:center;padding:0 12px 10px;direction:rtl}' +
    '#allCalc .ac-f button{border:0;background:none;color:#1e88e5;font:inherit;font-size:.78rem;font-weight:700;cursor:pointer}' +
    '#allCalc .ac-f span{font-size:.68rem;color:#999}' +
    '#allCalc.ac-full{position:fixed;inset:0;left:0;bottom:0;width:auto;border-radius:0;box-shadow:none;display:flex!important;flex-direction:column}' +
    '#allCalc.ac-full .ac-h{cursor:default}#allCalc.ac-full .ac-g{flex:1;grid-auto-rows:1fr}#allCalc.ac-full .ac-g button{height:auto}' +
    '#allCalc.ac-full .ac-v{font-size:2.3rem}';

  var KEYS = [
    ['C', 'fn', 'clear'], ['⌫', 'fn', 'back'], ['%', 'fn', '%'], ['÷', 'op', '/'],
    ['7', '', '7'], ['8', '', '8'], ['9', '', '9'], ['×', 'op', '*'],
    ['4', '', '4'], ['5', '', '5'], ['6', '', '6'], ['−', 'op', '-'],
    ['1', '', '1'], ['2', '', '2'], ['3', '', '3'], ['+', 'op', '+'],
    ['±', 'fn', 'neg'], ['0', '', '0'], ['.', '', '.'], ['=', 'eq', '=']
  ];

  var el = null, expr = '', lastResult = null;
  var SHOW = { '/': '÷', '*': '×', '-': '−' };

  function fmt(n) {
    if (!isFinite(n)) return 'خطأ';
    n = parseFloat(Number(n).toPrecision(12));
    var parts = String(n).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  function calc(s) {
    if (!/^[\d+\-*/().\s]*$/.test(s) || !s.trim()) return NaN;
    try { return Function('"use strict";return (' + s + ')')(); } catch (e) { return NaN; }
  }
  // النسبة مثل الحاسبة العادية: 500 + 10% = 550 ، 500 − 10% = 450 ، 200 × 10% = 20
  function evaluate(s) {
    s = String(s).replace(/[+\-*/.]+$/, '');
    if (!s) return NaN;
    var guard = 0;
    while (s.indexOf('%') !== -1 && guard++ < 50) {
      var i = s.indexOf('%');
      var m = s.slice(0, i).match(/(\d+(?:\.\d+)?)$/);
      if (!m) return NaN;
      var prev = s.slice(0, i - m[1].length), n = parseFloat(m[1]), op = prev.slice(-1), rep;
      if ((op === '+' || op === '-') && prev.length > 1) rep = calc(prev.slice(0, -1)) * n / 100;
      else rep = n / 100;
      s = prev + '(' + rep + ')' + s.slice(i + 1);
    }
    return calc(s);
  }
  function pretty(s) { return s.replace(/[\/*-]/g, function (c) { return SHOW[c]; }); }
  function render() {
    if (!el) return;
    var live = evaluate(expr);
    el.querySelector('.ac-e').textContent = expr ? pretty(expr) : (lastResult !== null ? '' : '');
    el.querySelector('.ac-v').textContent = expr ? (isFinite(live) ? fmt(live) : pretty(expr.slice(-14))) : (lastResult !== null ? fmt(lastResult) : '0');
  }
  function press(k) {
    if (k === 'clear') { expr = ''; lastResult = null; }
    else if (k === 'back') { expr = expr.slice(0, -1); }
    else if (k === '=') {
      var r = evaluate(expr);
      if (isFinite(r)) { lastResult = parseFloat(Number(r).toPrecision(12)); expr = ''; }
    }
    else if (k === 'neg') {
      var m = expr.match(/(-?)(\d*\.?\d*)$/);
      if (m && m[2]) expr = expr.slice(0, expr.length - m[0].length) + (m[1] ? '' : '-') + m[2];
      else if (!expr && lastResult !== null) { expr = String(-lastResult); lastResult = null; }
    }
    else {
      var isOp = /[+\-*/%]/.test(k);
      if (!expr && lastResult !== null) expr = isOp ? String(lastResult) : '';
      if (isOp && /[+\-*/]$/.test(expr) && k !== '%') expr = expr.slice(0, -1);
      if (k === '.') { var cur = expr.split(/[+\-*/]/).pop(); if (cur.indexOf('.') !== -1) return; if (!cur) k = '0.'; }
      if (isOp && !expr && k !== '-') return;
      expr += k; lastResult = null;
    }
    render();
  }
  function build() {
    if (!document.getElementById('allCalcCss')) {
      var st = document.createElement('style'); st.id = 'allCalcCss'; st.textContent = CSS; document.head.appendChild(st);
    }
    el = document.createElement('div');
    el.id = 'allCalc'; el.tabIndex = -1;
    if (STANDALONE) el.className = 'ac-full';
    el.innerHTML =
      '<div class="ac-h"><div><b>آلة حاسبة</b><small>H + مسافة</small></div><button class="ac-x" title="إغلاق (Esc)">×</button></div>' +
      '<div class="ac-d"><div class="ac-e"></div><div class="ac-v">0</div></div>' +
      '<div class="ac-g">' + KEYS.map(function (k) { return '<button type="button" class="' + k[1] + '" data-k="' + k[2] + '">' + k[0] + '</button>'; }).join('') + '</div>' +
      '<div class="ac-f"><button type="button" class="ac-copy">نسخ النتيجة</button><span>Enter = · Esc إغلاق</span></div>';
    document.body.appendChild(el);
    el.querySelector('.ac-x').onclick = function () { Calc.close(); };
    if (STANDALONE) el.querySelector('.ac-h small').textContent = 'اضغط H مطولاً + مسافة من أي مكان';
    el.querySelector('.ac-g').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { press(b.dataset.k); el.focus(); } });
    el.querySelector('.ac-copy').onclick = function () {
      var v = expr ? evaluate(expr) : lastResult;
      if (v === null || !isFinite(v)) return;
      var txt = String(parseFloat(Number(v).toPrecision(12)));
      var btn = this;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
        btn.textContent = 'تم النسخ ✓'; setTimeout(function () { btn.textContent = 'نسخ النتيجة'; }, 1200);
      }).catch(function () {});
      el.focus();
    };
    el.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'Escape') { Calc.close(); e.preventDefault(); return; }
      if (e.ctrlKey && (k === 'c' || k === 'C')) { el.querySelector('.ac-copy').click(); e.preventDefault(); return; }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      var map = { 'Enter': '=', '=': '=', 'Backspace': 'back', 'Delete': 'clear', ',': '.', 'x': '*', 'X': '*', '×': '*', '÷': '/' };
      var a = '٠١٢٣٤٥٦٧٨٩'.indexOf(k);
      if (a !== -1) k = String(a);
      k = map[k] || k;
      if (/^[\d.+\-*/%]$/.test(k) || k === '=' || k === 'back' || k === 'clear') { press(k); e.preventDefault(); e.stopPropagation(); }
    });
    // السحب من الشريط العلوي
    var hdr = el.querySelector('.ac-h'), drag = null;
    hdr.addEventListener('mousedown', function (e) {
      if (e.target.closest('button') || STANDALONE) return;
      var r = el.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, e.clientX - drag.dx));
      var y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, e.clientY - drag.dy));
      el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', function () { drag = null; });
  }

  var Calc = {
    isOpen: function () { return !!el && el.style.display !== 'none'; },
    open: function () {
      if (!document.body) return;
      if (!el) build();
      el.style.display = 'block'; render();
      setTimeout(function () { el.focus(); }, 0);
    },
    close: function () { if (STANDALONE) { window.close(); return; } if (el) el.style.display = 'none'; },
    toggle: function () { Calc.isOpen() ? Calc.close() : Calc.open(); },
    // يفتح الآلة من أي صفحة (داخل الواجهة تُفتح في الصفحة الرئيسية)
    show: function () { trigger(); }
  };
  window.AllCalc = Calc;
  if (STANDALONE) {
    var go = function () { Calc.open(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
    window.addEventListener('focus', function () { if (el) el.focus(); });
  }
})();
