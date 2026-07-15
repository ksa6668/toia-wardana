// src/utils/summaryMath.js
// ====================================================================
// Batch 76: حساب مستند الملخص الشهري (monthlySummaries) — دوال نقية.
//
// المبدأ الحاكم: الملخص «يعكس» منطق الشاشات الحالي ولا يعيد تعريفه —
// كل مجموع هنا مشتق من نفس الدوال/التعابير التي تجمع بها الشاشات اليوم:
//   • sales.net      = Σ salesNet(s)                (ManagerMonthly/Kpis/Home)
//   • sales.cash     = Σ Number(s.cash)||0          (ManagerMonthly:330, Kpis:238)
//   • sales.madaNet  = Σ madaNetOf(s)               (ManagerMonthly:331, Kpis:240)
//   • sales.transfer = Σ Number(s.transfer)||0      (ManagerMonthly:332, Kpis:241)
//   • expenses.total = Σ Number(e.amount)||0        (computePeriodTotals)
//   • expenses.flower/delivery/supplies             (كروت Batch 71)
//   • whatsapp.customers/newCustomers/buyers        (ManagerWhatsapp/Home)
//   • sales.dates / expenses.dates: التواريخ الفريدة — منها تُشتق
//     daysWithSales و loggedDays (توزيع الثابت في computePeriodTotals).
//
// لا نخزّن الربح ولا نصيب الثابت الموزّع: هذه مشتقات وقت-قراءة تعتمد
// fixedExpenses (المجمّعة شهرياً أصلاً) + التواريخ المخزّنة هنا.
//
// المجاميع تُخزّن كما تنتجها reduce بلا تقريب — التقريب مسؤولية العرض
// (كما تفعل الشاشات الآن).
//
// ملف نقي بلا Firestore ⇒ يستورده كلٌّ من src/firebaseSummaries.js
// (التحديث الحي) و scripts/buildMonthlySummaries.mjs (الـ backfill)،
// فيستحيل اختلاف الحسبة بين المسارين.
// ====================================================================
// الامتداد الصريح ليعمل الملف في Node مباشرة (scripts/*) كما في Vite
import { salesNet, madaNetOf } from '../madaMath.js';

export const SUMMARY_SCHEMA_VERSION = 1;

// ⚠️ يجب أن تبقى القيم مطابقة حرفياً لـ EXPENSE_CATEGORY_CARDS في
// ManagerMonthly.jsx (Batch 71) — لم نستورد من ملف الشاشة حتى لا تعتمد
// طبقة البيانات على مكوّن UI (نفس سابقة PIN_SUFFIX المكرّرة بين
// firebaseAuth.js و api/admin.js الموثّقة في CLAUDE.md).
export const EXPENSE_CATEGORY_VALUES = {
  flower:   ['flower', 'ورد', 'الورد'],
  delivery: ['delivery', 'توصيل', 'التوصيل'],
  supplies: ['supplies', 'مستلزمات وبضائع', 'المستلزمات والبضائع', 'مستلزمات', 'المستلزمات', 'بضائع'],
};

// نفس مطابقة ManagerMonthly.jsx:56-58 (expenseMatchesValues) حرفياً
export const expenseMatchesValues = (e, values) =>
  [e.expenseType, e.categoryId, e.categoryName, e.category]
    .some((f) => f != null && values.includes(String(f).trim()));

// تواريخ فريدة مرتبة (نفس أثر new Set في الشاشات، والترتيب للثبات)
const uniqueDates = (records) =>
  [...new Set(records.map((r) => r.date).filter(Boolean))].sort();

/**
 * يحسب حمولة مستند ملخص شهر واحد لفرع واحد.
 * المدخلات: سجلات خام مقصورة مسبقاً على (branchId, month).
 * لا يضيف حقول التتبّع (source/lastComputedAt) — مسؤولية الكاتب.
 */
export function computeMonthlySummary(branchId, month, sales, expenses, whatsapp) {
  return {
    branchId,
    month,
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    sales: {
      net: sales.reduce((sum, s) => sum + salesNet(s), 0),
      cash: sales.reduce((sum, s) => sum + (Number(s.cash) || 0), 0),
      madaNet: sales.reduce((sum, s) => sum + madaNetOf(s), 0),
      transfer: sales.reduce((sum, s) => sum + (Number(s.transfer) || 0), 0),
      count: sales.length,          // حقل تتبّع/تحقّق — لا تعرضه الشاشات
      dates: uniqueDates(sales),    // منه daysWithSales
    },
    expenses: {
      total: expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      flower: expenses
        .filter((e) => expenseMatchesValues(e, EXPENSE_CATEGORY_VALUES.flower))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      delivery: expenses
        .filter((e) => expenseMatchesValues(e, EXPENSE_CATEGORY_VALUES.delivery))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      supplies: expenses
        .filter((e) => expenseMatchesValues(e, EXPENSE_CATEGORY_VALUES.supplies))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
      count: expenses.length,       // تتبّع/تحقّق
      dates: uniqueDates(expenses), // مع sales.dates ⇒ loggedDays (اتحاد)
    },
    whatsapp: {
      customers: whatsapp.reduce((sum, w) => sum + (w.customers || 0), 0),
      newCustomers: whatsapp.reduce((sum, w) => sum + (w.newCustomers || 0), 0),
      buyers: whatsapp.reduce((sum, w) => sum + (w.buyers || 0), 0),
      count: whatsapp.length,       // تتبّع/تحقّق
    },
  };
}
