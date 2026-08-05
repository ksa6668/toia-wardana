// src/firebaseLoyalty.js
// ====================================================================
// برنامج الولاء — طبقة البيانات (المرحلة 1).
//
// المجموعات (camelCase التزاماً بنمط المشروع):
//   loyaltyMembers/{memberId}        ملفات الأعضاء (لكل متجر عضوية مستقلة)
//   loyaltyTransactions/{txId}       سجل الحركات — إضافي فقط (append-only):
//                                    earn / redeem / adjust / reverse / expire
//   loyaltyInvoices/{store}_{invoiceNo}  معرّف المستند نفسه = ضمان عدم تكرار
//                                    الفاتورة ذرّياً (create فقط داخل معاملة)
//   loyaltySettings/{store}          إعدادات كل متجر
//
// مبادئ إلزامية:
//   • كل earn/redeem/reverse/adjust/expire داخل runTransaction واحدة —
//     أول استخدام للمعاملات في المشروع، معزول هنا بالكامل.
//   • لا حذف ولا تعديل في مكانه لأي حركة: العكس حركة جديدة، والربط يُشتق
//     عند القراءة من reversesTxId (مع معرّف حتمي rev_{txId} يمنع العكس المزدوج).
//   • قيم الولاء لا تُكتب أبداً في dailySales — لا تكرار للمبيعات.
//   • بعد كل كتابة: invalidateCachePrefix('loyalty').
// ====================================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebaseCore";
import { invalidateCachePrefix } from "./firebaseCache";
import {
  normalizePhone,
  computeEarnPoints,
  computeExpiryAt,
  isPointsExpired,
  invoiceDocId,
  randomMemberNo,
  randomCardToken,
} from "./loyaltyMath";

// ---------- أخطاء بمعرّف code (الواجهة تترجم عند الحاجة) ----------
function loyaltyError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// ---------- الإعدادات الافتراضية (وثيقة المنطق 2.1) ----------
export const LOYALTY_DEFAULT_SETTINGS = {
  enabled: true,
  pointsPerRiyal: 5,
  vatRegistered: false,
  pointsBasis: "gross", // "gross" | "net"
  vatRate: 0.15,
  expiryMonths: 18,
  tierWindowMonths: 24,
  largeTransactionAlert: 1000,
  tiers: [
    { key: "silver", name: "فضية", min: 1, max: 7500 },
    { key: "gold", name: "ذهبية", min: 7501, max: 20000 },
    { key: "platinum", name: "بلاتينية", min: 20001, max: null },
  ],
  rewards: [
    { id: "r50", label: "باقة 50 ريال", value: 50, points: 7500, active: true },
    { id: "r75", label: "باقة 75 ريال", value: 75, points: 11250, active: true },
    { id: "r100", label: "باقة 100 ريال", value: 100, points: 15000, active: true },
    { id: "r150", label: "باقة 150 ريال", value: 150, points: 22500, active: true },
    { id: "r200", label: "باقة 200 ريال", value: 200, points: 30000, active: true },
    { id: "r300", label: "باقة 300 ريال", value: 300, points: 45000, active: true },
  ],
  // مصادر التعرف — التعطيل بحقل active بدل الحذف
  sources: [
    { id: "maps", label: "قوقل ماب", active: true },
    { id: "instagram", label: "انستقرام", active: true },
    { id: "tiktok", label: "تيك توك", active: true },
    { id: "snapchat", label: "سناب شات", active: true },
    { id: "friend", label: "توصية صديق", active: true },
    { id: "walkin", label: "مررت بالمحل", active: true },
    { id: "other", label: "أخرى", active: true },
  ],
  welcomeMessage: "أهلاً بك في برنامج ولاء تويا ووردانة! 🌸 نقاطك تتجمع مع كل شراء.",
};

// ---------- الإعدادات ----------
/** جلب إعدادات الولاء لمتجر. لو غير موجودة يرجع الافتراضيات (كنمط getAppSettings). */
export async function getLoyaltySettings(store) {
  const snap = await getDoc(doc(db, "loyaltySettings", store));
  if (!snap.exists()) return { ...LOYALTY_DEFAULT_SETTINGS, exists: false };
  // الحقول الناقصة في المستند تسقط على الافتراضيات
  return { ...LOYALTY_DEFAULT_SETTINGS, ...snap.data(), exists: true };
}

