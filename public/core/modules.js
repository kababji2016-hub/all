// ============================================================
//  سجل الأنظمة (Modules Registry)
//  ------------------------------------------------------------
//  لإضافة نظام جديد:
//   1) انسخ المجلد modules/_template إلى modules/<id>
//   2) أضف عنصراً هنا بنفس الـ id
//   3) كل مجموعات (collections) النظام في Firestore يجب أن تبدأ بـ "<id>_"
//      — قواعد الحماية تمنح الصلاحية تلقائياً حسب هذه البادئة.
//
//  الحقول:
//   id          معرّف لاتيني قصير (حروف صغيرة/أرقام فقط، بدون _ )
//   title       الاسم الظاهر
//   description وصف مختصر يظهر في الصفحة الرئيسية
//   icon        أيقونة Font Awesome
//   color       لون النظام
//   path        مسار صفحة النظام
//   roles       (اختياري) أدوار داخلية للنظام — تظهر عند منح المستخدم الصلاحية
// ============================================================
window.ALL_MODULES = [
  {
    id: 'finance',
    title: 'الخزينة',
    description: 'الإيرادات والمصروفات والعهدة والترحيل والتقارير المالية',
    icon: 'fa-cash-register',
    color: '#2a7de1',
    path: '/modules/finance/index.html',
    roles: [
      { id: 'employee', label: 'موظف (إدخال فقط)' },
      { id: 'admin',    label: 'مسؤول الخزينة' }
    ]
  },
  {
    id: 'payroll',
    title: 'الرواتب',
    description: 'الموظفون والسلف والخصومات ومسيّر الرواتب والقسائم',
    icon: 'fa-file-invoice-dollar',
    color: '#22a861',
    path: '/modules/payroll/index.html'
  },
  {
    id: 'docs',
    title: 'الوثائق والمهام',
    description: 'تنبيهات انتهاء الإقامات والتأمين والعقود والرخص، وقائمة المهام',
    icon: 'fa-bell',
    color: '#e8590c',
    path: '/modules/docs/index.html'
  },
  {
    id: 'journal',
    title: 'يوميات الفروع',
    description: 'اليومية الورقية للفروع: المصروفات والسلف والشبكة والخبز',
    icon: 'fa-book-open',
    color: '#7048e8',
    path: '/modules/journal/index.html'
  }
];
