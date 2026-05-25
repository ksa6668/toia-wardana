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
