// src/firebaseSummaries.js
// ====================================================================
// Batch 76: التحديث الحي لمستندات الملخصات الشهرية (monthlySummaries).
//
// طبقة صامتة إضافية بحتة: تُكتب من مسارات الحفظ ولا تقرأها أي شاشة
// في هذه المرحلة (تبديل القراءة مرحلة لاحقة منفصلة).
//
// استراتيجية «إعادة الحساب المطلق» بدل increments بالفروقات:
//   بعد كل إضافة/تعديل/حذف نعيد قراءة سجلات (الفرع، الشهر) المتأثر خام
//   (استعلام محدود ≤ شهر واحد) ونكتب الملخص كاملاً بـ set.
//   لماذا؟
//   • يستحيل ازدواج العدّ: لا جمع تزايدي أصلاً — القيمة دائماً محسوبة
//     من مصدر الحقيقة الخام، فلا فرق بين backfill وتحديث حي متزامنين.
//   • idempotent بالبناء: تكرار العملية يعطي نفس المستند.
//   • حقول التواريخ الفريدة (sales.dates/expenses.dates — يلزمها منطق
//     المتوسطات وتوزيع الثابت) لا يمكن صيانتها بالفروقات عند حذف سجل
//     أو تعديل تاريخه (قد يشارك سجل آخر نفس اليوم).
//   • تعديل ينقل السجل بين شهرين/فرعين يعالَج بإعادة حساب الطرفين.
//   التكلفة: استعلام شهر واحد (~عشرات إلى مئات المستندات) لكل حفظ.
//
// الفشل هنا لا يفشل الحفظ أبداً (try/catch شامل + console.warn):
// السجل الخام هو المصدر المعروض، والملخص يُصحّح بأي كتابة لاحقة
// لنفس الشهر أو بإعادة تشغيل scripts/buildMonthlySummaries.mjs.
//
// ⚠️ ملاحظة أمان (لا نلمس القواعد في هذه المرحلة): إن كانت Firestore
// Rules تُعدّد المجموعات المسموح كتابتها، يجب السماح بالكتابة في
// monthlySummaries وإلا فستفشل تحديثات الموظفين بصمت (غير قاتلة).
// ====================================================================
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebaseCore";
import { computeMonthlySummary } from "./utils/summaryMath";

// سجلات مجموعة لشهر وفرع (نفس نمط النطاق النصي في firebaseTelegram:
// "-31" صالح للمقارنة النصية حتى للأشهر الأقصر)
async function fetchMonthDocs(collName, branchId, month) {
  const q = query(
    collection(db, collName),
    where("date", ">=", `${month}-01`),
    where("date", "<=", `${month}-31`),
    where("branchId", "==", branchId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * يعيد حساب ملخص (فرع، شهر) من السجلات الخام ويكتبه كتابة مطلقة.
 * يرمي عند الفشل — استخدم refreshSummariesFor من مسارات الحفظ.
 */
export async function refreshMonthlySummary(branchId, month, source = "live") {
  const [sales, expenses, whatsapp] = await Promise.all([
    fetchMonthDocs("dailySales", branchId, month),
    fetchMonthDocs("expenses", branchId, month),
    fetchMonthDocs("whatsapp", branchId, month),
  ]);
  const summary = computeMonthlySummary(branchId, month, sales, expenses, whatsapp);
  await setDoc(doc(db, "monthlySummaries", `${branchId}_${month}`), {
    ...summary,
    source,
    lastComputedAt: serverTimestamp(),
  });
}

/**
 * المدخل الآمن لمسارات الحفظ: يستقبل أزواج {branchId, date} للسجل قبل
 * وبعد التعديل (أو طرفاً واحداً للإضافة/الحذف)، يجمعها إلى أزواج
 * (فرع، شهر) فريدة، ويعيد حساب كل واحد. لا يرمي أبداً.
 */
export async function refreshSummariesFor(entries) {
  try {
    const keys = new Map();
    for (const en of entries || []) {
      const date = en?.date;
      const branchId = en?.branchId;
      if (!branchId || !/^\d{4}-\d{2}/.test(String(date || ""))) continue;
      const month = String(date).slice(0, 7);
      keys.set(`${branchId}_${month}`, { branchId, month });
    }
    await Promise.all(
      [...keys.values()].map(({ branchId, month }) =>
        refreshMonthlySummary(branchId, month)
      )
    );
  } catch (err) {
    // غير قاتل بالتصميم — الخام يبقى مصدر العرض والملخص يُصحَّح لاحقاً
    console.warn("monthlySummaries: تعذّر تحديث الملخص (غير قاتل):", err?.message || err);
  }
}
