// ============================================================
//  AllCore — النواة المشتركة لكل الأنظمة
//  ------------------------------------------------------------
//  تُحمَّل في الواجهة الرئيسية وفي كل نظام (بعد Firebase SDK و firebase-config.js)
//  وتوفّر: الاتصال بقاعدة البيانات، تسجيل الدخول الموحّد، الصلاحيات،
//  وحماية صفحات الأنظمة (guard).
//
//  ملف المستخدم في Firestore:  core_users/{uid}
//    { uid, username, name, role: 'admin'|'user', active: bool,
//      modules: ['finance', ...], moduleRoles: { finance: 'employee' } }
// ============================================================
(function () {
  'use strict';

  var cfg = window.ALL_FIREBASE_CONFIG || {};
  var configured = !!(cfg.apiKey && String(cfg.apiKey).indexOf('PUT_') !== 0);
  var USER_EMAIL_DOMAIN = 'users.all.local';

  var app = null, auth = null, db = null;
  if (configured && window.firebase) {
    app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    auth = firebase.auth ? firebase.auth() : null;
    db = firebase.firestore ? firebase.firestore() : null;
  }

  var inShell = (function () { try { return window.top !== window.self; } catch (e) { return true; } })();

  // ── أسماء المستخدمين → بريد داخلي لـ Firebase Auth ──────────
  // (Firebase يتطلب بريداً؛ نحوّل اسم المستخدم — حتى لو كان عربياً — إلى بريد داخلي ثابت)
  function usernameToEmail(username) {
    var u = String(username || '').trim().toLowerCase();
    if (u.indexOf('@') !== -1) return u;
    var bytes = new TextEncoder().encode(u);
    var hex = Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    return 'u' + hex + '@' + USER_EMAIL_DOMAIN;
  }

  // ── الحالة ────────────────────────────────────────────────
  var _authReady = null;
  function waitAuth() {
    if (!auth) return Promise.resolve(null);
    if (!_authReady) {
      _authReady = new Promise(function (resolve) {
        var unsub = auth.onAuthStateChanged(function (u) { unsub(); resolve(u); });
      });
    }
    return _authReady;
  }

  function loadProfile(uid) {
    if (!db) return Promise.resolve(null);
    return db.collection('core_users').doc(uid).get().then(function (d) {
      return d.exists ? Object.assign({ uid: uid }, d.data()) : null;
    });
  }

  // يعيد { user, profile } أو null إن لم يكن هناك جلسة صالحة
  function session() {
    return waitAuth().then(function (u) {
      if (!u) return null;
      return loadProfile(u.uid).then(function (p) {
        if (!p || p.active === false) return null;
        return { user: u, profile: p };
      });
    });
  }

  function isAdmin(profile) { return !!profile && profile.role === 'admin'; }

  function canUse(profile, moduleId) {
    if (!profile || profile.active === false) return false;
    if (isAdmin(profile)) return true;
    return Array.isArray(profile.modules) && profile.modules.indexOf(moduleId) !== -1;
  }

  // الدور الداخلي للمستخدم داخل نظام معيّن — مدير النظام الشامل = admin في كل الأنظمة
  function moduleRole(profile, moduleId) {
    if (isAdmin(profile)) return 'admin';
    var r = profile && profile.moduleRoles && profile.moduleRoles[moduleId];
    if (r) return r;
    var mod = getModule(moduleId);
    return mod && mod.roles && mod.roles.length ? mod.roles[0].id : 'user';
  }

  function getModule(id) {
    return (window.ALL_MODULES || []).filter(function (m) { return m.id === id; })[0] || null;
  }

  // ── تسجيل الدخول / الخروج ─────────────────────────────────
  function signIn(username, password) {
    if (!auth) return Promise.reject(new Error('لم يتم إعداد Firebase بعد'));
    return auth.signInWithEmailAndPassword(usernameToEmail(username), password).then(function (cred) {
      return loadProfile(cred.user.uid).then(function (p) {
        if (!p) { auth.signOut(); throw new Error('هذا الحساب غير مسجّل في النظام'); }
        if (p.active === false) { auth.signOut(); throw new Error('هذا الحساب موقوف — راجع مدير النظام'); }
        return p;
      });
    });
  }

  function signOut() { return auth ? auth.signOut() : Promise.resolve(); }

  function home() {
    if (inShell) { window.top.postMessage({ type: 'all:home' }, location.origin); }
    else { location.href = '/'; }
  }

  function logout() {
    if (!confirm('هل تريد تسجيل الخروج من النظام الشامل؟')) return;
    signOut().then(function () { window.top.location.href = '/'; });
  }

  // ── حماية صفحات الأنظمة ───────────────────────────────────
  // يعيد Promise بملف المستخدم إن كان مسموحاً له بالنظام، وإلا يحوّل للواجهة الرئيسية
  function guard(moduleId) {
    if (!configured) {
      showBlocker('لم يتم ربط النظام بقاعدة البيانات بعد', 'عدّل الملف core/firebase-config.js بقيم مشروع Firebase الجديد.');
      return new Promise(function () {});
    }
    return session().then(function (s) {
      if (!s) { window.top.location.href = '/'; return new Promise(function () {}); }
      if (!canUse(s.profile, moduleId)) {
        showBlocker('لا تملك صلاحية الدخول لهذا النظام', 'اطلب من مدير النظام منحك الصلاحية.');
        return new Promise(function () {});
      }
      return s.profile;
    });
  }

  function showBlocker(title, msg) {
    function render() {
      var el = document.createElement('div');
      el.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;background:#0f1f38;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:Cairo,Tahoma,sans-serif;direction:rtl;text-align:center;padding:24px');
      el.innerHTML = '<div style="font-size:42px">🔒</div><div style="font-size:20px;font-weight:800"></div><div style="opacity:.75"></div>' +
        '<button style="margin-top:10px;padding:10px 22px;border:0;border-radius:10px;background:#2a7de1;color:#fff;font:inherit;cursor:pointer">العودة للرئيسية</button>';
      el.children[1].textContent = title;
      el.children[2].textContent = msg;
      el.querySelector('button').onclick = home;
      document.body.appendChild(el);
    }
    if (document.body) render(); else document.addEventListener('DOMContentLoaded', render);
  }

  // ── قاعدة بيانات بأسماء مجموعات مُعاد توجيهها ─────────────
  // يسمح لكود نظام منسوخ أن يبقى كما هو (مثلاً collection('employees'))
  // بينما تُحفظ البيانات فعلياً في مجموعة تحمل بادئة النظام (payroll_employees).
  function scopedDb(map) {
    if (!db) return null;
    map = map || {};
    function m(name) { return Object.prototype.hasOwnProperty.call(map, name) ? map[name] : name; }
    return new Proxy(db, {
      get: function (target, prop) {
        if (prop === 'collection') return function (name) { return target.collection(m(name)); };
        if (prop === 'doc') return function (path) {
          var parts = String(path).split('/'); parts[0] = m(parts[0]);
          return target.doc(parts.join('/'));
        };
        var v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      }
    });
  }

  window.AllCore = {
    configured: configured,
    config: cfg,
    app: app, auth: auth, db: db,
    inShell: inShell,
    USER_EMAIL_DOMAIN: USER_EMAIL_DOMAIN,
    usernameToEmail: usernameToEmail,
    waitAuth: waitAuth,
    loadProfile: loadProfile,
    session: session,
    isAdmin: isAdmin,
    canUse: canUse,
    moduleRole: moduleRole,
    getModule: getModule,
    signIn: signIn,
    signOut: signOut,
    home: home,
    logout: logout,
    guard: guard,
    scopedDb: scopedDb
  };
})();
