// src/utils/importantDateStatus.js
// ----------------------------------------------------------
// حساب حالة المهمة المهمة (تواريخ مهمة) حسب قرب أو تأخر موعدها،
// مع ألوان ونصوص متوافقة مع هوية التطبيق. دالة نقية بلا تبعيات.
// ----------------------------------------------------------

// عدد الأيام بين اليوم وتاريخ الاستحقاق (محلي، لا UTC).
// موجب = باقٍ على الموعد، صفر = اليوم، سالب = فات الموعد (متأخر).
export function daysUntil(dueDate) {
  if (!dueDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  return Math.round((due - today) / 86400000);
}

/**
 * يرجّع وصف حالة المهمة: المفتاح، النصوص (ar/en)، وأصناف ألوان Tailwind.
 * المستويات:
 *   overdue   (< 0)   أحمر خفيف — "متأخر عن الموعد"
 *   dueToday  (= 0)   برتقالي واضح — "مستحق اليوم"
 *   soon      (1..3)  أصفر/برتقالي خفيف
 *   upcoming  (4..7)  أزرق هادئ
 *   scheduled (> 7)   محايد (لا يظهر تذكير في الرئيسية)
 */
export function importantDateStatus(dueDate) {
  const n = daysUntil(dueDate);
  if (n === null) {
    return {
      key: "scheduled", days: null,
      label: { ar: "—", en: "—" },
      // ألوان البطاقة + الشارة
      card: "bg-white border-tw-line",
      badge: "bg-tw-soft text-tw-muted",
      dot: "bg-tw-muted/50",
    };
  }
  if (n < 0) {
    return {
      key: "overdue", days: n,
      label: { ar: "متأخر عن الموعد", en: "Overdue" },
      card: "bg-red-50 border-red-200",
      badge: "bg-red-100 text-tw-red",
      dot: "bg-tw-red",
    };
  }
  if (n === 0) {
    return {
      key: "dueToday", days: 0,
      label: { ar: "مستحق اليوم", en: "Due today" },
      card: "bg-orange-50 border-orange-300",
      badge: "bg-orange-100 text-orange-700",
      dot: "bg-orange-500",
    };
  }
  if (n <= 3) {
    return {
      key: "soon", days: n,
      label: { ar: `باقٍ ${n} ${n === 1 ? "يوم" : "أيام"}`, en: `In ${n} day${n === 1 ? "" : "s"}` },
      card: "bg-amber-50 border-amber-200",
      badge: "bg-amber-100 text-tw-orange",
      dot: "bg-amber-500",
    };
  }
  if (n <= 7) {
    return {
      key: "upcoming", days: n,
      label: { ar: `باقٍ ${n} أيام`, en: `In ${n} days` },
      card: "bg-tw-soft border-tw-blue/30",
      badge: "bg-tw-soft text-tw-blue",
      dot: "bg-tw-blue",
    };
  }
  return {
    key: "scheduled", days: n,
    label: { ar: `باقٍ ${n} يوم`, en: `In ${n} days` },
    card: "bg-white border-tw-line",
    badge: "bg-tw-soft text-tw-muted",
    dot: "bg-tw-muted/50",
  };
}

// هل يجب إظهار تذكير المهمة في الصفحة الرئيسية؟
// نعم إذا كان باقٍ 7 أيام أو أقل، أو فات الموعد (متأخر) ولم يُنجز.
export function shouldRemind(dueDate) {
  const n = daysUntil(dueDate);
  return n !== null && n <= 7;
}