/** حفظ إعدادات الولاء (merge) — من شاشة المدير فقط. */
export async function setLoyaltySettings(store, data) {
  await setDoc(
    doc(db, "loyaltySettings", store),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
  invalidateCachePrefix("loyalty");
}

// ---------- البحث والقراءة ----------
/**
 * البحث بالجوال في المتجر الحالي فقط. يوحّد الصيغة قبل الاستعلام —
 * 0501234567 و +966501234567 يجدان نفس العضوية.
 * يرجع {id, ...member} أو null. يرمي invalid-phone لصيغة غير صالحة.
 */
export async function findLoyaltyMemberByPhone(store, phoneInput) {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw loyaltyError("invalid-phone", "رقم الجوال غير صالح");
  const q = query(
    collection(db, "loyaltyMembers"),
    where("store", "==", store),
    where("phone", "==", phone),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/** كل أعضاء متجر (لشاشة المدير) — الفرز عند العميل لتجنب فهرس مركّب. */
export async function getLoyaltyMembers(store) {
  const q = query(collection(db, "loyaltyMembers"), where("store", "==", store));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ms = (v) => (v?.toDate ? v.toDate().getTime() : v ? new Date(v).getTime() : 0);
  rows.sort((a, b) => ms(b.joinedAt) - ms(a.joinedAt));
  return rows;
}

/** كل حركات عضو — الفرز (الأحدث أولاً) عند العميل لتجنب فهرس مركّب. */
export async function getLoyaltyTransactions(memberId) {
  const q = query(collection(db, "loyaltyTransactions"), where("memberId", "==", memberId));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ms = (v) => (v?.toDate ? v.toDate().getTime() : v ? new Date(v).getTime() : 0);
  rows.sort((a, b) => ms(b.at) - ms(a.at));
  return rows;
}

// ---------- إنشاء عضوية ----------
async function isMemberNoTaken(memberNo) {
  const q = query(collection(db, "loyaltyMembers"), where("memberNo", "==", memberNo), limit(1));
  return !(await getDocs(q)).empty;
}

async function isCardTokenTaken(cardToken) {
  const q = query(collection(db, "loyaltyMembers"), where("cardToken", "==", cardToken), limit(1));
  return !(await getDocs(q)).empty;
}

/**
 * إنشاء عضوية جديدة في متجر. العضوية مستقلة لكل متجر —
 * نفس الجوال يمكن أن يملك عضوية في تويا وأخرى في وردانة برصيدين مستقلين.
 */
export async function createLoyaltyMember({
  store,
  phone: phoneInput,
  name,
  source = "",
  sourceOther = "",
  marketingConsent = false,
  byUid = "",
  byName = "",
}) {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw loyaltyError("invalid-phone", "رقم الجوال غير صالح");
  if (!String(name || "").trim()) throw loyaltyError("name-required", "أدخل اسم العميل");

  // منع تكرار الجوال داخل نفس المتجر
  const existing = await findLoyaltyMemberByPhone(store, phone);
  if (existing) throw loyaltyError("phone-exists", "رقم الجوال مسجّل مسبقاً في هذا المتجر");

  // رقم عضوية فريد — حتى 10 محاولات
  let memberNo = null;
  for (let i = 0; i < 10; i++) {
    const candidate = randomMemberNo(store);
    if (!(await isMemberNoTaken(candidate))) { memberNo = candidate; break; }
  }
  if (!memberNo) throw loyaltyError("memberno-failed", "تعذّر توليد رقم عضوية فريد — حاول مجدداً");

  // توكن بطاقة فريد (≥22 حرفاً) — نفس أسلوب إعادة المحاولة
  let cardToken = null;
  for (let i = 0; i < 10; i++) {
    const candidate = randomCardToken();
    if (!(await isCardTokenTaken(candidate))) { cardToken = candidate; break; }
  }
  if (!cardToken) throw loyaltyError("token-failed", "تعذّر توليد توكن فريد — حاول مجدداً");

  const ref = doc(collection(db, "loyaltyMembers"));
  const data = {
    store,
    memberNo,
    cardToken,
    phone,
    name: String(name).trim(),
    source: source || "",
    sourceOther: source === "other" ? String(sourceOther || "").trim() : "",
    marketingConsent: !!marketingConsent,
    joinedAt: serverTimestamp(),
    pointsBalance: 0,
    redemptionsCount: 0,
    lastPurchaseAt: null,
    pointsExpireAt: null,
    manualTier: null,
    status: "active",
    createdBy: byUid,
    createdByName: byName,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, data);
  invalidateCachePrefix("loyalty");
  return { id: ref.id, ...data };
}

// ---------- فتح ملف عضو + الانتهاء الكسول ----------
/**
 * جلب عضو بالمعرّف مع تطبيق انتهاء النقاط الكسول:
 * إذا now > pointsExpireAt والرصيد > 0 → حركة expire سالبة تُصفّر الرصيد
 * (داخل معاملة، مع إعادة الفحص داخلها منعاً للتصفير المزدوج). لا حذف لأي سجل.
 */
export async function getLoyaltyMember(memberId, { byUid = "", byName = "" } = {}) {
  const ref = doc(db, "loyaltyMembers", memberId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
  let member = { id: snap.id, ...snap.data() };

  if (isPointsExpired(member)) {
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) return;
      const m = fresh.data();
      if (!isPointsExpired(m)) return; // صُفّر من جلسة أخرى — لا شيء نفعله
      const balance = Number(m.pointsBalance) || 0;
      const txRef = doc(collection(db, "loyaltyTransactions"));
      tx.set(txRef, {
        memberId,
        store: m.store,
        type: "expire",
        points: -balance,
        balanceAfter: 0,
        reason: "انتهاء صلاحية النقاط",
        byUid,
        byName,
        at: serverTimestamp(),
      });
      tx.update(ref, { pointsBalance: 0, updatedAt: serverTimestamp() });
    });
    invalidateCachePrefix("loyalty");
    const after = await getDoc(ref);
    member = { id: after.id, ...after.data() };
  }
  return member;
}

// ---------- إضافة نقاط (earn) — معاملة ذرّية واحدة ----------
/**
 * الخطوات الثلاث داخل معاملة واحدة:
 *   1) create فقط لـ loyaltyInvoices/{store}_{invoiceNo} — التكرار يُفشل الكل
 *   2) حركة earn في loyaltyTransactions
 *   3) تحديث pointsBalance / lastPurchaseAt / pointsExpireAt في العضو
 * يرجع { points, balanceAfter, largeAlert }.
 */
export async function earnLoyaltyPoints({
  store,
  memberId,
  invoiceNo,
  amount,
  byUid = "",
  byName = "",
}) {
  const invId = invoiceDocId(store, invoiceNo);
  if (!invId) throw loyaltyError("invoice-required", "أدخل رقم الفاتورة");
  const amt = Number(amount);
  if (!amt || amt <= 0) throw loyaltyError("amount-invalid", "أدخل مبلغاً صحيحاً");

  const settings = await getLoyaltySettings(store);
  if (settings.enabled === false) throw loyaltyError("disabled", "برنامج الولاء معطّل لهذا المتجر");
  const points = computeEarnPoints(amt, settings);

  const invoiceRef = doc(db, "loyaltyInvoices", invId);
  const memberRef = doc(db, "loyaltyMembers", memberId);
  const txRef = doc(collection(db, "loyaltyTransactions"));

  const result = await runTransaction(db, async (tx) => {
    // كل القراءات قبل الكتابات (شرط معاملات Firestore)
    const invSnap = await tx.get(invoiceRef);
    if (invSnap.exists()) {
      throw loyaltyError("duplicate-invoice", "رقم الفاتورة مستخدم مسبقاً في هذا المتجر");
    }
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
    const m = memberSnap.data();
    if (m.status === "disabled") throw loyaltyError("member-disabled", "هذه العضوية معطّلة");

    const balance = Number(m.pointsBalance) || 0;
    const balanceAfter = balance + points;
    const now = new Date();
    const expireAt = computeExpiryAt(now, settings.expiryMonths);

    tx.set(invoiceRef, {
      memberId,
      txId: txRef.id,
      amount: amt,
      at: serverTimestamp(),
    });
    tx.set(txRef, {
      memberId,
      store,
      type: "earn",
      points,
      balanceAfter,
      invoiceNo: String(invoiceNo).trim(),
      amount: amt,
      // الأساس وقت التنفيذ — للتاريخ (لو تغيّرت الإعدادات لاحقاً)
      pointsBasis: settings.pointsBasis,
      vatRate: settings.vatRate,
      pointsPerRiyal: settings.pointsPerRiyal,
      byUid,
      byName,
      at: serverTimestamp(),
    });
    tx.update(memberRef, {
      pointsBalance: balanceAfter,
      lastPurchaseAt: now,
      pointsExpireAt: expireAt,
      updatedAt: serverTimestamp(),
    });
    return { points, balanceAfter };
  });

  invalidateCachePrefix("loyalty");
  return {
    ...result,
    largeAlert: Number(settings.largeTransactionAlert) > 0 && amt >= Number(settings.largeTransactionAlert),
  };
}

// ---------- استبدال مكافأة (redeem) — معاملة ذرّية واحدة ----------
/** التحقق من الرصيد + حركة redeem + تحديث الرصيد والعدّاد — كله أو لا شيء. */
export async function redeemLoyaltyReward({
  store,
  memberId,
  rewardId,
  byUid = "",
  byName = "",
}) {
  const settings = await getLoyaltySettings(store);
  if (settings.enabled === false) throw loyaltyError("disabled", "برنامج الولاء معطّل لهذا المتجر");
  const reward = (settings.rewards || []).find((r) => r.id === rewardId && r.active !== false);
  if (!reward) throw loyaltyError("reward-not-found", "المكافأة غير متاحة");

  const memberRef = doc(db, "loyaltyMembers", memberId);
  const txRef = doc(collection(db, "loyaltyTransactions"));

  const result = await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
    const m = memberSnap.data();
    if (m.status === "disabled") throw loyaltyError("member-disabled", "هذه العضوية معطّلة");

    const balance = Number(m.pointsBalance) || 0;
    if (balance < 0) {
      throw loyaltyError("negative-balance", "الرصيد سالب — الاستبدال معطّل حتى تسوية الرصيد");
    }
    if (balance < Number(reward.points)) {
      throw loyaltyError("insufficient-points", "الرصيد لا يكفي لهذه المكافأة");
    }

    const balanceAfter = balance - Number(reward.points);
    tx.set(txRef, {
      memberId,
      store,
      type: "redeem",
      points: -Number(reward.points),
      balanceAfter,
      rewardId: reward.id,
      rewardValue: Number(reward.value) || 0,
      rewardLabel: reward.label || "",
      byUid,
      byName,
      at: serverTimestamp(),
    });
    tx.update(memberRef, {
      pointsBalance: balanceAfter,
      redemptionsCount: (Number(m.redemptionsCount) || 0) + 1,
      updatedAt: serverTimestamp(),
    });
    return { balanceAfter, reward };
  });

  invalidateCachePrefix("loyalty");
  return result;
}

