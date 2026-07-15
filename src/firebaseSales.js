// src/firebaseSales.js
// ====================================================================
// المبيعات اليومية + حسابات رسوم مدى (§S1 — المرحلة 9) — مُستخرج من firebase.js.
//
// ⚠️ منطق مالي حسّاس: نقل حرفي بايت-ببايت — لا تغيير في أي معادلة/تقريب/ترتيب.
//
// الدوال النقية (بلا تبعيات): MADA_FEE_RATE, madaFees, madaNet, salesNet, madaNetOf
// دوال CRUD: addDailySales, updateDailySales, deleteDailySales, getSales
//
// التبعيات (استخدام وقت-تشغيل داخل الأجسام فقط ⇒ لا مشكلة دورة وقت التحميل):
//   - _invalidateCachePrefix من firebaseCache.js (aliased)
//   - db / auth من firebase.js
//   - notifyTelegramSaleAdded من firebaseTelegram.js (مصدره الحقيقي)
// ====================================================================
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { invalidateCachePrefix as _invalidateCachePrefix } from "./firebaseCache";
import { db, auth } from "./firebaseCore";
import { notifyTelegramSaleAdded } from "./firebaseTelegram";
import { refreshSummariesFor } from "./firebaseSummaries";

// Batch 76: قراءة السجل القديم قبل تعديل/حذف — لمعرفة (الفرع، الشهر)
// المتأثرَين فيُعاد حساب ملخصهما. فشل القراءة غير قاتل (يُتجاهل الطرف القديم).
async function _readOld(collName, id) {
  try {
    const snap = await getDoc(doc(db, collName, id));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}
// الدوال النقية لرسوم مدى مفصولة في madaMath.js (بلا تبعيات — قابلة للاختبار في Node).
// نُعيد تصديرها من هنا فتبقى استيرادات `from '../firebase'` كما هي.
import { MADA_FEE_RATE, madaFees, madaNet, salesNet, madaNetOf } from "./madaMath";
export { MADA_FEE_RATE, madaFees, madaNet, salesNet, madaNetOf };

// تسجيل مبيعات يومية (القسم 6 من المنطق)
// ملاحظة: المبلغ المدخل لـ mada هو الإجمالي قبل الرسوم.
// نحفظ كذلك madaFees و madaNet لأغراض التقارير.
export async function addDailySales({ date, branchId, cash, mada, transfer }) {
  // Batch 58: قصّ القيم السالبة (حماية من إدخال خاطئ يفسد التقارير)
  const cashN = Math.max(0, Number(cash) || 0);
  const madaN = Math.max(0, Number(mada) || 0);
  const transferN = Math.max(0, Number(transfer) || 0);
  const total = cashN + madaN + transferN;
  const madaFeesAmt = +(madaN * MADA_FEE_RATE).toFixed(2);
  const madaNetAmt = +(madaN - madaFeesAmt).toFixed(2);
  const netTotal = +(cashN + madaNetAmt + transferN).toFixed(2);

  const ref = await addDoc(collection(db, "dailySales"), {
    date,
    branchId,
    cash: cashN,
    mada: madaN,
    madaFees: madaFeesAmt,
    madaNet: madaNetAmt,
    transfer: transferN,
    total,        // الإجمالي قبل خصم رسوم مدى
    netTotal,     // الإجمالي بعد خصم رسوم مدى
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });

  // Batch 40: إشعار Telegram (fire-and-forget، لا يعطّل الحفظ)
  notifyTelegramSaleAdded({
    date, branchId, cash: cashN, mada: madaN, transfer: transferN, total,
  });

  // Batch 45: مسح cache الاستعلامات المتأثرة
  _invalidateCachePrefix('sales');

  // Batch 76: تحديث ملخص الشهر (طبقة صامتة — لا يفشل الحفظ إن تعذّر)
  await refreshSummariesFor([{ branchId, date }]);

  return ref;
}

// ========== Batch 12: تعديل/حذف المبيعات (للمدير فقط) ==========
// التحقق من صلاحيات المدير يتم على مستوى الـ UI + Firestore Security Rules.

// تحديث مبيعة يومية — يعيد حساب total/madaFees/madaNet/netTotal تلقائياً
// Batch 58: قصّ القيم السالبة
export async function updateDailySales(id, { date, branchId, cash, mada, transfer }) {
  // Batch 76: السجل القديم قبل التعديل (قد يتغيّر تاريخه/فرعه ⇒ شهران متأثران)
  const oldRec = await _readOld("dailySales", id);
  const cashN = Math.max(0, Number(cash) || 0);
  const madaN = Math.max(0, Number(mada) || 0);
  const transferN = Math.max(0, Number(transfer) || 0);
  const total = cashN + madaN + transferN;
  const madaFeesAmt = +(madaN * MADA_FEE_RATE).toFixed(2);
  const madaNetAmt = +(madaN - madaFeesAmt).toFixed(2);
  const netTotal = +(cashN + madaNetAmt + transferN).toFixed(2);

  const result = await updateDoc(doc(db, "dailySales", id), {
    date,
    branchId,
    cash: cashN,
    mada: madaN,
    madaFees: madaFeesAmt,
    madaNet: madaNetAmt,
    transfer: transferN,
    total,
    netTotal,
    updatedBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
  });

  // Batch 45: مسح cache
  _invalidateCachePrefix('sales');

  // Batch 76: إعادة حساب ملخص الطرفين — القديم (قد يكون شهراً/فرعاً آخر) والجديد
  await refreshSummariesFor([
    oldRec && { branchId: oldRec.branchId, date: oldRec.date },
    { branchId, date },
  ].filter(Boolean));

  return result;
}

export async function deleteDailySales(id) {
  // Batch 76: نقرأ السجل قبل حذفه لنعرف ملخص أي (فرع، شهر) يُعاد حسابه
  const oldRec = await _readOld("dailySales", id);
  const result = await deleteDoc(doc(db, "dailySales", id));

  // Batch 45: مسح cache
  _invalidateCachePrefix('sales');

  // Batch 76: الحذف = إعادة حساب الشهر بدونه (طرح بالمحصلة، بلا فروقات يدوية)
  if (oldRec) await refreshSummariesFor([{ branchId: oldRec.branchId, date: oldRec.date }]);
  return result;
}

// ========== قراءة المبيعات (للوحة المدير) ==========

// المبيعات بين تاريخين (date محفوظ كنص YYYY-MM-DD)
export async function getSales(fromDate, toDate, branchId = null) {
  // Batch 39: اختيارياً يفلتر بفرع معين — مهم للموظف لأن Firestore Rules
  // تمنع قراءة سجلات فرع آخر، وبدون where(branchId) يرفض الاستعلام كاملاً.
  const constraints = [
    where("date", ">=", fromDate),
    where("date", "<=", toDate),
  ];
  if (branchId) {
    constraints.push(where("branchId", "==", branchId));
  }
  const q = query(collection(db, "dailySales"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
