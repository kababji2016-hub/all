// التصميم الموحّد — سلوك القوائم المطوية (ui-dd)
// <div class="ui-dd"><button class="ui-dd-btn" data-dd>...</button><div class="ui-dd-menu">...</div></div>
(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-dd]');
    var openDd = document.querySelectorAll('.ui-dd.open');
    if (btn) {
      var dd = btn.closest('.ui-dd');
      var wasOpen = dd.classList.contains('open');
      openDd.forEach(function (d) { d.classList.remove('open'); });
      if (!wasOpen) dd.classList.add('open');
      e.preventDefault();
      return;
    }
    // الضغط على عنصر داخل القائمة أو خارجها يغلقها
    openDd.forEach(function (d) { d.classList.remove('open'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') document.querySelectorAll('.ui-dd.open').forEach(function (d) { d.classList.remove('open'); });
  });
})();