// ---------- تسوية يدوية (adjust) — للمدير ----------
/** حركة adjust بنقاط موجبة أو سالبة مع سبب إلزامي — داخل معاملة. */
export async function adjustLoyaltyPoints({
  store,
  memberId,
  points,
  reason,
  byUid = "",
  byName = "",
}) {
  const p = Math.round(Number(points));
  if (!p) throw loyaltyError("points-invalid", "أدخل عدد نقاط غير صفري");
  if (!String(reason || "").trim()) throw loyaltyError("reason-required", "السبب إلزامي");

  const memberRef = doc(db, "loyaltyMembers", memberId);
  const txRef = doc(collection(db, "loyaltyTransactions"));

  const result = await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
    const m = memberSnap.data();
    const balanceAfter = (Number(m.pointsBalance) || 0) + p;
    tx.set(txRef, {
      memberId,
      store,
      type: "adjust",
      points: p,
      balanceAfter,
      reason: String(reason).trim(),
      byUid,
      byName,
      at: serverTimestamp(),
    });
    tx.update(memberRef, { pointsBalance: balanceAfter, updatedAt: serverTimestamp() });
    return { balanceAfter };
  });

  invalidateCachePrefix("loyalty");
  return result;
}

// ---------- عكس حركة (reverse) — للمدير، بلا حذف ----------
/**
 * حركة عكسية بسبب إلزامي. المعرّف الحتمي rev_{txId} يمنع العكس المزدوج ذرّياً
 * (نفس فكرة معرّف الفاتورة). لا يُعدَّل مستند الحركة الأصلية —
 * حالة "معكوسة" تُشتق عند القراءة من reversesTxId.
 */
