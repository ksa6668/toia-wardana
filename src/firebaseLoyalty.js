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
import { LOYALTY_DEFAULT_SETTINGS } from "./loyaltyShare";

// المرحلة 2: الإعدادات الافتراضية انتقلت إلى loyaltyShare.js (وحدة نقية
// يستوردها أيضاً api/card.js بلا تهيئة Firebase) — يُعاد تصديرها هنا
// حتى تبقى الاستيرادات القائمة من '../firebase' كما هي.
export { LOYALTY_DEFAULT_SETTINGS };

// ---------- أخطاء بمعرّف code (الواجهة تترجم عند الحاجة) ----------
function loyaltyError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

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

/**
 * البحث برقم العضوية داخل المتجر الحالي (مسار مسح QR — رمز البطاقة يحمل memberNo).
 * يرجع {id, ...member} أو null.
 */
export async function findLoyaltyMemberByMemberNo(store, memberNo) {
  const clean = String(memberNo || "").trim().toUpperCase();
  if (!clean) return null;
  const q = query(
    collection(db, "loyaltyMembers"),
    where("store", "==", store),
    where("memberNo", "==", clean),
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

// ---------- تعطيل/تفعيل عضوية — للمدير، بسبب إلزامي وسجل تدقيق ----------
/**
 * المرحلة 2: الحذف ممنوع بالتصميم — التعطيل هو البديل.
 * داخل معاملة واحدة: تحديث status (+ الفاعل/السبب/التاريخ على المستند)
 * وإنشاء حركة تدقيق type:"audit" بنقاط 0 — لا تدخل في أي حساب رصيد/فئة
 * (مستثناة صراحةً في loyaltyMath) ولا تُعدَّل ولا تُحذف.
 */
export async function setLoyaltyMemberStatus(memberId, status, { reason, byUid = "", byName = "" } = {}) {
  const newStatus = status === "disabled" ? "disabled" : "active";
  if (!String(reason || "").trim()) throw loyaltyError("reason-required", "السبب إلزامي");

  const memberRef = doc(db, "loyaltyMembers", memberId);
  const txRef = doc(collection(db, "loyaltyTransactions"));

  await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
    const m = memberSnap.data();
    tx.set(txRef, {
      memberId,
      store: m.store,
      type: "audit",
      action: newStatus === "disabled" ? "disable" : "enable",
      points: 0,
      balanceAfter: Number(m.pointsBalance) || 0,
      oldValue: m.status || "active",
      newValue: newStatus,
      reason: String(reason).trim(),
      byUid,
      byName,
      at: serverTimestamp(),
    });
    tx.update(memberRef, {
      status: newStatus,
      statusReason: String(reason).trim(),
      statusChangedAt: serverTimestamp(),
      statusBy: byName || byUid,
      updatedAt: serverTimestamp(),
    });
  });
  invalidateCachePrefix("loyalty");
}

// ---------- تعديل الجوال/الاسم — للمدير، بسبب إلزامي وسجل تدقيق ----------
/**
 * الجوال الجديد يمر بنفس دالة التوحيد (+9665XXXXXXXX)، ويُرفض إن كان
 * مستخدماً في عضوية أخرى بنفس المتجر. تُسجَّل القيمة القديمة والجديدة
 * والفاعل والسبب كحركة audit (نقاط 0).
 */
export async function updateLoyaltyMemberContact({
  memberId,
  name,
  phone: phoneInput,
  reason,
  byUid = "",
  byName = "",
}) {
  if (!String(reason || "").trim()) throw loyaltyError("reason-required", "السبب إلزامي");

  const memberRef = doc(db, "loyaltyMembers", memberId);
  const snap = await getDoc(memberRef);
  if (!snap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
  const m = snap.data();

  const changes = [];
  const update = { updatedAt: serverTimestamp() };

  if (name !== undefined && String(name).trim() !== m.name) {
    if (!String(name).trim()) throw loyaltyError("name-required", "أدخل اسم العميل");
    update.name = String(name).trim();
    changes.push({ action: "editName", oldValue: m.name || "", newValue: update.name });
  }

  if (phoneInput !== undefined) {
    const phone = normalizePhone(phoneInput);
    if (!phone) throw loyaltyError("invalid-phone", "رقم الجوال غير صالح");
    if (phone !== m.phone) {
      // رفض التكرار داخل نفس المتجر
      const existing = await findLoyaltyMemberByPhone(m.store, phone);
      if (existing && existing.id !== memberId) {
        throw loyaltyError("phone-exists", "رقم الجوال مسجّل مسبقاً في هذا المتجر");
      }
      update.phone = phone;
      changes.push({ action: "editPhone", oldValue: m.phone || "", newValue: phone });
    }
  }

  if (changes.length === 0) return { changed: false };

  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(memberRef);
    if (!fresh.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
    const balance = Number(fresh.data().pointsBalance) || 0;
    for (const c of changes) {
      const txRef = doc(collection(db, "loyaltyTransactions"));
      tx.set(txRef, {
        memberId,
        store: m.store,
        type: "audit",
        action: c.action,
        points: 0,
        balanceAfter: balance,
        oldValue: c.oldValue,
        newValue: c.newValue,
        reason: String(reason).trim(),
        byUid,
        byName,
        at: serverTimestamp(),
      });
    }
    tx.update(memberRef, update);
  });
  invalidateCachePrefix("loyalty");
  return { changed: true };
}
