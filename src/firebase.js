// src/firebase.js
// ====================================================================
// Barrel موحّد لطبقة البيانات (§S1 — اكتمل التقسيم).
//
// هذا الملف لم يعد يحوي منطقاً — هو نقطة استيراد واحدة تُعيد تصدير كل
// الوحدات، حتى تبقى كل استيرادات المكوّنات `from '../firebase'` كما هي تماماً.
//
// التهيئة (app/auth/db) في firebaseCore.js (ورقة بلا تبعيات)، وكل وحدة تستورد
// db/auth منها مباشرةً ⇒ لا دورة وقت-تحميل حول التهيئة.
//
// الوحدات:
//   firebaseCore      → auth, db
//   firebaseAuth      → login/logout/watchAuth/createStaffUser/markActive/
//                       isSessionExpired/pinToPassword
//   firebaseExpenses  → classifyExpense + المصاريف المتغيرة/الثابتة
//   firebaseCatalog   → الفروع/طرق الدفع/التصنيفات
//   firebaseSales     → MADA_FEE_RATE/salesNet/madaNetOf/madaFees/madaNet + المبيعات
//                       (الرياضيات النقية في madaMath.js يُعيد تصديرها firebaseSales)
//   firebaseWhatsapp  → عملاء واتساب + baseline
//   firebaseGoals     → الأهداف الشهرية
//   firebaseTelegram  → إشعارات Telegram + clearUserNameCache
//   firebaseUsers     → إدارة المستخدمين
//   firebaseSettings  → الإعدادات العامة
//   firebaseStorage   → رفع صورة الفاتورة (R2)
//   firebaseBackup    → النسخ الاحتياطي/الاستيراد/إعادة التعيين
//   (cache في firebaseCache.js — أداة داخلية لا تُصدَّر هنا)
// ====================================================================
export * from './firebaseCore';
export * from './firebaseAuth';
export * from './firebaseExpenses';
export * from './firebaseCatalog';
export * from './firebaseSales';
export * from './firebaseWhatsapp';
export * from './firebaseGoals';
export * from './firebaseTelegram';
export * from './firebaseUsers';
export * from './firebaseSettings';
export * from './firebaseStorage';
export * from './firebaseBackup';
export * from './firebaseImportantDates';
