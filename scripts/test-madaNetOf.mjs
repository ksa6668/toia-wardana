// scripts/test-madaNetOf.mjs
// ====================================================================
// اختبار تكافؤ عددي للمرحلة 9 (استخراج sales/MADA).
// يستورد الدوال المالية الفعلية الجديدة من src/madaMath.js
// (المصدر الحقيقي بعد الاستخراج؛ firebaseSales.js و firebase.js يُعيدان تصديرها)
// ويقارن مخرجاتها مع نسخة مرجعية من المنطق الأصلي على آلاف الحالات.
//
// التشغيل: node scripts/test-madaNetOf.mjs
// النجاح المطلوب: 0 فروقات. أي فرق ⇒ خروج برمز 1.
// ====================================================================
import {
  MADA_FEE_RATE as NEW_RATE,
  madaFees as newMadaFees,
  madaNet as newMadaNet,
  salesNet as newSalesNet,
  madaNetOf as newMadaNetOf,
} from "../src/madaMath.js";

// ---------- المرجع: نسخة طبق الأصل من المنطق الأصلي في firebase.js ----------
const REF_RATE = 0.0092;
function refMadaFees(grossMada) {
  const g = Number(grossMada) || 0;
  return +(g * REF_RATE).toFixed(2);
}
function refMadaNet(grossMada) {
  const g = Number(grossMada) || 0;
  return +(g * (1 - REF_RATE)).toFixed(2);
}
function refSalesNet(sale) {
  if (!sale) return 0;
  if (typeof sale.netTotal === 'number' && !Number.isNaN(sale.netTotal)) {
    return sale.netTotal;
  }
  const cashN = Number(sale.cash) || 0;
  const madaN = Number(sale.mada) || 0;
  const transferN = Number(sale.transfer) || 0;
  const fees = +(madaN * REF_RATE).toFixed(2);
  return +(cashN + (madaN - fees) + transferN).toFixed(2);
}
function refMadaNetOf(sale) {
  if (typeof sale?.madaNet === 'number') return sale.madaNet;
  const m = Number(sale?.mada) || 0;
  return +(m * (1 - REF_RATE)).toFixed(2);
}

// ---------- تأكيد الثابت ----------
let total = 0;
let mismatches = 0;
const samples = [];
function check(label, a, b, ctx) {
  total++;
  if (!Object.is(a, b)) {
    mismatches++;
    if (samples.length < 12) samples.push({ label, ctx, ref: a, neu: b });
  }
}

check('MADA_FEE_RATE', REF_RATE, NEW_RATE, 'const');

// ---------- توليد قيم مدى: 0 → 100000 بخطوة 0.25 + كسور هللات دقيقة + حواف ----------
const madaValues = [];
for (let v = 0; v <= 100000; v += 0.25) madaValues.push(v);
for (const x of [0.01, 0.02, 0.03, 0.07, 0.99, 1.005, 1.015, 2.675, 33.33, 33.335,
                 99.995, 100.005, 12345.678, 7.125, 0.001, 0.005, 54.545, 76.765]) madaValues.push(x);
for (const x of [-0.01, -1, -100, -9999.99]) madaValues.push(x);     // سالبة (حافة)
for (const x of [1e6, 5e6, 99999999.99]) madaValues.push(x);          // ضخمة
for (const x of [null, undefined, '', 'abc', '123.45', NaN]) madaValues.push(x); // غير رقمية

// 1) madaFees / madaNet على كل قيمة
for (const m of madaValues) {
  check('madaFees', refMadaFees(m), newMadaFees(m), m);
  check('madaNet', refMadaNet(m), newMadaNet(m), m);
}

// 2) madaNetOf: سجلات بـ mada (fallback) + سجلات بـ madaNet مخزّن + حواف
for (const m of madaValues) {
  check('madaNetOf(mada)', refMadaNetOf({ mada: m }), newMadaNetOf({ mada: m }), m);
}
for (const stored of [0, 0.01, 1, 99.99, 1234.56, -5, 0.001, NaN, 100000]) {
  check('madaNetOf(stored)', refMadaNetOf({ mada: 500, madaNet: stored }),
        newMadaNetOf({ mada: 500, madaNet: stored }), `stored=${stored}`);
}
for (const s of [{}, null, undefined, { mada: null }, { mada: '50.5' }]) {
  check('madaNetOf(edge)', refMadaNetOf(s), newMadaNetOf(s), JSON.stringify(s));
}

// 3) salesNet: تركيبات cash/mada/transfer + netTotal مخزّن + سجلات قديمة (fallback)
const comps = [0, 0.01, 0.5, 1, 33.33, 100, 250.75, 1000, 99999.99];
for (const cash of comps) {
  for (const mada of comps) {
    for (const transfer of [0, 0.5, 100, 5000.25]) {
      check('salesNet(old)', refSalesNet({ cash, mada, transfer }),
            newSalesNet({ cash, mada, transfer }), `${cash}/${mada}/${transfer}`);
    }
  }
}
for (const nt of [0, 0.01, 1234.56, 99999.99, NaN, -10]) {
  check('salesNet(netTotal)', refSalesNet({ netTotal: nt, cash: 9, mada: 9, transfer: 9 }),
        newSalesNet({ netTotal: nt, cash: 9, mada: 9, transfer: 9 }), `nt=${nt}`);
}
for (const s of [null, undefined, {}, { cash: '50', mada: '100.55', transfer: '5' }]) {
  check('salesNet(edge)', refSalesNet(s), newSalesNet(s), JSON.stringify(s));
}

console.log(`عدد الحالات المختبَرة: ${total}`);
console.log(`عدد الفروقات (يجب أن يكون 0): ${mismatches}`);
if (mismatches > 0) {
  console.log('أمثلة على الفروقات:');
  console.log(JSON.stringify(samples, null, 2));
  process.exit(1);
}
console.log('✅ PASS — الدوال المالية الجديدة (madaMath) مطابقة للمرجع الأصلي بايت-ببايت في كل الحالات.');
