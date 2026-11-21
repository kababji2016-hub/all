// ============================================================
//  إعدادات مشروع Firebase الجديد — الخاص بالنظام الشامل فقط
//  ------------------------------------------------------------
//  1) أنشئ مشروعاً جديداً من https://console.firebase.google.com
//  2) أضف تطبيق ويب (Web App) وانسخ القيم هنا بدل PUT_...
//  3) فعّل Authentication ← Sign-in method ← Email/Password
//  4) فعّل Firestore Database
//  (هذه القيم ليست سرية — الحماية الفعلية في firestore.rules)
// ============================================================
window.ALL_FIREBASE_CONFIG = {
  apiKey:            "PUT_API_KEY",
  authDomain:        "PUT_PROJECT_ID.firebaseapp.com",
  projectId:         "PUT_PROJECT_ID",
  storageBucket:     "PUT_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PUT_SENDER_ID",
  appId:             "PUT_APP_ID"
};
