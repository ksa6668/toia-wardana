// src/i18n.js
// ----------------------------------------------------------
// نظام ترجمة (عربي / إنجليزي) لكل شاشات التطبيق.
// Batch 83: شاشات المدير أصبحت ثنائية اللغة أيضاً (كانت عربية فقط).
//
// الاستخدام:
//   import { t, translateCategory } from './i18n';
//   t(lang, 'login.title')
//   translateCategory(lang, categoryName)
// ----------------------------------------------------------

const dict = {
  // ===== شاشة الدخول =====
  'login.title':         { ar: 'نظام المبيعات والمصاريف',         en: 'Sales & Expenses System' },
  'login.subtitle':      { ar: 'Toia & Wardana Finance',           en: 'Toia & Wardana Finance' },
  'login.username':      { ar: 'اسم المستخدم',                     en: 'Username' },
  'login.usernameHint':  { ar: 'مثال: admin',                      en: 'e.g. admin' },
  'login.pin':           { ar: 'الرمز السري (4 أرقام)',            en: 'PIN (4 digits)' },
  'login.remember':      { ar: 'تذكّر اسم المستخدم',                en: 'Remember username' },
  'login.submit':        { ar: 'تسجيل الدخول',                     en: 'Sign in' },
  'login.loading':       { ar: 'جارٍ الدخول...',                   en: 'Signing in...' },
  'login.footnote':      { ar: 'الفرع يُحدد تلقائياً حسب حساب المستخدم', en: 'Branch is set automatically by your account' },
  'login.err.username':  { ar: 'أدخل اسم المستخدم',                en: 'Enter your username' },
  'login.err.pin':       { ar: 'الرمز يجب أن يكون 4 أرقام',         en: 'PIN must be 4 digits' },
  'login.err.invalid':   { ar: 'اسم المستخدم أو الرمز غير صحيح',    en: 'Invalid username or PIN' },
  'login.err.tooMany':   { ar: 'محاولات كثيرة، حاول بعد قليل',      en: 'Too many attempts, try again later' },
  'login.err.network':   { ar: 'تحقق من اتصال الإنترنت',           en: 'Check your internet connection' },
  'login.err.generic':   { ar: 'تعذّر تسجيل الدخول',                en: 'Sign-in failed' },
  'login.lang.label':    { ar: 'اللغة',                            en: 'Language' },

  // ===== القائمة الرئيسية للموظف =====
  'home.greeting':       { ar: 'مرحباً',                          en: 'Welcome' },
  'home.branch':         { ar: 'الفرع:',                          en: 'Branch:' },
  'home.recordSales':    { ar: 'تسجيل المبيعات',                  en: 'Record Sales' },
  'home.recordSalesD':   { ar: 'إجمالي يومي حسب طريقة الدفع',      en: 'Daily totals by payment method' },
  'home.recordExpense':  { ar: 'تسجيل مصروف',                     en: 'Record Expense' },
  'home.recordExpenseD': { ar: 'فاتورة واحدة لكل سجل',             en: 'One invoice per record' },
  'home.logout':         { ar: 'تسجيل خروج',                      en: 'Sign out' },
  'home.langToggle':     { ar: 'English',                         en: 'العربية' }, // الزر يعرض اللغة الأخرى
  // KPI cards on the employee home (Batch 76: أسماء مختصرة + كرت المصروفات)
  'home.kpiBudget':      { ar: 'المبيعات',                        en: 'Sales' },
  'home.kpiReviews':     { ar: 'قوقل ماب',                        en: 'Google Maps' },
  'home.kpiExpenses':    { ar: 'المصروفات',                       en: 'Expenses' },
  'home.kpiWhatsapp':    { ar: 'مبيعات الواتساب',                  en: 'WhatsApp Sales' },

  // ===== شاشة المبيعات =====
  'sales.title':         { ar: 'تسجيل المبيعات',                  en: 'Record Sales' },
  'sales.date':          { ar: 'التاريخ',                         en: 'Date' },
  'sales.branch':        { ar: 'الفرع',                           en: 'Branch' },
  'sales.cash':          { ar: 'كاش',                             en: 'Cash' },
  'sales.mada':          { ar: 'مدى',                             en: 'Mada' },
  'sales.transfer':      { ar: 'تحويل',                           en: 'Transfer' },
  'sales.total':         { ar: 'الإجمالي',                        en: 'Total' },
  'sales.currency':      { ar: 'ريال',                            en: 'SAR' },
  'sales.madaFees':      { ar: 'رسوم مدى',                        en: 'Mada Fees' },
  'sales.madaGross':     { ar: 'إجمالي مدى المُدخل:',              en: 'Mada entered (gross):' },
  'sales.madaFeesLine':  { ar: '- رسوم مدى (0.80 هلله + 15% ضريبة):', en: '- Mada fees (0.80 halalas + 15% VAT):' },
  'sales.madaNet':       { ar: 'صافي مدى:',                       en: 'Mada net:' },
  'sales.totalAfter':    { ar: 'الإجمالي بعد خصم رسوم مدى:',       en: 'Total after Mada fees:' },
  'sales.save':          { ar: 'حفظ المبيعات',                    en: 'Save Sales' },
  'sales.saving':        { ar: 'جارٍ الحفظ...',                   en: 'Saving...' },
  'sales.saved':         { ar: 'تم الحفظ بنجاح',                  en: 'Saved successfully' },
  'sales.err.amount':    { ar: 'أدخل مبلغاً واحداً على الأقل',      en: 'Enter at least one amount' },
  'sales.err.save':      { ar: 'تعذّر الحفظ',                     en: 'Save failed' },

  // ===== شاشة المصروف =====
  'expense.title':       { ar: 'تسجيل مصروف',                    en: 'Record Expense' },
  'expense.category':    { ar: 'التصنيف',                        en: 'Category' },
  'expense.chooseCat':   { ar: 'اختر التصنيف...',                en: 'Choose category...' },
  'expense.amount':      { ar: 'المبلغ',                         en: 'Amount' },
  'expense.payMethod':   { ar: 'طريقة الدفع',                    en: 'Payment Method' },
  'expense.imageReq':    { ar: 'صورة الفاتورة مطلوبة!',           en: 'Invoice image required!' },
  'expense.imageOpt':    { ar: 'صورة الفاتورة (اختياري)',         en: 'Invoice image (optional)' },
  'expense.imageReqTag': { ar: '(صورة إجبارية)',                 en: '(image required)' },
  'expense.pickImage':   { ar: 'اختيار صورة',                    en: 'Choose image' },
  'expense.change':      { ar: 'تغيير',                          en: 'Change' },
  'expense.remove':      { ar: 'حذف',                            en: 'Remove' },
  'expense.loading':     { ar: 'جارٍ التحميل...',                en: 'Loading...' },
  'expense.save':        { ar: 'حفظ المصروف',                    en: 'Save Expense' },
  'expense.saving':      { ar: 'جارٍ الحفظ...',                  en: 'Saving...' },
  'expense.uploading':   { ar: 'جارٍ رفع الصورة...',              en: 'Uploading image...' },
  'expense.saved':       { ar: 'تم الحفظ',                       en: 'Saved' },
  'expense.err.cat':     { ar: 'اختر التصنيف',                   en: 'Choose a category' },
  'expense.err.amount':  { ar: 'أدخل مبلغاً صحيحاً',              en: 'Enter a valid amount' },
  'expense.err.img':     { ar: 'صورة الفاتورة مطلوبة لهذا التصنيف', en: 'Invoice image is required for this category' },
  'expense.err.imgType': { ar: 'يجب أن يكون الملف صورة',          en: 'File must be an image' },
  'expense.err.imgSize': { ar: 'حجم الملف أكبر من 10 ميجا',        en: 'File is larger than 10 MB' },
  'expense.err.pdfType': { ar: 'يجب أن يكون الملف بصيغة PDF',      en: 'File must be a PDF' },
  'expense.err.pdfSize': { ar: 'حجم الملف أكبر من 10 ميجا',        en: 'File is larger than 10 MB' },
  'expense.err.fileType':{ ar: 'يجب أن يكون الملف صورة أو PDF',    en: 'File must be an image or PDF' },
  'expense.pdf.attach':  { ar: 'إرفاق ملف PDF',                  en: 'Attach a PDF file' },
  'expense.pdf.view':    { ar: 'عرض PDF',                        en: 'View PDF' },
  'expense.err.save':    { ar: 'تعذّر الحفظ',                    en: 'Save failed' },

  // ===== قشرة واجهة المدير (Batch 83): هيدر + شريط سفلي + شريط جانبي =====
  'admin.tab.home':          { ar: 'الرئيسية',       en: 'Home' },
  'admin.tab.monthly':       { ar: 'الكشف الشامل',   en: 'Monthly Report' },
  'admin.tab.monthlyShort':  { ar: 'كشف',            en: 'Report' },
  'admin.tab.whatsapp':      { ar: 'عملاء واتساب',   en: 'WhatsApp Customers' },
  'admin.tab.whatsappShort': { ar: 'واتساب',         en: 'WhatsApp' },
  'admin.tab.settings':      { ar: 'الإعدادات',      en: 'Settings' },
  // برنامج الولاء — نفس المفتاح لتبويب المدير وتبويب الموظف
  'admin.tab.loyalty':       { ar: 'الولاء',          en: 'Loyalty' },
  'admin.logout':            { ar: 'تسجيل الخروج',   en: 'Sign out' },
  'admin.manager':           { ar: 'المدير',         en: 'Manager' },
  'header.back':             { ar: 'رجوع',           en: 'Back' },

  // ===== أسماء طرق الدفع =====
  'pm.Cash':             { ar: 'نقدي (كاش)',                    en: 'Cash' },
  'pm.Mada':             { ar: 'مدى (شبكة)',                    en: 'Mada' },
  'pm.Transfer':         { ar: 'تحويل (أون لاين)',               en: 'Transfer (online)' },

  // ===== أسماء الفروع =====
  'br.toia':             { ar: 'تويا',                          en: 'Toia' },
  'br.wardana':          { ar: 'وردانة',                        en: 'Wardana' },
};

