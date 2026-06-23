// src/utils/dateHelpers.js
// ----------------------------------------------------------
// Batch 46.10: دوال التاريخ المحلي الموحّدة
// نتجنّب toISOString لأنه يحوّل لـ UTC، والسعودية UTC+3
// → بعد منتصف الليل المحلي، UTC لايزال في اليوم السابق
// ----------------------------------------------------------

/**
 * يحوّل Date إلى YYYY-MM-DD بالتاريخ المحلي.
 * مثال: 2026-05-25 02:00 السعودية → "2026-05-25" (وليس "2026-05-24")
 */
export function localDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * يحوّل Date إلى YYYY-MM بالتاريخ المحلي.
 */
export function localMonth(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * يعطي اليوم محلياً.
 */
export function todayLocal() {
  return localDate(new Date());
}

/**
 * يعطي تاريخ "قبل n أيام" محلياً.
 */
export function daysAgoLocal(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDate(d);
}

/**
 * يعطي الشهر الحالي (أو شهر تاريخ معيّن) بصيغة YYYY-MM محلياً.
 */
export function monthStr(d = new Date()) {
  return localMonth(d);
}

// أسماء الأشهر الميلادية — نبنيها يدوياً لضمان التقويم الميلادي.
// السبب: toLocaleDateString('ar-SA') يستخدم الهجري افتراضياً، وامتداد
// -u-ca-gregory غير موثوق على بعض الأجهزة (iOS يتجاهله عند طلب السنة).
// نفس النمط المعتمد في ImportantDatesReminders.jsx.
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// أسماء أيام الأسبوع — اليوم لا يتأثر بالتقويم (هجري/ميلادي نفس اليوم).
const WEEKDAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * يحوّل تاريخ YYYY-MM-DD إلى وسم مختصر: اليوم/أمس/قبل يومين، وإلا تاريخ مُنسّق.
 * موحّد من نماذج الإدخال (SalesFormV2 / ExpenseFormV2 / WhatsappFormV2).
 */
export function dateLabelFor(dateStr, lang = 'ar') {
  if (!dateStr) return '—';
  if (dateStr === todayLocal()) return lang === 'en' ? 'Today' : 'اليوم';
  if (dateStr === daysAgoLocal(1)) return lang === 'en' ? 'Yesterday' : 'أمس';
  if (dateStr === daysAgoLocal(2)) return lang === 'en' ? '2 days ago' : 'قبل يومين';
  // تنسيق التاريخ المخصص — ميلادي بأسماء عربية مبنية يدوياً
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = lang === 'en' ? MONTHS_EN : MONTHS_AR;
  return `${d} ${months[m - 1]} ${y}`;
}

/**
 * يحوّل تاريخ YYYY-MM-DD إلى ترويسة يوم في قوائم "آخر 7 أيام":
 * اليوم/أمس، وإلا اسم اليوم + التاريخ المختصر.
 * موحّد من RecHistorySection / WhatsappRecHistory.
 */
export function formatDayHeader(dateStr, lang = 'ar') {
  if (!dateStr) return '—';
  if (dateStr === todayLocal()) return lang === 'en' ? 'Today' : 'اليوم';
  if (dateStr === daysAgoLocal(1)) return lang === 'en' ? 'Yesterday' : 'أمس';
  // ميلادي بأسماء عربية مبنية يدوياً (اسم اليوم + اليوم + الشهر)
  const [y, m, d] = dateStr.split('-').map(Number);
  const weekdayIdx = new Date(y, m - 1, d).getDay();
  const weekdays = lang === 'en' ? WEEKDAYS_EN : WEEKDAYS_AR;
  const months = lang === 'en' ? MONTHS_EN : MONTHS_AR;
  return `${weekdays[weekdayIdx]}، ${d} ${months[m - 1]}`;
}

/**
 * يحسب نطاق التاريخ حسب الفترة المختارة.
 * يدعم: يومي / أسبوعي / شهري / ربع سنوي / سنوي / مخصص
 * يعتمد على التاريخ المحلي (وليس UTC) لتجنّب فرق المنطقة الزمنية (السعودية UTC+3).
 */
export function periodRange(period, customFrom, customTo) {
  const now = new Date();
  const iso = (d) => localDate(d);
  const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  if (period === 'مخصص' && customFrom && customTo) {
    const f = new Date(customFrom);
    const t = new Date(customTo);
    const days = Math.max(1, Math.round((t - f) / 86400000) + 1);
    return { from: customFrom, to: customTo, days, daysInMonth: daysInMonth(now), periodKind: 'custom' };
  }

  if (period === 'يومي') {
    const d = iso(now);
    return { from: d, to: d, days: 1, daysInMonth: daysInMonth(now), periodKind: 'daily' };
  }

  if (period === 'أسبوعي') {
    // الأسبوع الجاري: من الأحد إلى اليوم الحالي (في السعودية الأسبوع يبدأ الأحد)
    const day = now.getDay(); // 0=Sun
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    return {
      from: iso(start),
      to: iso(now),
      days: day + 1,
      daysInMonth: daysInMonth(now),
      periodKind: 'weekly',
    };
  }

  if (period === 'شهري') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: iso(first),
      to: iso(last),
      days: now.getDate(),
      daysInMonth: last.getDate(),
      periodKind: 'monthly',
    };
  }

  if (period === 'ربع سنوي') {
    // الربع الحالي: يحتوي 3 أشهر
    const quarter = Math.floor(now.getMonth() / 3);
    const first = new Date(now.getFullYear(), quarter * 3, 1);
    const last = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    const days = Math.round((now - first) / 86400000) + 1;
    return {
      from: iso(first),
      to: iso(last),
      days,
      daysInMonth: daysInMonth(now),
      periodKind: 'quarterly',
    };
  }

  // سنوي (افتراضي)
  const first = new Date(now.getFullYear(), 0, 1);
  const last = new Date(now.getFullYear(), 11, 31);
  const dayOfYear = Math.floor((now - first) / 86400000) + 1;
  return {
    from: iso(first),
    to: iso(last),
    days: dayOfYear,
    daysInMonth: 30,
    periodKind: 'yearly',
  };
}
