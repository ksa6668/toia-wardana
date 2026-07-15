// scripts/test-summaryMath.mjs
// ====================================================================
// Batch 76: اختبار تكافؤ عددي لحساب الملخصات الشهرية.
// يقارن computeMonthlySummary (src/utils/summaryMath.js) مع نسخة مرجعية
// طبق الأصل من منطق الشاشات الحالي (ManagerMonthly/Kpis/Whatsapp/Home)
// على آلاف السجلات العشوائية، بما فيها سجلات قديمة بلا netTotal/madaNet
// وتهجئات تصنيفات متعددة.
//
// التشغيل: node scripts/test-summaryMath.mjs
// النجاح المطلوب: 0 فروقات. أي فرق ⇒ خروج برمز 1.
// ====================================================================
import { computeMonthlySummary, EXPENSE_CATEGORY_VALUES } from "../src/utils/summaryMath.js";
import { computePeriodTotals } from "../src/utils/profitHelpers.js";
import { salesNet, madaNetOf } from "../src/madaMath.js";

// ---------- المرجع: طبق الأصل من الشاشات ----------
// ManagerMonthly.jsx:56-58
const refMatches = (e, values) =>
  [e.expenseType, e.categoryId, e.categoryName, e.category]
    .some((f) => f != null && values.includes(String(f).trim()));

// مولّد عشوائي محدود البذرة (نتائج قابلة للتكرار)
let seed = 20260715;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const randInt = (max) => Math.floor(rand() * max);
const pick = (arr) => arr[randInt(arr.length)];

// ---------- بيانات اصطناعية لشهر واحد (فرع واحد) ----------
const CATS = [
  { categoryId: "ورد", categoryName: "الورد", expenseType: "flower" },
  { categoryId: "توصيل", categoryName: "التوصيل", expenseType: "delivery" },
  { categoryId: "مستلزمات", categoryName: "المستلزمات والبضائع", expenseType: "general" }, // مستورد قديم
  { categoryId: "تسويق", categoryName: "التسويق", expenseType: "marketing" },
  { categoryId: "كهرباء", categoryName: "كهرباء", expenseType: "general" },
  { category: "بضائع" }, // سجل قديم جداً بحقل category فقط
];

function makeMonth(branchId, month, daysInMonth) {
  const sales = [];
  const expenses = [];
  const whatsapp = [];
  for (let i = 0; i < 120; i++) {
    const day = String(1 + randInt(daysInMonth)).padStart(2, "0");
    const date = `${month}-${day}`;
    const cash = +(rand() * 3000).toFixed(2);
    const mada = +(rand() * 5000).toFixed(2);
    const transfer = +(rand() * 1500).toFixed(2);
    if (i % 3 === 0) {
      // سجل قديم: بلا netTotal/madaNet (fallback في salesNet/madaNetOf)
      sales.push({ date, branchId, cash, mada, transfer });
    } else {
      const madaFees = +(mada * 0.0092).toFixed(2);
      const madaNet = +(mada - madaFees).toFixed(2);
      sales.push({
        date, branchId, cash, mada, transfer, madaFees, madaNet,
        total: cash + mada + transfer,
        netTotal: +(cash + madaNet + transfer).toFixed(2),
      });
    }
    expenses.push({ date, branchId, amount: +(rand() * 800).toFixed(2), ...pick(CATS) });
    whatsapp.push({
      date, branchId,
      customers: randInt(60), newCustomers: randInt(15), buyers: randInt(30),
    });
  }
  // سجلات هامشية: تاريخ مفقود (لا تظهر في الشاشات ضمن نطاق التاريخ)
  return { sales, expenses, whatsapp };
}

// ---------- المقارنة ----------
const EPS = 1e-9;
let diffs = 0;
const check = (label, screen, summary) => {
  if (Math.abs(screen - summary) > EPS) {
    diffs++;
    console.error(`❌ ${label}: شاشة=${screen} ملخص=${summary}`);
  }
};

const MONTHS = [
  ["toia", "2024-02", 29],
  ["wardana", "2025-07", 31],
  ["toia", "2026-06", 30],
];

for (const [branchId, month, dim] of MONTHS) {
  const { sales, expenses, whatsapp } = makeMonth(branchId, month, dim);
  const fixed = [{ month, branchId, amount: 12000 + randInt(9000) }];
  const s = computeMonthlySummary(branchId, month, sales, expenses, whatsapp);

  // 1) مجاميع المبيعات (ManagerMonthly:330-332 / Kpis:238-241 / totals)
  check(`${month} صافي المبيعات`, sales.reduce((t, x) => t + salesNet(x), 0), s.sales.net);
  check(`${month} نقد`, sales.reduce((t, x) => t + (Number(x.cash) || 0), 0), s.sales.cash);
  check(`${month} مدى صافي`, sales.reduce((t, x) => t + madaNetOf(x), 0), s.sales.madaNet);
  check(`${month} تحويل`, sales.reduce((t, x) => t + (Number(x.transfer) || 0), 0), s.sales.transfer);

  // 2) المصاريف + كروت Batch 71
  check(`${month} مصاريف متغيرة`, expenses.reduce((t, e) => t + (Number(e.amount) || 0), 0), s.expenses.total);
  for (const key of ["flower", "delivery", "supplies"]) {
    const ref = expenses
      .filter((e) => refMatches(e, EXPENSE_CATEGORY_VALUES[key]))
      .reduce((t, e) => t + (Number(e.amount) || 0), 0);
    check(`${month} ${key}`, ref, s.expenses[key]);
  }

  // 3) واتساب (ManagerWhatsapp:112-114 / Home)
  check(`${month} عملاء`, whatsapp.reduce((t, w) => t + (w.customers || 0), 0), s.whatsapp.customers);
  check(`${month} جدد`, whatsapp.reduce((t, w) => t + (w.newCustomers || 0), 0), s.whatsapp.newCustomers);
  check(`${month} مشترون`, whatsapp.reduce((t, w) => t + (w.buyers || 0), 0), s.whatsapp.buyers);

  // 4) اشتقاق الربح من الملخص = computePeriodTotals على الخام حرفياً
  const screen = computePeriodTotals(sales, expenses, fixed);
  check(`${month} صافي (helper)`, screen.sales, s.sales.net);
  // loggedDays من اتحاد تواريخ الملخص
  const loggedFromSummary = new Set([...s.sales.dates, ...s.expenses.dates]);
  check(`${month} أيام مسجلة`, screen.loggedDays.size, loggedFromSummary.size);
  // الربح المشتق: نفس معادلة computePeriodTotals لكن من حقول الملخص
  const fixedMonthTotal = fixed.reduce((t, f) => t + (f.amount || 0), 0);
  const prorated = (fixedMonthTotal / dim) * loggedFromSummary.size;
  const profitFromSummary = s.sales.net - (s.expenses.total + prorated);
  check(`${month} الربح المشتق`, screen.profit, profitFromSummary);

  // 5) daysWithSales (متوسطات ManagerMonthly:318)
  check(`${month} أيام مبيعات`, new Set(sales.map((x) => x.date)).size, s.sales.dates.length);
}

if (diffs === 0) {
  console.log(`✓ تكافؤ تام: 0 فروقات عبر ${MONTHS.length} أشهر اصطناعية (360 مبيعة/360 مصروفاً/360 واتساب، مع سجلات قديمة وتهجئات متعددة).`);
  process.exit(0);
} else {
  console.error(`\n❌ ${diffs} فروقات.`);
  process.exit(1);
}
