// src/firebaseImportantDates.js
// ========================================================
// التواريخ المهمة (المهام المتكررة لكل فرع) — ميزة "تواريخ مهمة".
//
// كل مهمة مرتبطة بفرع، ولها تاريخ استحقاق (dueDate) ونوع تكرار. يظهر لها
// تذكير في الصفحة الرئيسية قبل موعدها بـ 7 أيام، ويبقى ظاهراً حتى لو فات
// الموعد (متأخر) إلى أن يضغط المستخدم "تم الإنجاز"، فينتقل تاريخ الاستحقاق
// تلقائياً للموعد القادم حسب نوع التكرار، مع حفظ سجل بسيط للإنجازات.
//
// المسار: importantDates/{autoId}
//   { name, branchId, dueDate, recurrence, notes, status, active,
//     lastCompletedDate, completionLog[], createdAt, updatedAt, createdBy }
//
// التبعيات (مصادر حقيقية لا الـ barrel — لتجنّب دورة وقت التحميل):
//   - db / auth من firebaseCore.js (الورقة)
//   - _invalidateCachePrefix من firebaseCache.js
// ========================================================
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { invalidateCachePrefix as _invalidateCachePrefix } from "./firebaseCache";
import { db, auth } from "./firebaseCore";

// أنواع التكرار المدعومة → عدد الأشهر بين كل استحقاق والذي يليه
export const RECURRENCE_MONTHS = {
  monthly: 1,    // شهري
  quarterly: 3,  // كل 3 أشهر
  semiannual: 6, // كل 6 أشهر
  yearly: 12,    // سنوي
};

// تسميات أنواع التكرار (عربي/إنجليزي) للعرض في الواجهة
export const RECURRENCE_LABELS = {
  monthly: { ar: "شهري", en: "Monthly" },
  quarterly: { ar: "كل 3 أشهر", en: "Every 3 months" },
  semiannual: { ar: "كل 6 أشهر", en: "Every 6 months" },
  yearly: { ar: "سنوي", en: "Yearly" },
};

// ------- أدوات تاريخ محلية (نبني YYYY-MM-DD مباشرة، لا UTC) -------

// يضيف n شهراً إلى (سنة/شهر/يوم) ويقصّ اليوم لآخر يوم في الشهر الناتج.
// m شهر 1-based. يرجّع نص YYYY-MM-DD.
function _addMonths(y, m, d, n) {
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = total % 12; // 0-based
  const lastDay = new Date(ny, nm + 1, 0).getDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/**
 * يحسب تاريخ الاستحقاق القادم بناءً على التاريخ الحالي ونوع التكرار.
 * مثال: شهري + 2026-06-20 → 2026-07-20 ، سنوي → نفس اليوم/الشهر من السنة القادمة.
 */
export function nextDueDate(dueDate, recurrence) {
  if (!dueDate) return dueDate;
  const step = RECURRENCE_MONTHS[recurrence] || 1;
  const [y, m, d] = dueDate.split("-").map(Number);
  return _addMonths(y, m, d, step);
}

// ------- استعلام -------

/**
 * يجلب المهام المهمة. لو مُرّر branchId يُرجّع مهام ذلك الفرع فقط
 * (مطابق لصلاحيات الموظف)، وإلا يُرجّع كل المهام (للمدير).
 * يُستثنى المحذوف (active === false). مرتّبة تصاعدياً حسب dueDate.
 */
export async function getImportantDates(branchId = null) {
  let q;
  if (branchId) {
    // مساواة واحدة فقط ⇒ لا يحتاج فهرساً مركّباً
    q = query(collection(db, "importantDates"), where("branchId", "==", branchId));
  } else {
    q = collection(db, "importantDates");
  }
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.active !== false)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
}

// ------- إضافة / تعديل / حذف -------

export async function addImportantDate({ name, branchId, dueDate, recurrence, notes = null }) {
  if (!name || !name.trim()) throw new Error("اسم المهمة مطلوب");
  if (!branchId) throw new Error("الفرع مطلوب");
  if (!dueDate) throw new Error("تاريخ المهمة مطلوب");
  const rec = RECURRENCE_MONTHS[recurrence] ? recurrence : "monthly";

  const ref = await addDoc(collection(db, "importantDates"), {
    name: name.trim(),
    branchId,
    dueDate,
    recurrence: rec,
    notes: notes?.trim() || null,
    status: "pending",        // pending → بانتظار الإنجاز
    active: true,
    lastCompletedDate: null,
    completionLog: [],
    createdBy: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  _invalidateCachePrefix("importantDates");
  return ref;
}

export async function updateImportantDate(id, { name, branchId, dueDate, recurrence, notes }) {
  const payload = { updatedAt: serverTimestamp() };
  if (name !== undefined) payload.name = String(name).trim();
  if (branchId !== undefined) payload.branchId = branchId;
  if (dueDate !== undefined) payload.dueDate = dueDate;
  if (recurrence !== undefined) {
    payload.recurrence = RECURRENCE_MONTHS[recurrence] ? recurrence : "monthly";
  }
  if (notes !== undefined) payload.notes = notes?.trim() || null;
  await updateDoc(doc(db, "importantDates", id), payload);
  _invalidateCachePrefix("importantDates");
}

/**
 * حذف مهمة — حذف ناعم (active=false) للحفاظ على سجل الإنجازات التاريخي،
 * تماشياً مع نمط الفروع/التصنيفات في هذا المشروع.
 */
export async function deleteImportantDate(id) {
  await updateDoc(doc(db, "importantDates", id), {
    active: false,
    updatedAt: serverTimestamp(),
  });
  _invalidateCachePrefix("importantDates");
}

/**
 * تسجيل إنجاز مهمة:
 *   - يضيف سجلاً بسيطاً في completionLog (لا يُحذف السجل السابق)
 *   - يحدّث lastCompletedDate لتاريخ اليوم
 *   - ينقل dueDate تلقائياً للموعد القادم حسب نوع التكرار
 * userName اختياري (اسم المستخدم الذي أنجز المهمة) — uid يؤخذ من الجلسة.
 */
export async function completeImportantDate(id, { userName = null } = {}) {
  const ref = doc(db, "importantDates", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("المهمة غير موجودة");
  const task = snap.data();

  // تاريخ اليوم محلياً (السعودية UTC+3) — نبنيه مباشرة لا عبر toISOString
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const prevDueDate = task.dueDate;
  const newDueDate = nextDueDate(prevDueDate, task.recurrence);

  const logEntry = {
    name: task.name || "",
    branchId: task.branchId || "",
    prevDueDate: prevDueDate || "",
    completedDate: today,
    userId: auth.currentUser?.uid || null,
    userName: userName || null,
    at: Date.now(),
  };

  await updateDoc(ref, {
    dueDate: newDueDate,
    lastCompletedDate: today,
    status: "pending", // جاهزة للدورة القادمة
    completionLog: arrayUnion(logEntry),
    updatedAt: serverTimestamp(),
  });
  _invalidateCachePrefix("importantDates");
  return { newDueDate, completedDate: today };
}
