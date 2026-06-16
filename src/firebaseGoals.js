// src/firebaseGoals.js
// ========================================================
// الأهداف الشهرية (§S1) — مُستخرج من firebase.js (نقل فقط).
// المسار: goals/{branchId}_{YYYY-MM} → { budget, reviewsTarget, whatsappTarget, ... }
//
// يشمل: getMonthlyGoal / setMonthlyGoal / setReviewsAchieved / getAllGoalsForMonth
//
// التبعيات:
//   - _invalidateCachePrefix من firebaseCache.js (المصدر المباشر — aliased)
//   - db من firebase.js
//   - getBranches من firebaseCatalog.js (مصدرها الحقيقي) — لـ getAllGoalsForMonth
//   كلها استخدام وقت-تشغيل داخل الأجسام ⇒ لا مشكلة دورة وقت التحميل.
// ========================================================
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { invalidateCachePrefix as _invalidateCachePrefix } from "./firebaseCache";
import { db } from "./firebase";
import { getBranches } from "./firebaseCatalog";

/**
 * يجلب هدف فرع لشهر معين. لو الـ doc غير موجود يرجع defaults.
 */
export async function getMonthlyGoal(branchId, monthStr) {
  const goalId = `${branchId}_${monthStr}`;
  const ref = doc(db, "goals", goalId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { budget: 0, reviewsTarget: 0, whatsappTarget: 0, whatsappTargetType: 'pct', exists: false };
  }
  // Batch 55: توافق رجعي — أي هدف قديم بدون نوع يُعامَل كـ "نسبة"
  const data = snap.data();
  return { ...data, whatsappTargetType: data.whatsappTargetType || 'pct', exists: true };
}

/**
 * يحفظ هدف فرع لشهر معين.
 * الـ data: { budget, reviewsTarget, reviewsAchieved?, whatsappTarget? }
 * Batch 16: يدعم تحديث reviewsAchieved (التقييمات المُحقّقة) باستقلال.
 * Batch 49: يدعم whatsappTarget (نسبة هدف الواتساب لهذا الشهر).
 * Batch 55: يدعم whatsappTargetType ('pct' | 'amount') — نوع هدف الواتساب.
 */
export async function setMonthlyGoal(branchId, monthStr, data) {
  const goalId = `${branchId}_${monthStr}`;
  const ref = doc(db, "goals", goalId);
  const payload = {
    branchId,
    month: monthStr,
    updatedAt: serverTimestamp(),
  };
  if (data.budget !== undefined) payload.budget = Number(data.budget) || 0;
  if (data.reviewsTarget !== undefined) payload.reviewsTarget = Number(data.reviewsTarget) || 0;
  if (data.reviewsAchieved !== undefined) payload.reviewsAchieved = Number(data.reviewsAchieved) || 0;
  if (data.whatsappTarget !== undefined) payload.whatsappTarget = Number(data.whatsappTarget) || 0;
  // Batch 55: نوع هدف الواتساب — نقبل فقط 'pct' أو 'amount'
  if (data.whatsappTargetType !== undefined) {
    payload.whatsappTargetType = data.whatsappTargetType === 'amount' ? 'amount' : 'pct';
  }
  await setDoc(ref, payload, { merge: true });
  // Batch 45: مسح cache
  _invalidateCachePrefix('goals');
}

/**
 * Batch 16: تحديث عدد التقييمات المُحقّقة فقط (للنقر المزدوج على كرت التقييمات)
 */
export async function setReviewsAchieved(branchId, monthStr, achieved) {
  return setMonthlyGoal(branchId, monthStr, { reviewsAchieved: achieved });
}

/**
 * يجلب أهداف كل الفروع لشهر معين دفعة واحدة (أكفأ من استدعاءات متعددة).
 * يستخدمه ManagerHome لعرض KPIs.
 */
export async function getAllGoalsForMonth(monthStr) {
  const branches = await getBranches();
  const promises = branches.map((b) =>
    getMonthlyGoal(b.id, monthStr).then((g) => ({ branchId: b.id, ...g }))
  );
  return Promise.all(promises);
}