export async function reverseLoyaltyTransaction({
  store,
  memberId,
  txId,
  reason,
  byUid = "",
  byName = "",
}) {
  if (!String(reason || "").trim()) throw loyaltyError("reason-required", "السبب إلزامي");

  const revRef = doc(db, "loyaltyTransactions", `rev_${txId}`);
  const origRef = doc(db, "loyaltyTransactions", txId);
  const memberRef = doc(db, "loyaltyMembers", memberId);

  const result = await runTransaction(db, async (tx) => {
    const revSnap = await tx.get(revRef);
    if (revSnap.exists()) throw loyaltyError("already-reversed", "هذه الحركة معكوسة مسبقاً");
    const origSnap = await tx.get(origRef);
    if (!origSnap.exists()) throw loyaltyError("tx-not-found", "الحركة غير موجودة");
    const orig = origSnap.data();
    if (orig.memberId !== memberId) throw loyaltyError("tx-mismatch", "الحركة لا تخص هذا العضو");
    if (!["earn", "redeem", "adjust"].includes(orig.type)) {
      throw loyaltyError("tx-not-reversible", "هذا النوع من الحركات لا يُعكس");
    }
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
    const m = memberSnap.data();

    const delta = -(Number(orig.points) || 0);
    const balanceAfter = (Number(m.pointsBalance) || 0) + delta;
    tx.set(revRef, {
      memberId,
      store,
      type: "reverse",
      points: delta,
      balanceAfter,
      reversesTxId: txId,
      reversedType: orig.type,
      reason: String(reason).trim(),
      byUid,
      byName,
      at: serverTimestamp(),
    });
    const memberUpdate = { pointsBalance: balanceAfter, updatedAt: serverTimestamp() };
    // عكس استبدال → إنقاص عدّاد الاستبدالات
    if (orig.type === "redeem") {
      memberUpdate.redemptionsCount = Math.max(0, (Number(m.redemptionsCount) || 0) - 1);
    }
    tx.update(memberRef, memberUpdate);
    return { balanceAfter };
  });

  invalidateCachePrefix("loyalty");
  return result;
}

