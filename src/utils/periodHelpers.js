// src/utils/periodHelpers.js
// ----------------------------------------------------------
// أدوات مساعدة لحساب نطاقات التواريخ — مستخدمة في شاشات المدير
// (Monthly, Overview, KPIs, Home)
//
// كلها pure functions: لا تعتمد على state أو على Firestore.
// الـ Firestore queries تستخدم النواتج لتصفية البيانات.
// ----------------------------------------------------------

// Batch 46.10: التاريخ المحلي (وليس UTC) لتجنّب فرق المنطقة الزمنية
// السعودية UTC+3 → toISOString يعطي يوم سابق بعد منتصف الليل
function _localDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * يعطي نطاق التاريخ (from, to) من شهر YYYY-MM.
 * مثال: monthRange('2026-05') → { from: '2026-05-01', to: '2026-05-31', days: 31 }
 * Batch 35: نبني السلسلة مباشرة (بدون Date + toISOString) لتجنّب UTC conversion
 * الذي كان يُسبب ظهور 30 إبريل في كشف مايو بسبب فرق التوقيت السعودي.
 */
export function monthRange(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  // اليوم الأخير من الشهر: نُنشئ Date لليوم 0 من الشهر التالي ونأخذ getDate()
  // (هذي العملية لا تتأثر بالـ timezone لأننا نقرأ getDate وليس ISO)
  const days = new Date(y, m, 0).getDate();
  // بناء النص مباشرة:
  const mm = String(m).padStart(2, '0');
  const dd = String(days).padStart(2, '0');
  return {
    from: `${y}-${mm}-01`,
    to:   `${y}-${mm}-${dd}`,
    days,
    year: y,
    month: m,
  };
}

/**
 * يعطي نطاق السنة كاملة.
 */
export function yearRange(year) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    days: isLeapYear(year) ? 366 : 365,
    year,
  };
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * يعطي قائمة الأشهر السابقة بصيغة YYYY-MM، الأحدث أولاً.
 * Batch 34: يبدأ من يناير 2024 ليشمل بيانات ما قبل الإطلاق (Pre-Expenses).
 */
export function getAvailableMonths() {
  const START = { y: 2024, m: 1 }; // يناير 2024
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  if (y < START.y || (y === START.y && m < START.m)) {
    y = START.y;
    m = START.m;
  }
  const list = [];
  while (y > START.y || (y === START.y && m >= START.m)) {
    list.push(`${y}-${String(m).padStart(2, '0')}`);
    m--;
    if (m === 0) { m = 12; y--; }
  }
  return list;
}

/**
 * قائمة السنوات: من 2024 إلى السنة الحالية، الأحدث أولاً.
 * Batch 34: السنة الافتتاحية صارت 2024.
 */
export function getAvailableYears() {
  const START = 2024;
  const now = new Date().getFullYear();
  const end = Math.max(now, START);
  const list = [];
  for (let y = end; y >= START; y--) list.push(y);
  return list;
}

/**
 * Batch 18: يرجع 3 أشهر قادمة بدءاً من الشهر الحالي بصيغة YYYY-MM.
 * يستخدم لشاشة الأهداف الشهرية (التاريخ دائماً للأشهر الـ3 القادمة).
 */
export function getNext3Months() {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth() + 1; // 1-12
  const list = [];
  for (let i = 0; i < 3; i++) {
    list.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return list;
}

/**
 * تنسيق YYYY-MM إلى اسم شهر مفهوم.
 * مثال: '2026-05' بالعربي → 'مايو 2026'
 */
export function formatMonthLabel(monthStr, lang = 'ar') {
  const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthsEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const [y, m] = monthStr.split('-').map(Number);
  const arr = lang === 'en' ? monthsEn : monthsAr;
  return `${arr[m - 1]} ${y}`;
}

/**
 * يقسم الشهر إلى 4 أسابيع (تقريبية، 7 أيام كل أسبوع).
 * يرجع: [{ label, from, to }, ...]
 */
export function splitMonthToWeeks(monthStr) {
  const { from, to, days } = monthRange(monthStr);
  const [y, m] = monthStr.split('-').map(Number);
  const weeks = [];
  const labels = ['الأسبوع الأول', 'الأسبوع الثاني', 'الأسبوع الثالث', 'الأسبوع الرابع'];
  const labelsEn = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  // تقسيم بسيط: 1-7, 8-14, 15-21, 22-end
  const ranges = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, days],
  ];
  ranges.forEach((r, i) => {
    const fd = new Date(y, m - 1, r[0]);
    const td = new Date(y, m - 1, r[1]);
    weeks.push({
      labelAr: labels[i],
      labelEn: labelsEn[i],
      from: _localDate(fd),
      to: _localDate(td),
    });
  });
  return weeks;
}

/**
 * يقسم السنة إلى 4 أرباع.
 */
export function splitYearToQuarters(year) {
  const labels = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
  const labelsEn = ['Q1', 'Q2', 'Q3', 'Q4'];
  const quarters = [];
  for (let q = 0; q < 4; q++) {
    const fm = q * 3;        // 0, 3, 6, 9
    const lm = fm + 2;       // 2, 5, 8, 11
    const fd = new Date(year, fm, 1);
    const ld = new Date(year, lm + 1, 0);
    quarters.push({
      labelAr: labels[q],
      labelEn: labelsEn[q],
      from: _localDate(fd),
      to: _localDate(ld),
    });
  }
  return quarters;
}

/**
 * يحوّل تاريخ ISO إلى نص يوم/تاريخ مختصر بالعربية:
 * '2026-05-21' → '21 مايو'
 */
export function formatDayShort(isoDate, lang = 'ar') {
  const d = new Date(isoDate);
  const monthsAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthsEn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const arr = lang === 'en' ? monthsEn : monthsAr;
  return `${d.getDate()} ${arr[d.getMonth()]}`;
}
