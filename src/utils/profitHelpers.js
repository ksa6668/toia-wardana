// src/utils/profitHelpers.js
// ----------------------------------------------------------
// Batch 70: حساب إجماليات فترة (مبيعات/مصاريف/ربح) — helper مشترك
//
// مستخرج حرفياً من منطق `totals` في ManagerMonthly (Batch 57):
//   • المبيعات = صافي بعد رسوم مدى (salesNet).
//   • المصاريف = المتغيّرة + نصيب الثابت الموزّع نسبة وتناسب على
//     الأيام المسجّلة (ثابت الشهر ÷ أيام الشهر × الأيام المسجّلة).
//
// pure function: لا state ولا Firestore — يستقبل مصفوفات مفلترة جاهزة
// (بعد فلتر الفرع) ويرجع الأرقام فقط.
// ----------------------------------------------------------
// Batch 76: امتداد صريح ليعمل الملف في Node مباشرة (يستورده
// scripts/buildMonthlySummaries.mjs للتحقق) — لا تغيير سلوك في Vite
import { salesNet } from '../madaMath.js';

/**
 * @param {Array} sales          سجلات dailySales (بعد فلتر الفرع)
 * @param {Array} expenses       سجلات expenses المتغيّرة (بعد فلتر الفرع)
 * @param {Array} fixedExpenses  سجلات fixedExpenses بحقل month=YYYY-MM (بعد فلتر الفرع)
 * @returns {{ sales:number, varExpenses:number, proratedFixed:number,
 *             expenses:number, profit:number, loggedDays:Set<string> }}
 */
export function computePeriodTotals(sales, expenses, fixedExpenses) {
  const totalSales = sales.reduce((sum, s) => sum + salesNet(s), 0);
  const totalVarExp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // الأيام المسجّلة = أي يوم فيه مبيعات أو مصروف متغيّر
  const loggedDays = new Set([
    ...sales.map((s) => s.date),
    ...expenses.map((e) => e.date),
  ].filter(Boolean));

  // مجموع الثابت لكل شهر
  const fixedByMonth = {};
  fixedExpenses.forEach((f) => {
    if (!f.month) return;
    fixedByMonth[f.month] = (fixedByMonth[f.month] || 0) + (f.amount || 0);
  });

  // نصيب كل يوم مسجّل من ثابت شهره (ثابت الشهر ÷ أيام الشهر)
  let proratedFixed = 0;
  loggedDays.forEach((d) => {
    const mk = d.slice(0, 7);
    const mf = fixedByMonth[mk] || 0;
    if (mf <= 0) return;
    const [y, m] = mk.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    proratedFixed += mf / daysInMonth;
  });

  const totalExp = totalVarExp + proratedFixed;
  return {
    sales: totalSales,
    varExpenses: totalVarExp,
    proratedFixed,
    expenses: totalExp,
    profit: totalSales - totalExp,
    loggedDays,
  };
}