// ---------- الترقية اليدوية للفئة — للمدير ----------
/**
 * تعيين ترقية يدوية { tier, reason, until|null } أو null للإلغاء.
 * until = null → سارية حتى الإلغاء.
 */
export async function setLoyaltyManualTier(memberId, manualTier, { byUid = "", byName = "" } = {}) {
  const ref = doc(db, "loyaltyMembers", memberId);
  let value = null;
  if (manualTier && manualTier.tier) {
    if (!String(manualTier.reason || "").trim()) {
      throw loyaltyError("reason-required", "السبب إلزامي");
    }
    value = {
      tier: manualTier.tier,
      reason: String(manualTier.reason).trim(),
      until: manualTier.until || null,
      byUid,
      byName,
      at: new Date(),
    };
  }
  await updateDoc(ref, { manualTier: value, updatedAt: serverTimestamp() });
  invalidateCachePrefix("loyalty");
}

// ---------- تعطيل/تفعيل عضوية — للمدير ----------
export async function setLoyaltyMemberStatus(memberId, status) {
  await updateDoc(doc(db, "loyaltyMembers", memberId), {
    status: status === "disabled" ? "disabled" : "active",
    updatedAt: serverTimestamp(),
  });
  invalidateCachePrefix("loyalty");
}

// ---------- تحديث بيانات العضو الأساسية — للمدير ----------
export async function updateLoyaltyMemberInfo(memberId, { name, marketingConsent }) {
  const data = { updatedAt: serverTimestamp() };
  if (name !== undefined) {
    if (!String(name).trim()) throw loyaltyError("name-required", "أدخل اسم العميل");
    data.name = String(name).trim();
  }
  if (marketingConsent !== undefined) data.marketingConsent = !!marketingConsent;
  await updateDoc(doc(db, "loyaltyMembers", memberId), data);
  invalidateCachePrefix("loyalty");
}
