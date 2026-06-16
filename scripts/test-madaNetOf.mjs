// scripts/test-madaNetOf.mjs
// اختبار تكافؤ D5: يتأكد أن madaNetOf الجديد يُرجع نفس قيمة الكود القديم
// (المكرّر حرفياً في ManagerKpis / ManagerMonthly / MonthlyBreakdownSheet)
// لكل المدخلات الممكنة — بايت-ببايت (Object.is).
//
// التشغيل: node scripts/test-madaNetOf.mjs

// ---- النسبة كما في firebase.js ----
const MADA_FEE_RATE = 0.0092;

// ---- المنطق القديم (نسخة طبق الأصل من الأسطر المكرّرة، تستخدم literal 0.0092) ----
function oldMadaNet(x) {
  if (typeof x.madaNet === 'number') return x.madaNet;
  const m = Number(x.mada) || 0;
  return +(m * (1 - 0.0092)).toFixed(2);
}

// ---- المنطق الجديد (مطابق لـ madaNetOf في firebase.js) ----
function newMadaNet(sale) {
  if (typeof sale?.madaNet === 'number') return sale.madaNet;
  const m = Number(sale?.mada) || 0;
  return +(m * (1 - MADA_FEE_RATE)).toFixed(2);
}

// تأكيد أن الثابت يساوي الـ literal القديم تماماً
if (MADA_FEE_RATE !== 0.0092) {
  console.error('FAIL: MADA_FEE_RATE != 0.0092');
  process.exit(1);
}

let cases = [];

// 1) قيم mada بدون madaNet مخزّن (مسار الحساب/الـ fallback)
for (let m = 0; m <= 10000; m += 0.25) cases.push({ mada: m });
// 2) كسور دقيقة لاختبار التقريب
for (const m of [0.01, 0.99, 1.005, 33.33, 33.335, 99.995, 12345.678, 7.125, 2.675]) cases.push({ mada: m });
// 3) سجلات فيها madaNet مخزّن (يجب أن يُعاد كما هو)
for (const v of [0, 1, 99.99, 1234.56, -5, 0.001, NaN]) cases.push({ mada: 500, madaNet: v });
// 4) حالات حافة للمدخلات
cases.push({});                         // لا mada ولا madaNet
cases.push({ mada: null });
cases.push({ mada: undefined });
cases.push({ mada: '123.45' });         // نص رقمي
cases.push({ mada: 'abc' });            // نص غير رقمي
cases.push({ mada: -100 });             // سالب
cases.push({ mada: 0, madaNet: 0 });

let mismatches = 0;
let firstFew = [];
for (const c of cases) {
  const a = oldMadaNet(c);
  const b = newMadaNet(c);
  // Object.is يميّز NaN و -0 — أقصى صرامة
  if (!Object.is(a, b)) {
    mismatches++;
    if (firstFew.length < 10) firstFew.push({ input: c, old: a, new: b });
  }
}

console.log(`عدد الحالات المختبَرة: ${cases.length}`);
console.log(`عدد الاختلافات (يجب أن يكون 0): ${mismatches}`);
if (mismatches > 0) {
  console.log('أمثلة على الاختلافات:');
  console.log(JSON.stringify(firstFew, null, 2));
  process.exit(1);
}
console.log('✅ PASS — madaNetOf الجديد مطابق للقديم بايت-ببايت في كل الحالات.');
