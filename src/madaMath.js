// src/madaMath.js
// ====================================================================
// رياضيات رسوم مدى — دوال نقية بلا أي تبعيات (لا Firestore/Auth).
// مفصولة عن firebaseSales.js لتكون قابلة للاستيراد والاختبار في Node مباشرةً
// (scripts/test-madaNetOf.mjs). firebaseSales.js يستوردها ويُعيد تصديرها،
// فتبقى كل مواضع الاستيراد `from '../firebase'` بلا تغيير.
//
// ⚠️ منطق مالي — أي تعديل هنا يجب أن يبقى مطابقاً بايت-ببايت للأصل.
// ====================================================================

// ========== حسبة رسوم مدى (طلب المالك) ==========
// كل 100 ريال => 0.80 هلله رسوم أساسية + 15% ضريبة قيمة مضافة على الرسوم
// = 0.80 + 0.12 = 0.92 هلله (≈ 0.92 ريال لكل 100 ريال)
// نسبة الرسوم الإجمالية على المبلغ = 0.92 / 100 = 0.92%
// النسبة تطبّق على أي مبلغ (ريال واحد أو 10,000)
export const MADA_FEE_RATE = 0.0092;
export function madaFees(grossMada) {
  const g = Number(grossMada) || 0;
  return +(g * MADA_FEE_RATE).toFixed(2);
}
export function madaNet(grossMada) {
  const g = Number(grossMada) || 0;
  return +(g * (1 - MADA_FEE_RATE)).toFixed(2);
}

// Batch 29: helper موحّد لقراءة "صافي المبيعات بعد رسوم مدى" من سجل واحد
// يدعم السجلات القديمة (التي لا تحتوي netTotal) عبر الحساب من cash/mada/transfer
export function salesNet(sale) {
  if (!sale) return 0;
  // لو الحقل موجود (السجلات الجديدة) نستخدمه مباشرة
  if (typeof sale.netTotal === 'number' && !Number.isNaN(sale.netTotal)) {
    return sale.netTotal;
  }
  // fallback للسجلات القديمة: نحسبه من المكوّنات
  const cashN = Number(sale.cash) || 0;
  const madaN = Number(sale.mada) || 0;
  const transferN = Number(sale.transfer) || 0;
  const fees = +(madaN * MADA_FEE_RATE).toFixed(2);
  return +(cashN + (madaN - fees) + transferN).toFixed(2);
}

// D5: مصدر واحد لـ "صافي مدى لكل سجل" (مكوّن مدى فقط، بعد الرسوم).
// كان مكرّراً حرفياً في ManagerKpis / ManagerMonthly / MonthlyBreakdownSheet.
// السلوك مطابق تماماً للكود السابق: لو madaNet مخزّن نستخدمه، وإلا نحسبه
// من mada بنفس المعادلة والتقريب (MADA_FEE_RATE = 0.0092 = نفس الـ literal السابق).
export function madaNetOf(sale) {
  if (typeof sale?.madaNet === 'number') return sale.madaNet;
  const m = Number(sale?.mada) || 0;
  return +(m * (1 - MADA_FEE_RATE)).toFixed(2);
}
