// ============================================================
//  AllShared — الخدمات الموحّدة بين الأنظمة
//  ------------------------------------------------------------
//  تُحمَّل بعد core.js في الواجهة الرئيسية وفي كل نظام، وتوفّر:
//   • الفروع الموحّدة: قائمة واحدة (core_branches) تقرأ منها كل الأنظمة،
//     وإعادة التسمية تحدّث السجلات في كل الأنظمة دفعة واحدة.
//   • مركز التنبيهات والمؤشرات: كل نظام له "مزوّد" يحسب تنبيهاته وأرقامه،
//     والواجهة الرئيسية تجمعها في مكان واحد.
//  مراجع الفروع لكل نظام معرّفة في core/modules.js (branchRefs / branchLists).
// ============================================================
(function () {
  'use strict';
  var C = window.AllCore;
  if (!C || !C.db) return;
  var db = C.db;

  var _profile = null;
  var profileReady = C.session().then(function (s) { _profile = s && s.profile; return _profile; }).catch(function () { return null; });

  function modules() { return window.ALL_MODULES || []; }
  function norm(s) { return String(s == null ? '' : s).trim(); }
  function hex(s) { return Array.prototype.map.call(new TextEncoder().encode(s), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  function idFor(name) { return 'br_' + hex(norm(name)).slice(0, 120); }
  function today(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.toLocaleDateString('en-CA'); }
  function daysUntil(s) {
    var p = String(s || '').substring(0, 10).split('-').map(Number);
    if (p.length < 3 || !p[0]) return null;
    var d = new Date(p[0], p[1] - 1, p[2]); d.setHours(0, 0, 0, 0);
    var t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  }
  function shortTime(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var same = d.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');
    return 'تحديث ' + (same ? d.toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'short' }));
  }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

  // ════════════════════════════════════════════════════════
  //  الفروع الموحّدة
  // ════════════════════════════════════════════════════════
  var _records = null;      // كل السجلات (بما فيها المحذوفة/الموقوفة)
  var _listeners = [];
  var _started = false;
  var _loadedResolve;
  var branchesLoaded = new Promise(function (r) { _loadedResolve = r; });

  function activeNames() {
    return (_records || []).filter(function (b) { return b.active !== false; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name), 'ar'); })
      .map(function (b) { return b.name; });
  }
  function startBranches() {
    if (_started) return; _started = true;
    db.collection('core_branches').onSnapshot(function (snap) {
      var list = [];
      snap.forEach(function (d) { var x = d.data() || {}; if (x.name) list.push(Object.assign({ id: d.id }, x)); });
      _records = list;
      _loadedResolve();
      var names = activeNames();
      _listeners.forEach(function (f) { try { f(names.slice()); } catch (e) { console.warn(e); } });
    }, function (e) { console.warn('core_branches:', e); _records = _records || []; _loadedResolve(); });
  }

  var Branches = {
    // يعيد آخر قائمة محمّلة (أسماء الفروع الفعّالة) أو null قبل التحميل
    current: function () { return _records ? activeNames() : null; },
    // يستدعي cb فوراً إن كانت القائمة محمّلة، ثم مع كل تغيير
    watch: function (cb) {
      _listeners.push(cb); startBranches();
      if (_records) cb(activeNames());
      return function () { _listeners = _listeners.filter(function (f) { return f !== cb; }); };
    },
    ready: function () { startBranches(); return branchesLoaded.then(function () { return activeNames(); }); },
    // يضيف أي أسماء غير موجودة (ولا يعيد إحياء فرع حذفه المدير)
    ensure: function (names) {
      startBranches();
      return branchesLoaded.then(function () {
        var known = {}; (_records || []).forEach(function (b) { known[norm(b.name)] = 1; });
        var missing = [];
        (names || []).forEach(function (n) { n = norm(n); if (n && !known[n]) { known[n] = 1; missing.push(n); } });
        return Promise.all(missing.map(function (n) { return Branches._create(n); }));
      });
    },
    _create: function (name) {
      return db.collection('core_branches').doc(idFor(name)).set({
        name: name, active: true, createdAt: new Date().toISOString(),
        createdBy: (_profile && (_profile.name || _profile.username)) || ''
      }).catch(function (e) { console.warn('branch create', name, e); });
    },
    add: function (name) {
      name = norm(name); if (!name) return Promise.resolve();
      return branchesLoaded.then(function () {
        var rec = (_records || []).filter(function (b) { return norm(b.name) === name; })[0];
        if (rec && rec.active !== false) return;
        if (rec) return db.collection('core_branches').doc(rec.id).update({ active: true });
        return Branches._create(name);
      });
    },
    // إعادة تسمية (أو دمج إن كان الاسم الجديد موجوداً) — تحدّث السجلات في كل الأنظمة المسموحة
    rename: function (oldName, newName) {
      oldName = norm(oldName); newName = norm(newName);
      if (!oldName || !newName || oldName === newName) return Promise.resolve({ updated: 0 });
      return Promise.all([branchesLoaded, profileReady]).then(function () {
        if (!C.isAdmin(_profile)) throw new Error('تعديل الفروع وحذفها من صلاحية مدير النظام فقط (صفحة الفروع في النظام الشامل)');
        var oldRec = (_records || []).filter(function (b) { return norm(b.name) === oldName; })[0];
        var newRec = (_records || []).filter(function (b) { return norm(b.name) === newName; })[0];
        var ops = [];
        if (newRec) { if (newRec.active === false) ops.push(db.collection('core_branches').doc(newRec.id).update({ active: true })); }
        else ops.push(Branches._create(newName));
        if (oldRec) ops.push(db.collection('core_branches').doc(oldRec.id).update({ active: false, mergedInto: newName }));
        return Promise.all(ops).then(function () { return propagateRename(oldName, newName); });
      });
    },
    // حذف من القائمة الموحّدة (السجلات القديمة تبقى بأسمائها)
    remove: function (name) {
      name = norm(name);
      return Promise.all([branchesLoaded, profileReady]).then(function () {
        if (!C.isAdmin(_profile)) throw new Error('تعديل الفروع وحذفها من صلاحية مدير النظام فقط (صفحة الفروع في النظام الشامل)');
        var rec = (_records || []).filter(function (b) { return norm(b.name) === name; })[0];
        if (!rec) return;
        return db.collection('core_branches').doc(rec.id).update({ active: false });
      });
    },
    // كم سجلاً يستخدم هذا الفرع في كل نظام (للمدير)
    usage: function (name) {
      var out = {};
      return profileReady.then(function () {
        return Promise.all(modules().filter(function (m) { return C.canUse(_profile, m.id); }).map(function (m) {
          return Promise.all((m.branchRefs || []).filter(function (r) { return !r.registry; }).map(function (r) {
            return db.collection(r.col).where(r.field, '==', name).get().then(function (s) { return s.size; }).catch(function () { return 0; });
          })).then(function (counts) { out[m.id] = counts.reduce(function (a, b) { return a + b; }, 0); });
        }));
      }).then(function () { return out; });
    },
    // يجمع أسماء الفروع المستخدمة فعلياً في كل الأنظمة ويضيف الناقص للقائمة الموحّدة
    collectFromModules: function () {
      var cleaned = 0;
      return profileReady.then(function () {
        var names = [];
        var jobs = [];
        modules().forEach(function (m) {
          if (!C.canUse(_profile, m.id)) return;
          (m.branchLists || []).forEach(function (l) {
            jobs.push(db.doc(l.doc).get().then(function (d) { if (d.exists) names = names.concat(d.data()[l.field] || []); }).catch(function () {}));
          });
          (m.branchRefs || []).forEach(function (r) {
            jobs.push(db.collection(r.col).get().then(function (s) {
              // تنظيف: اسم فرع بمسافات زائدة (مثل "التحلية ") يُوحَّد مع الاسم الصحيح
              var fixes = [];
              s.forEach(function (d) {
                var v = (d.data() || {})[r.field];
                if (typeof v !== 'string') return;
                if (norm(v) && v !== norm(v)) fixes.push({ ref: d.ref, value: norm(v) });
                if (!r.noCollect) names.push(v);
              });
              var chunks = [];
              for (var i = 0; i < fixes.length; i += 400) chunks.push(fixes.slice(i, i + 400));
              return chunks.reduce(function (p, chunk) {
                return p.then(function () {
                  var b = db.batch();
                  chunk.forEach(function (f) { var o = {}; o[r.field] = f.value; b.update(f.ref, o); });
                  return b.commit().then(function () { cleaned += chunk.length; });
                });
              }, Promise.resolve());
            }).catch(function (e) { console.warn('collect', r.col, e); }));
          });
        });
        return Promise.all(jobs).then(function () {
          names = names.map(norm).filter(function (n) { return n && n !== '—'; });
          var uniq = Array.from(new Set(names));
          return Branches.ensure(names).then(function () { return { names: uniq, cleaned: cleaned }; });
        });
      });
    }
  };

  function propagateRename(oldName, newName) {
    var updated = 0, jobs = [];
    modules().forEach(function (m) {
      if (!C.canUse(_profile, m.id)) return;
      (m.branchRefs || []).forEach(function (r) {
        jobs.push(db.collection(r.col).where(r.field, '==', oldName).get().then(function (s) {
          var docs = s.docs, chunks = [];
          for (var i = 0; i < docs.length; i += 400) chunks.push(docs.slice(i, i + 400));
          return chunks.reduce(function (p, chunk) {
            return p.then(function () {
              var b = db.batch();
              chunk.forEach(function (d) { var o = {}; o[r.field] = newName; b.update(d.ref, o); });
              updated += chunk.length;
              return b.commit();
            });
          }, Promise.resolve());
        }).catch(function (e) { console.warn('rename', r.col, e); }));
      });
      (m.branchLists || []).forEach(function (l) {
        jobs.push(db.doc(l.doc).get().then(function (d) {
          if (!d.exists) return;
          var arr = (d.data()[l.field] || []).map(function (x) { return norm(x) === oldName ? newName : x; });
          var o = {}; o[l.field] = Array.from(new Set(arr));
          return db.doc(l.doc).set(o, { merge: true });
        }).catch(function (e) { console.warn('rename list', l.doc, e); }));
      });
    });
    return Promise.all(jobs).then(function () { return { updated: updated }; });
  }

  // ════════════════════════════════════════════════════════
  //  مزوّدو التنبيهات والمؤشرات — مزوّد لكل نظام
  //  كل مزوّد يعيد { kpis:[{label,value,color}], alerts:[{level,icon,title,items}] }
  //  level: danger | warning | info
  // ════════════════════════════════════════════════════════
  var PROVIDERS = {
    docs: function () {
      return Promise.all([db.collection('docs_documents').get(), db.collection('docs_tasks').get()]).then(function (r) {
        var docs = r[0].docs.map(function (d) { var x = d.data(); return { name: x.name, type: x.type, branch: x.branch, days: daysUntil(x.expiry) }; })
          .filter(function (x) { return x.name && x.days !== null; });
        var tasks = r[1].docs.map(function (d) { var x = d.data(); return { name: x.name, days: daysUntil(x.date) }; }).filter(function (t) { return t.name && t.days !== null; });
        var expired = docs.filter(function (x) { return x.days < 0 && x.days >= -30; }).sort(function (a, b) { return a.days - b.days; });
        var crit = docs.filter(function (x) { return x.days >= 0 && x.days <= 14; }).sort(function (a, b) { return a.days - b.days; });
        var dueTasks = tasks.filter(function (t) { return t.days <= 0; }).sort(function (a, b) { return a.days - b.days; });
        var alerts = [];
        if (expired.length) alerts.push({ level: 'danger', icon: 'fa-circle-xmark', title: expired.length + ' وثيقة منتهية',
          items: expired.map(function (x) { return x.name + ' — ' + (x.type || '') + ' (منذ ' + Math.abs(x.days) + ' يوم)'; }) });
        if (crit.length) alerts.push({ level: 'warning', icon: 'fa-triangle-exclamation', title: crit.length + ' وثيقة تنتهي خلال 14 يوم',
          items: crit.map(function (x) { return x.name + ' — ' + (x.type || '') + ' (' + (x.days === 0 ? 'اليوم' : 'بعد ' + x.days + ' يوم') + ')'; }) });
        if (dueTasks.length) alerts.push({ level: 'warning', icon: 'fa-list-check', title: dueTasks.length + ' مهمة مطلوبة اليوم أو متأخرة',
          items: dueTasks.map(function (t) { return t.name + (t.days < 0 ? ' (متأخرة ' + Math.abs(t.days) + ' يوم)' : ' (اليوم)'); }) });
        return {
          kpis: [
            { label: 'منتهية', value: expired.length, color: '#c62828' },
            { label: 'خلال 14 يوم', value: crit.length, color: '#e65100' },
            { label: 'مهام مطلوبة', value: dueTasks.length, color: '#1565c0' }
          ],
          alerts: alerts
        };
      });
    },

    finance: function () {
      var y = today(-1), t = today(0), monthStart = t.substring(0, 8) + '01', since = today(-14);
      return Promise.all([
        db.collection('finance_config').doc('main').get(),
        db.collection('finance_entries').where('date', '>=', since).get()
      ]).then(function (r) {
        var cfg = r[0].exists ? r[0].data() : {};
        var recent = r[1].docs.map(function (d) { return d.data(); });
        var alerts = [];
        var bal = typeof cfg.cashBalance === 'number' ? cfg.cashBalance : null;
        var thr = +cfg.alertThreshold || 0;
        if (bal !== null && thr > 0 && bal < thr) alerts.push({ level: 'danger', icon: 'fa-vault', title: 'رصيد الخزينة أقل من حد التنبيه',
          items: ['الرصيد ' + fmt(bal) + ' — الحد ' + fmt(thr)] });
        // فروع كانت تسجّل إيرادات خلال الأسبوعين الماضيين ولم تسجّل إيراد أمس
        var rev = recent.filter(function (e) { return e.type === 'revenue'; });
        var activeBranches = Array.from(new Set(rev.filter(function (e) { return e.date < y; }).map(function (e) { return e.branch; }).filter(Boolean)));
        var yBranches = new Set(rev.filter(function (e) { return e.date === y; }).map(function (e) { return e.branch; }));
        var missing = activeBranches.filter(function (b) { return !yBranches.has(b); });
        if (missing.length) alerts.push({ level: 'info', icon: 'fa-store-slash', title: missing.length + ' فرع بدون إيراد مسجّل أمس', items: missing });
        return db.collection('finance_entries').where('date', '>=', monthStart).get().then(function (s) {
          var m = s.docs.map(function (d) { return d.data(); });
          var mRev = m.filter(function (e) { return e.type === 'revenue'; }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0);
          var mExp = m.filter(function (e) { return e.type === 'expense'; }).reduce(function (a, e) { return a + (+e.amount || 0); }, 0);
          return {
            kpis: [
              { label: 'رصيد الخزينة', value: bal === null ? '—' : fmt(bal), color: '#0f2942', hint: cfg.cashBalanceAt ? shortTime(cfg.cashBalanceAt) : 'افتح الخزينة لتحديثه' },
              { label: 'إيرادات الشهر', value: fmt(mRev), color: '#2e7d32' },
              { label: 'مصروفات الشهر', value: fmt(mExp), color: '#c62828' }
            ],
            alerts: alerts
          };
        });
      });
    },

    payroll: function () {
      var now = new Date();
      var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      var prevMonth = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
      return Promise.all([
        db.collection('payroll_employees').get(),
        db.collection('payroll_deliveries').doc(prevMonth).get(),
        db.collection('payroll_loans').get()
      ]).then(function (r) {
        var emps = r[0].docs.map(function (d) { return d.data(); }).filter(function (e) { var s = String(e.status || '').trim().toLowerCase(); return s === 'active' || s === 'نشط'; });
        var basic = emps.reduce(function (a, e) { return a + (+e.basic || 0); }, 0);
        var activeLoans = r[2].docs.map(function (d) { return d.data(); }).filter(function (l) { var s = String(l.status || '').trim(); return s && s !== 'settled' && s !== 'مسدد' && s !== 'مسدّد'; });
        var alerts = [];
        if (!r[1].exists && now.getDate() >= 5 && emps.length) alerts.push({ level: 'warning', icon: 'fa-file-invoice-dollar', title: 'لم يُرحّل مسيّر رواتب شهر ' + prevMonth, items: ['احسب المسيّر ورحّله من نظام الرواتب'] });
        return {
          kpis: [
            { label: 'موظف نشط', value: emps.length, color: '#1565c0' },
            { label: 'إجمالي الرواتب الأساسية', value: fmt(basic), color: '#2e7d32' },
            { label: 'سلف/قروض نشطة', value: activeLoans.length, color: '#e65100' }
          ],
          alerts: alerts
        };
      });
    },

    maint: function () {
      var month = today(0).substring(0, 7);
      return db.collection('maint_records').get().then(function (s) {
        var recs = s.docs.map(function (d) { return d.data(); });
        // آخر سجل لكل (أصل + عطل) — موعد الصيانة القادمة يُؤخذ منه فقط
        var latest = {};
        recs.forEach(function (r) {
          var k = r.assetId + '|' + String(r.fault || '').replace(/\s+/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
          if (!latest[k] || String(r.date) > String(latest[k].date)) latest[k] = r;
        });
        var due = Object.keys(latest).map(function (k) { return latest[k]; }).filter(function (r) { return r.nextDue; })
          .map(function (r) { return { r: r, days: daysUntil(r.nextDue) }; }).filter(function (x) { return x.days !== null && x.days <= 7; })
          .sort(function (a, b) { return a.days - b.days; });
        var overdue = due.filter(function (x) { return x.days < 0; }), soon = due.filter(function (x) { return x.days >= 0; });
        var alerts = [];
        if (overdue.length) alerts.push({ level: 'danger', icon: 'fa-screwdriver-wrench', title: overdue.length + ' صيانة متأخرة عن موعدها',
          items: overdue.map(function (x) { return x.r.assetName + ' — ' + x.r.fault + ' (متأخرة ' + Math.abs(x.days) + ' يوم)'; }) });
        if (soon.length) alerts.push({ level: 'warning', icon: 'fa-calendar-check', title: soon.length + ' صيانة مستحقة خلال أسبوع',
          items: soon.map(function (x) { return x.r.assetName + ' — ' + x.r.fault + ' (' + (x.days === 0 ? 'اليوم' : 'بعد ' + x.days + ' يوم') + ')'; }) });
        var m = recs.filter(function (r) { return String(r.date).substring(0, 7) === month; });
        return {
          kpis: [
            { label: 'صيانات الشهر', value: m.length, color: '#1565c0' },
            { label: 'تكلفة الشهر', value: fmt(m.reduce(function (a, r) { return a + (+r.total || 0); }, 0)), color: '#2e7d32' },
            { label: 'مستحقة / متأخرة', value: due.length, color: due.length ? '#e65100' : '#888' }
          ],
          alerts: alerts
        };
      });
    },

    journal: function () {
      var y = today(-1), monthStart = today(0).substring(0, 8) + '01';
      return Promise.all([db.collection('journal_entries').where('date', '>=', monthStart).get(), Branches.ready()]).then(function (r) {
        var month = r[0].docs.map(function (d) { return d.data(); });
        var alerts = [];
        if (month.length) {
          var used = Array.from(new Set(month.map(function (e) { return e.branch; }).filter(Boolean)));
          var yb = new Set(month.filter(function (e) { return e.date === y; }).map(function (e) { return e.branch; }));
          var missing = used.filter(function (b) { return !yb.has(b); });
          if (missing.length) alerts.push({ level: 'info', icon: 'fa-book-open', title: missing.length + ' فرع لم تُسجّل يوميته أمس', items: missing });
        }
        return { kpis: [{ label: 'يوميات هذا الشهر', value: month.length, color: '#6a1b9a' }], alerts: alerts };
      });
    }
  };

  // يجمع التنبيهات والمؤشرات من كل الأنظمة المسموحة للمستخدم
  function collect(profile) {
    profile = profile || _profile;
    var out = { byModule: {}, alerts: [] };
    return Promise.all(modules().filter(function (m) { return C.canUse(profile, m.id) && PROVIDERS[m.id]; }).map(function (m) {
      return PROVIDERS[m.id]().then(function (res) {
        out.byModule[m.id] = res;
        (res.alerts || []).forEach(function (a) { out.alerts.push(Object.assign({ module: m.id, moduleTitle: m.title, color: m.color }, a)); });
      }).catch(function (e) { console.warn('provider', m.id, e); out.byModule[m.id] = { kpis: [], alerts: [], error: e.message }; });
    })).then(function () {
      var rank = { danger: 0, warning: 1, info: 2 };
      out.alerts.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
      return out;
    });
  }

  window.AllShared = {
    branches: Branches,
    alerts: { collect: collect, providers: PROVIDERS },
    util: { daysUntil: daysUntil, today: today, fmt: fmt }
  };
})();
