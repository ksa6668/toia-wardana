// src/firebaseWhatsapp.js
// ========================================================
// عملاء واتساب (§S1) — مُستخرج من firebase.js (نقل فقط).
//
// يشمل: addWhatsappEntry / updateWhatsappEntry / deleteWhatsappEntry /
//        getWhatsappEntries / setWhatsappBaseline / getWhatsappBaseline
//
// التبعيات:
//   - _invalidateCachePrefix من firebaseCache.js (المصدر المباشر — لا دورة)
//   - db / auth / notifyTelegramWhatsappAdded من firebase.js (استخدام وقت-تشغيل
//     فقط ⇒ دورة حميدة). notifyTelegramWhatsappAdded هي التي تستدعي
//     getMonthlyGoal/getSales داخلياً، وتبقى في firebase.js (telegram لم يُستخرج).
// ========================================================
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { invalidateCachePrefix as _invalidateCachePrefix } from "./firebaseCache";
import { db, auth } from "./firebaseCore";
import { notifyTelegramWhatsappAdded } from "./firebaseTelegram";
import { refreshSummariesFor } from "./firebaseSummaries";

// Batch 76: قراءة السجل القديم قبل تعديل/حذف (نفس نمط firebaseSales)
async function _readOld(id) {
  try {
    const snap = await getDoc(doc(db, "whatsapp", id));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function addWhatsappEntry({ date, branchId, customers, newCustomers, buyers }) {
  if (!auth.currentUser) throw new Error("Not logged in");
  const customersN = Math.max(0, Math.floor(Number(customers) || 0));
  const newCustomersN = Math.max(0, Math.floor(Number(newCustomers) || 0));
  const buyersN = Math.max(0, Math.floor(Number(buyers) || 0));

  const ref = await addDoc(collection(db, "whatsapp"), {
    date,
    branchId,
    customers: customersN,
    newCustomers: newCustomersN,
    buyers: buyersN,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });

  // Batch 47: إشعار Telegram (fire-and-forget، لا يعطّل الحفظ)
  notifyTelegramWhatsappAdded({
    date,
    branchId,
    customers: customersN,
    newCustomers: newCustomersN,
    buyers: buyersN,
  });

  _invalidateCachePrefix('whatsapp');

  // Batch 76: تحديث ملخص الشهر (طبقة صامتة — لا يفشل الحفظ إن تعذّر)
  await refreshSummariesFor([{ branchId, date }]);
  return ref;
}

export async function updateWhatsappEntry(id, { date, branchId, customers, newCustomers, buyers }) {
  if (!auth.currentUser) throw new Error("Not logged in");
  // Batch 76: السجل القديم قبل التعديل (قد يتغيّر تاريخه/فرعه ⇒ شهران متأثران)
  const oldRec = await _readOld(id);
  const customersN = Math.max(0, Math.floor(Number(customers) || 0));
  const newCustomersN = Math.max(0, Math.floor(Number(newCustomers) || 0));
  const buyersN = Math.max(0, Math.floor(Number(buyers) || 0));

  const result = await updateDoc(doc(db, "whatsapp", id), {
    date,
    branchId,
    customers: customersN,
    newCustomers: newCustomersN,
    buyers: buyersN,
    updatedAt: serverTimestamp(),
  });
  _invalidateCachePrefix('whatsapp');

  // Batch 76: إعادة حساب ملخص الطرفين — القديم والجديد
  await refreshSummariesFor([
    oldRec && { branchId: oldRec.branchId, date: oldRec.date },
    { branchId, date },
  ].filter(Boolean));
  return result;
}

export async function deleteWhatsappEntry(id) {
  // Batch 76: نقرأ السجل قبل حذفه لنعرف ملخص أي (فرع، شهر) يُعاد حسابه
  const oldRec = await _readOld(id);
  const result = await deleteDoc(doc(db, "whatsapp", id));
  _invalidateCachePrefix('whatsapp');

  // Batch 76: الحذف = إعادة حساب الشهر بدونه
  if (oldRec) await refreshSummariesFor([{ branchId: oldRec.branchId, date: oldRec.date }]);
  return result;
}

// قراءة سجلات واتساب لنطاق تواريخ
export async function getWhatsappEntries(fromDate, toDate, branchId = null) {
  const constraints = [
    where("date", ">=", fromDate),
    where("date", "<=", toDate),
  ];
  if (branchId) constraints.push(where("branchId", "==", branchId));
  const q = query(collection(db, "whatsapp"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ========= Baseline (إجمالي تاريخي) =========
// رقم واحد لكل فرع: مجموع عملاء واتساب التاريخي قبل بدء التطبيق

export async function setWhatsappBaseline(branchId, totalCustomers) {
  if (!auth.currentUser) throw new Error("Not logged in");
  const total = Math.max(0, Math.floor(Number(totalCustomers) || 0));
  await setDoc(doc(db, "whatsappBaseline", branchId), {
    branchId,
    totalCustomers: total,
    updatedAt: serverTimestamp(),
  });
  _invalidateCachePrefix('whatsappBaseline');
}

export async function getWhatsappBaseline(branchId = null) {
  if (branchId) {
    const snap = await getDoc(doc(db, "whatsappBaseline", branchId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }
  const snap = await getDocs(collection(db, "whatsappBaseline"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
