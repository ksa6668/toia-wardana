// src/utils/kpiHelpers.js
// ----------------------------------------------------------
// Batch 88: منطق حساب المؤشرات — منقول حرفياً من شاشة المؤشرات
// (ManagerKpis المحذوفة) ليُستدعى من الكشف الشامل (ManagerMonthly).
//
// pure functions: لا state ولا Firestore — تستقبل مصفوفات مفلترة
// جاهزة (بعد فلتر الفرع) وترجع أرقاماً فقط.
// ----------------------------------------------------------
import { salesNet, madaNetOf } from '../madaMath';

// Batch 52: دالة آمنة للنسبة - تتعامل مع القسمة على صفر
// - لو المقام = 0: نُرجع 0 (لا توجد مبيعات في الفترة)
// - السماح بنسب سالبة (للربح) وفوق 100% (للمصاريف)
const safePct = (numerator, denominator) => {
  if (!denominator || denominator === 0) return 0;
  const result = (numerator / denominator) * 100;
  return Number.isFinite(result) ? result : 0;
};

/**
 * كروت أداء الفترة (أسابيع/أرباع/أنصاف): لكل نطاق مبلغ صافي المبيعات
 * ونسبته من إجمالي الفترة — نفس حسبة periodCards في شاشة المؤشرات حرفياً.
 * @param {Array} ranges نواتج splitMonthToWeeks / splitYearToQuarters / splitYearToHalves
 * @param {Array} sales  سجلات dailySales (بعد فلتر الفرع، ضمن نطاق الفترة كاملة)
 * @returns {Array<{label:string, amount:number, pct:string}>}
 */
export function computePeriodCards(ranges, sales, lang = 'ar') {
  const totalAll = sales.reduce((sum, s) => sum + salesNet(s), 0) || 1;
  return ranges.map((r) => {
    const slice = sales.filter((s) => s.date >= r.from && s.date <= r.to);
    const amount = slice.reduce((sum, s) => sum + salesNet(s), 0);
    const pct = ((amount / totalAll) * 100).toFixed(1);
    return {
      label: lang === 'en' ? r.labelEn : r.labelAr,
      amount,
      pct,
    };
  });
}

/**
 * النسب الثلاث — نفس حسبة kpiRows في شاشة المؤشرات حرفياً:
 *   • نسبة صافي الربح من المبيعات (الثابت موزّع نسبة وتناسب على الأيام المسجّلة — Batch 58)
 *   • نسبة الأون لاين من المتجر (التحويل ÷ كاش + مدى صافي)
 *   • نسبة إجمالي المصروفات من المبيعات (المتغيّرة فقط — الثابتة تدخل في صافي الربح وحده)
 * @param {Array} sales          سجلات dailySales (بعد فلتر الفرع)
 * @param {Array} expenses       سجلات expenses المتغيّرة (بعد فلتر الفرع، بدون فلتر تصنيف)
 * @param {Array} fixedExpenses  سجلات fixedExpenses بحقل month=YYYY-MM (بعد فلتر الفرع)
 * @returns {{ netProfitPct:number, onlinePct:number, expensesPct:number }}
 */
export function computeKpiRatios(sales, expenses, fixedExpenses) {
  // Batch 29: نستخدم madaNet (بعد رسوم مدى) ليطابق netTotal — مبالغ الحساب البنكي الفعلية
  const totalCash = sales.reduce((s, x) => s + (Number(x.cash) || 0), 0);
  // D5: مصدر واحد madaNetOf — سلوك مطابق للكود السابق
  const totalMadaNet = sales.reduce((s, x) => s + madaNetOf(x), 0);
  const totalTransfer = sales.reduce((s, x) => s + (Number(x.transfer) || 0), 0);
  // Batch 52: إجمالي المبيعات الحقيقي (يطابق salesNet)
  const totalSales = totalCash + totalMadaNet + totalTransfer;
  const storeOnly = totalCash + totalMadaNet; // كاش + مدى صافي = المتجر

  // Batch 50: إجمالي كل المصاريف المتغيرة
  const totalVarExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  // Batch 51: المصاريف الثابتة + صافي الربح
  // Batch 58: الثابت يُوزّع نسبة وتناسب على الأيام المسجّلة (نفس منطق الكشف الشامل Batch 57)
  //           بدل تحميل الشهر كاملاً — حتى لا تتشوّه نسبة صافي الربح في الشهر الجاري.
  const fixedByMonth = {};
  fixedExpenses.forEach((f) => {
    if (!f.month) return;
    fixedByMonth[f.month] = (fixedByMonth[f.month] || 0) + (Number(f.amount) || 0);
  });
  const loggedDays = new Set([
    ...sales.map((s) => s.date),
    ...expenses.map((e) => e.date),
  ].filter(Boolean));
  let totalFixedExpenses = 0;
  loggedDays.forEach((d) => {
    const mk = d.slice(0, 7);
    const mf = fixedByMonth[mk] || 0;
    if (mf > 0) {
      const [y, m] = mk.split('-').map(Number);
      totalFixedExpenses += mf / new Date(y, m, 0).getDate();
    }
  });
  const totalAllExpenses = totalVarExpenses + totalFixedExpenses;
  const netProfit = totalSales - totalAllExpenses;

  return {
    netProfitPct: safePct(netProfit, totalSales),
    onlinePct: safePct(totalTransfer, storeOnly),
    expensesPct: safePct(totalVarExpenses, totalSales),
  };
}