// ترجمة التصنيفات الافتراضية الـ 10
const categoryMap = {
  'ورد':                  'Fresh Flowers',
  'توصيل':                'Delivery',
  'طلبات العملاء':         'Customer Orders',
  'مستلزمات وبضائع':       'Supplies & Goods',
  'تسويق':                'Marketing',
  'كهرباء':               'Electricity',
  'إنترنت':               'Internet',
  'خدمات':                'Services',
  'صيانة':                'Maintenance',
  'أخرى':                 'Other',
};

// دالة الترجمة الرئيسية
export function t(lang, key) {
  const entry = dict[key];
  if (!entry) return key; // إذا المفتاح غير معروف، يرجع المفتاح نفسه (مفيد للديباغ)
  return entry[lang] || entry.ar || key;
}

// ترجمة اسم تصنيف عربي إلى إنجليزي (لو لم يوجد، يرجع الاسم العربي كما هو)
export function translateCategory(lang, name) {
  if (lang === 'ar') return name;
  return categoryMap[name] || name;
}

// ترجمة اسم فرع
export function translateBranch(lang, branchId, fallback) {
  return t(lang, `br.${branchId}`) || fallback || branchId;
}

// ترجمة اسم طريقة دفع
export function translatePM(lang, id) {
  return t(lang, `pm.${id}`) || id;
}

// تحديد اتجاه الصفحة
export function dirFor(lang) {
  return lang === 'en' ? 'ltr' : 'rtl';
}

// قراءة اللغة المحفوظة من localStorage (افتراضي: عربي)
export function readSavedLang() {
  try {
    const v = localStorage.getItem('tw_lang');
    return v === 'en' ? 'en' : 'ar';
  } catch { return 'ar'; }
}

export function saveLangLocal(lang) {
  try { localStorage.setItem('tw_lang', lang); } catch { /* ignore */ }
}
