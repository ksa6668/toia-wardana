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

/**
 * يحوّل تاريخ YYYY-MM-DD إلى وسم مختصر: اليوم/أمس/قبل يومين، وإلا تاريخ مُنسّق.
 * موحّد من نماذج الإدخال (SalesFormV2 / ExpenseFormV2 / WhatsappFormV2).
 */
export function dateLabelFor(dateStr, lang = 'ar') {
  if (!dateStr) return '—';
  if (dateStr === todayLocal()) return lang === 'en' ? 'Today' : 'اليوم';
  if (dateStr === daysAgoLocal(1)) return lang === 'en' ? 'Yesterday' : 'أمس';
  if (dateStr === daysAgoLocal(2)) return lang === 'en' ? '2 days ago' : 'قبل يومين';
  // تنسيق التاريخ المخصص
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
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
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
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
