// src/firebaseLoyalty.js
// ====================================================================
// برنامج الولاء — طبقة البيانات (النسخة 3.0: رصيد بالريال، هللات صحيحة).
//
// المجموعات (camelCase التزاماً بنمط المشروع):
//   loyaltyMembers/{memberId}        ملفات الأعضاء (لكل متجر عضوية مستقلة)
//   loyaltyTransactions/{txId}       سجل الحركات — إضافي فقط (append-only):
//                                    earn / redeem / welcome / adjust /
//                                    reverse / expire / audit
//   loyaltyInvoices/{store}_{invoiceNo}  معرّف المستند نفسه = ضمان عدم تكرار
//                                    الفاتورة ذرّياً (create فقط داخل معاملة)
//   loyaltySettings/{store}          إعدادات كل متجر
//
// مبادئ إلزامية:
//   • كل المبالغ هللات صحيحة (deltaHalalas / amountHalalas /
//     balanceAfterHalalas / balanceHalalas) — ممنوع الريال العشري في أي
//     منطق أو مستند؛ القسمة على 100 للعرض فقط في الواجهة.
//   • كل earn/redeem/adjust/reverse/expire — والتسجيل مع شراء — داخل
//     runTransaction واحدة (كل شيء أو لا شيء).
//   • لا حذف ولا تعديل في مكانه لأي حركة: العكس حركة جديدة، والربط يُشتق
//     عند القراءة من reversesTxId (مع معرّف حتمي rev_{txId} يمنع العكس المزدوج).
//   • النسبة والفئة المطبقتان تُحفظان في حركة earn لحظة العملية
//     (ratePercent / tierAtTime) ولا يُعاد حسابهما لاحقاً.
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
import { db, auth } from "./firebaseCore";
import { invalidateCachePrefix } from "./firebaseCache";
import {
  normalizePhone,
  computeEarnedHalalas,
  computeExpiryAt,
  isBalanceExpired,
  isValidRedeemAmount,
  availableBalanceHalalas,
  halalasToRiyalLabel,
  effectiveTier,
  tierForEarned,
  invoiceDocId,
  randomMemberNo,
  randomCardToken,
} from "./loyaltyMath";
import { LOYALTY_DEFAULT_SETTINGS } from "./loyaltyShare";

// الإعدادات الافتراضية في loyaltyShare.js (وحدة نقية يستوردها أيضاً
// api/card.js بلا تهيئة Firebase) — يُعاد تصديرها هنا حتى تبقى
// الاستيرادات القائمة من '../firebase' كما هي.
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

/**
 * كل حركات متجر في جلبة واحدة — لصفحة الإحصائيات.
 * التجميع (فترات/شهور/موظفون) يتم محلياً في loyaltyStats بدل استعلامات
 * متعددة، والنتيجة تمر عبر useCachedQuery في الشاشة.
 * حد معروف: تكبر مع السنين — مقبولة لحجم متجرين حالياً.
 */
export async function getLoyaltyTransactionsByStore(store) {
  const q = query(collection(db, "loyaltyTransactions"), where("store", "==", store));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
 *
 * رقم الفاتورة والمبلغ اختياريان عند التسجيل:
 *   • تسجيل بلا شراء → العضوية + المكافأة الترحيبية فقط
 *   • تسجيل مع شراء → العضوية + الترحيبية + مستند الفاتورة + حركة earn،
 *     كلها في معاملة واحدة (كل شيء أو لا شيء)
 * amountHalalas بالهللات (الواجهة تحوّل الريال قبل الاستدعاء).
 */
export async function createLoyaltyMember({
  store,
  phone: phoneInput,
  name,
  gender,
  language,
  source = "",
  sourceOther = "",
  marketingConsent = false,
  invoiceNo = "",
  amountHalalas = null,
  byUid = "",
  byName = "",
}) {
  const phone = normalizePhone(phoneInput);
  if (!phone) throw loyaltyError("invalid-phone", "رقم الجوال غير صالح");
  if (!String(name || "").trim()) throw loyaltyError("name-required", "أدخل اسم العميل");
  // الجنس إلزامي عند التسجيل — خياران فقط لا ثالث لهما.
  if (gender !== "male" && gender !== "female") {
    throw loyaltyError("gender-required", "حدّد جنس العميل");
  }
  // النسخة 3.0: لغة العميل إلزامية عند التسجيل (عربي / English)
  if (language !== "ar" && language !== "en") {
    throw loyaltyError("language-required", "حدّد لغة العميل");
  }

  const settings = await getLoyaltySettings(store);
  if (settings.enabled === false) throw loyaltyError("disabled", "برنامج الولاء معطّل لهذا المتجر");

  // شراء عند التسجيل؟ التحقق من رقم الفاتورة يسري فقط إن أُدخل —
  // لكن الفاتورة والمبلغ يلزمان معاً (لا أحدهما دون الآخر)
  const hasInvoice = !!String(invoiceNo || "").trim();
  const amt = amountHalalas == null || amountHalalas === "" ? null : Math.round(Number(amountHalalas));
  const hasAmount = Number.isFinite(amt) && amt > 0;
  if (hasInvoice && !hasAmount) throw loyaltyError("amount-invalid", "أدخل مبلغ الفاتورة");
  if (hasAmount && !hasInvoice) throw loyaltyError("invoice-required", "أدخل رقم الفاتورة");
  const withPurchase = hasInvoice && hasAmount;
  const invId = withPurchase ? invoiceDocId(store, invoiceNo) : null;
  if (withPurchase && !invId) throw loyaltyError("invoice-required", "رقم الفاتورة غير صالح");

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

  const welcomeHalalas =
    settings.welcomeBonusEnabled === false ? 0 : Math.round(Number(settings.welcomeBonusHalalas) || 0);

  // عضو جديد: مكتسبه في النافذة صفر → فئته المحسوبة هي فئة العتبة 0 (فضية)،
  // ونسبتها هي المطبقة على شراء التسجيل. الترحيبية لا تدخل حساب الفئة.
  const startTier = tierForEarned(0, settings.tiers);
  const startRate = Number(startTier?.ratePercent) || 0;
  const earnedHalalas = withPurchase ? computeEarnedHalalas(amt, startRate, settings) : 0;

  const now = new Date();
  const balanceHalalas = welcomeHalalas + earnedHalalas;
  // انتهاء الرصيد: مع شراء = lastPurchaseAt + expiryMonths؛
  // بلا شراء تنتهي الترحيبية بـ joinedAt + expiryMonths (كلاهما "الآن" هنا)
  const balanceExpiresAt = balanceHalalas > 0 ? computeExpiryAt(now, settings.expiryMonths) : null;

  const memberRef = doc(collection(db, "loyaltyMembers"));
  const invoiceRef = invId ? doc(db, "loyaltyInvoices", invId) : null;
  const data = {
    store,
    memberNo,
    cardToken,
    phone,
    name: String(name).trim(),
    gender,
    language,
    source: source || "",
    sourceOther: source === "other" ? String(sourceOther || "").trim() : "",
    marketingConsent: !!marketingConsent,
    joinedAt: serverTimestamp(),
    balanceHalalas,
    lastPurchaseAt: withPurchase ? now : null,
    balanceExpiresAt,
    welcomeBonusAt: welcomeHalalas > 0 ? now : null,
    manualTier: null,
    status: "active",
    anonymized: false,
    cardViews: 0,
    lastCardViewAt: null,
    createdBy: byUid,
    createdByName: byName,
    updatedAt: serverTimestamp(),
  };

  await runTransaction(db, async (tx) => {
    // كل القراءات قبل الكتابات (شرط معاملات Firestore)
    if (invoiceRef) {
      const invSnap = await tx.get(invoiceRef);
      if (invSnap.exists()) {
        throw loyaltyError("duplicate-invoice", "رقم الفاتورة مستخدم مسبقاً في هذا المتجر");
      }
    }
    tx.set(memberRef, data);
    if (welcomeHalalas > 0) {
      const welcomeTxRef = doc(collection(db, "loyaltyTransactions"));
      tx.set(welcomeTxRef, {
        memberId: memberRef.id,
        store,
        type: "welcome",
        deltaHalalas: welcomeHalalas,
        balanceAfterHalalas: welcomeHalalas,
        reason: "مكافأة ترحيبية",
        byUid,
        byName,
        at: serverTimestamp(),
      });
    }
    if (withPurchase) {
      const earnTxRef = doc(collection(db, "loyaltyTransactions"));
      tx.set(invoiceRef, {
        memberId: memberRef.id,
        txId: earnTxRef.id,
        amountHalalas: amt,
        at: serverTimestamp(),
      });
      tx.set(earnTxRef, {
        memberId: memberRef.id,
        store,
        type: "earn",
        amountHalalas: amt,
        deltaHalalas: earnedHalalas,
        balanceAfterHalalas: welcomeHalalas + earnedHalalas,
        // النسبة والفئة لحظة العملية — تُحفظان ولا يُعاد حسابهما
        ratePercent: startRate,
        tierAtTime: startTier?.key || "",
        invoiceNo: String(invoiceNo).trim(),
        amountBasis: settings.amountBasis,
        vatRate: settings.vatRate,
        byUid,
        byName,
        at: serverTimestamp(),
      });
    }
  });

  invalidateCachePrefix("loyalty");
  return { id: memberRef.id, ...data, earnedHalalas, welcomeHalalas };
}

// ---------- فتح ملف عضو + الانتهاء الكسول ----------
/**
 * جلب عضو بالمعرّف مع تطبيق انتهاء الرصيد الكسول:
 * إذا now > balanceExpiresAt والرصيد > 0 → حركة expire سالبة تُصفّر الرصيد
 * (داخل معاملة، مع إعادة الفحص داخلها منعاً للتصفير المزدوج). لا حذف لأي سجل.
 */
export async function getLoyaltyMember(memberId, { byUid = "", byName = "" } = {}) {
  const ref = doc(db, "loyaltyMembers", memberId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
  let member = { id: snap.id, ...snap.data() };

  if (isBalanceExpired(member)) {
    await runTransaction(db, async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists()) return;
      const m = fresh.data();
      if (!isBalanceExpired(m)) return; // صُفّر من جلسة أخرى — لا شيء نفعله
      const balance = Number(m.balanceHalalas) || 0;
      const txRef = doc(collection(db, "loyaltyTransactions"));
      tx.set(txRef, {
        memberId,
        store: m.store,
        type: "expire",
        deltaHalalas: -balance,
        balanceAfterHalalas: 0,
        reason: "انتهاء صلاحية الرصيد",
        byUid,
        byName,
        at: serverTimestamp(),
      });
      tx.update(ref, { balanceHalalas: 0, updatedAt: serverTimestamp() });
    });
    invalidateCachePrefix("loyalty");
    const after = await getDoc(ref);
    member = { id: after.id, ...after.data() };
  }
  return member;
}

// ---------- إضافة رصيد شراء (earn) — معاملة ذرّية واحدة ----------
/**
 * الخطوات الثلاث داخل معاملة واحدة:
 *   1) create فقط لـ loyaltyInvoices/{store}_{invoiceNo} — التكرار يُفشل الكل
 *   2) حركة earn في loyaltyTransactions
 *   3) تحديث balanceHalalas / lastPurchaseAt / balanceExpiresAt في العضو
 *
 * amountHalalas هو المبلغ المدفوع نقداً بالهللات — الجزء المخصوم من الرصيد
 * (redeem) لا يكسب: الكسب على المدفوع فقط، والخصم عملية مستقلة.
 * يرجع { earnedHalalas, balanceAfterHalalas, ratePercent, tierAtTime, largeAlert }.
 */
export async function earnLoyaltyCredit({
  store,
  memberId,
  invoiceNo,
  amountHalalas,
  byUid = "",
  byName = "",
}) {
  const invId = invoiceDocId(store, invoiceNo);
  if (!invId) throw loyaltyError("invoice-required", "أدخل رقم الفاتورة");
  const amt = Math.round(Number(amountHalalas));
  if (!Number.isFinite(amt) || amt <= 0) throw loyaltyError("amount-invalid", "أدخل مبلغاً صحيحاً");

  const settings = await getLoyaltySettings(store);
  if (settings.enabled === false) throw loyaltyError("disabled", "برنامج الولاء معطّل لهذا المتجر");

  // لقطة الفئة/النسبة قبل المعاملة (snapshot): معاملات Firestore في client SDK
  // لا تسمح باستعلامات داخلها، فالفئة تُحسب هنا من الحركات المجلوبة وتُحفظ
  // في الحركة كما هي. السباق النظري (عمليتان متزامنتان لنفس العضو تعبران
  // عتبة فئة) مقبول عند هذا الحجم عمداً — لا حل معقداً له.
  const memberSnapshot = await getLoyaltyMember(memberId, { byUid, byName });
  const memberTxs = await getLoyaltyTransactions(memberId);
  const { tier } = effectiveTier(memberSnapshot, memberTxs, settings);
  const ratePercent = Number(tier?.ratePercent) || 0;
  const tierAtTime = tier?.key || "";
  const earned = computeEarnedHalalas(amt, ratePercent, settings);

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
    if (m.anonymized) throw loyaltyError("member-anonymized", "هذه العضوية محذوفة (مخفاة الهوية)");

    const balance = Number(m.balanceHalalas) || 0;
    const balanceAfterHalalas = balance + earned;
    const now = new Date();
    const expireAt = computeExpiryAt(now, settings.expiryMonths);

    tx.set(invoiceRef, {
      memberId,
      txId: txRef.id,
      amountHalalas: amt,
      at: serverTimestamp(),
    });
    tx.set(txRef, {
      memberId,
      store,
      type: "earn",
      amountHalalas: amt,
      deltaHalalas: earned,
      balanceAfterHalalas,
      // الأساس والنسبة والفئة وقت التنفيذ — للتاريخ (لو تغيّرت الإعدادات لاحقاً)
      ratePercent,
      tierAtTime,
      invoiceNo: String(invoiceNo).trim(),
      amountBasis: settings.amountBasis,
      vatRate: settings.vatRate,
      byUid,
      byName,
      at: serverTimestamp(),
    });
    tx.update(memberRef, {
      balanceHalalas: balanceAfterHalalas,
      lastPurchaseAt: now,
      balanceExpiresAt: expireAt,
      updatedAt: serverTimestamp(),
    });
    return { earnedHalalas: earned, balanceAfterHalalas };
  });

  invalidateCachePrefix("loyalty");
  const alertRiyals = Number(settings.largeTransactionAlertRiyals) || 0;
  return {
    ...result,
    ratePercent,
    tierAtTime,
    largeAlert: alertRiyals > 0 && amt >= alertRiyals * 100,
  };
}

// ---------- خصم من الرصيد (redeem) — معاملة ذرّية واحدة ----------
/**
 * لا حد أدنى — بمضاعفات redeemStepHalalas، ويغطي كامل الفاتورة إن كفى
 * الرصيد. لا يُطبَّق تلقائياً: يُخصم بطلب العميل فقط.
 * الرصيد المتاح = balanceHalalas ناقص الترحيبية ما دامت في فترة الانتظار
 * (بحد أدنى صفر) — الرفض إن تجاوز المبلغ المتاح.
 * التحقق + حركة redeem + تحديث الرصيد — كله أو لا شيء.
 */
export async function redeemLoyaltyCredit({
  store,
  memberId,
  amountHalalas,
  invoiceNo = "",
  byUid = "",
  byName = "",
}) {
  const settings = await getLoyaltySettings(store);
  if (settings.enabled === false) throw loyaltyError("disabled", "برنامج الولاء معطّل لهذا المتجر");
  const amt = Math.round(Number(amountHalalas));
  if (!Number.isFinite(amt) || amt <= 0) throw loyaltyError("amount-invalid", "أدخل مبلغاً صحيحاً");
  if (!isValidRedeemAmount(amt, settings.redeemStepHalalas)) {
    throw loyaltyError(
      "redeem-step",
      `مبلغ الخصم يجب أن يكون من مضاعفات ${halalasToRiyalLabel(settings.redeemStepHalalas)} ريال`
    );
  }

  const memberRef = doc(db, "loyaltyMembers", memberId);
  const txRef = doc(collection(db, "loyaltyTransactions"));

  const result = await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
    const m = memberSnap.data();
    if (m.status === "disabled") throw loyaltyError("member-disabled", "هذه العضوية معطّلة");
    if (m.anonymized) throw loyaltyError("member-anonymized", "هذه العضوية محذوفة (مخفاة الهوية)");

    const balance = Number(m.balanceHalalas) || 0;
    if (balance < 0) {
      throw loyaltyError("negative-balance", "الرصيد سالب — الاستبدال معطّل حتى تسوية الرصيد");
    }
    // المتاح يخصم الترحيبية المعلّقة — مثبّت عند صفر (لا متاح سالب)
    const available = availableBalanceHalalas(m, settings);
    if (amt > available) {
      throw loyaltyError(
        "insufficient-balance",
        `الرصيد المتاح لا يكفي (المتاح: ${halalasToRiyalLabel(available)} ريال)`
      );
    }

    const balanceAfterHalalas = balance - amt;
    tx.set(txRef, {
      memberId,
      store,
      type: "redeem",
      deltaHalalas: -amt,
      balanceAfterHalalas,
      invoiceNo: String(invoiceNo || "").trim(),
      byUid,
      byName,
      at: serverTimestamp(),
    });
    tx.update(memberRef, {
      balanceHalalas: balanceAfterHalalas,
      updatedAt: serverTimestamp(),
    });
    return { redeemedHalalas: amt, balanceAfterHalalas };
  });

  invalidateCachePrefix("loyalty");
  return result;
}

// ---------- تسوية يدوية (adjust) — للمدير ----------
/** حركة adjust بهللات موجبة أو سالبة مع سبب إلزامي — داخل معاملة. */
export async function adjustLoyaltyCredit({
  store,
  memberId,
  deltaHalalas,
  reason,
  byUid = "",
  byName = "",
}) {
  const delta = Math.round(Number(deltaHalalas));
  if (!delta) throw loyaltyError("amount-invalid", "أدخل مبلغاً غير صفري");
  if (!String(reason || "").trim()) throw loyaltyError("reason-required", "السبب إلزامي");

  const memberRef = doc(db, "loyaltyMembers", memberId);
  const txRef = doc(collection(db, "loyaltyTransactions"));

  const result = await runTransaction(db, async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
    const m = memberSnap.data();
    const balanceAfterHalalas = (Number(m.balanceHalalas) || 0) + delta;
    tx.set(txRef, {
      memberId,
      store,
      type: "adjust",
      deltaHalalas: delta,
      balanceAfterHalalas,
      reason: String(reason).trim(),
      byUid,
      byName,
      at: serverTimestamp(),
    });
    tx.update(memberRef, { balanceHalalas: balanceAfterHalalas, updatedAt: serverTimestamp() });
    return { balanceAfterHalalas };
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

    const delta = -(Number(orig.deltaHalalas) || 0);
    const balanceAfterHalalas = (Number(m.balanceHalalas) || 0) + delta;
    tx.set(revRef, {
      memberId,
      store,
      type: "reverse",
      deltaHalalas: delta,
      balanceAfterHalalas,
      reversesTxId: txId,
      reversedType: orig.type,
      reason: String(reason).trim(),
      byUid,
      byName,
      at: serverTimestamp(),
    });
    tx.update(memberRef, { balanceHalalas: balanceAfterHalalas, updatedAt: serverTimestamp() });
    return { balanceAfterHalalas };
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

// ---------- تعطيل/تفعيل عضوية — للمدير، وسجل تدقيق ----------
/**
 * الحذف ممنوع بالتصميم — التعطيل هو البديل.
 * داخل معاملة واحدة: تحديث status (+ الفاعل/السبب/التاريخ على المستند)
 * وإنشاء حركة تدقيق type:"audit" بقيمة 0 — لا تدخل في أي حساب رصيد/فئة
 * (مستثناة صراحةً في loyaltyMath) ولا تُعدَّل ولا تُحذف.
 */
export async function setLoyaltyMemberStatus(memberId, status, { reason, byUid = "", byName = "" } = {}) {
  const newStatus = status === "disabled" ? "disabled" : "active";
  // Batch 92.1: السبب اختياري — التعطيل قابل للاسترجاع (إعادة التفعيل)
  // ولا يمنح امتيازاً. يُحفظ إن كُتب، وحركة الـ audit تُنشأ دائماً.

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
      deltaHalalas: 0,
      balanceAfterHalalas: Number(m.balanceHalalas) || 0,
      oldValue: m.status || "active",
      newValue: newStatus,
      reason: String(reason || "").trim(),
      byUid,
      byName,
      at: serverTimestamp(),
    });
    tx.update(memberRef, {
      status: newStatus,
      statusReason: String(reason || "").trim(),
      statusChangedAt: serverTimestamp(),
      statusBy: byName || byUid,
      updatedAt: serverTimestamp(),
    });
  });
  invalidateCachePrefix("loyalty");
}

// ---------- تعديل الجوال/الاسم/الجنس/اللغة — للمدير، وسجل تدقيق ----------
/**
 * الجوال الجديد يمر بنفس دالة التوحيد (+9665XXXXXXXX)، ويُرفض إن كان
 * مستخدماً في عضوية أخرى بنفس المتجر. تُسجَّل القيمة القديمة والجديدة
 * والفاعل والسبب كحركة audit (قيمة 0).
 */
export async function updateLoyaltyMemberContact({
  memberId,
  name,
  phone: phoneInput,
  gender,
  language,
  reason,
  byUid = "",
  byName = "",
}) {
  // Batch 92.1: السبب اختياري — تعديل البيانات الأساسية قابل للاسترجاع
  // ولا يمس الرصيد. يُحفظ إن كُتب، وحركات audit (قديم→جديد) تُنشأ دائماً.
  // تأكيد تغيير الجوال يتم في الواجهة (نافذة قديم/جديد) لا هنا.

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

  // تعديل الجنس — للمدير فقط، بحركة audit
  if (gender !== undefined && gender !== (m.gender || "")) {
    if (gender !== "male" && gender !== "female") {
      throw loyaltyError("gender-invalid", "قيمة الجنس غير صالحة");
    }
    update.gender = gender;
    changes.push({ action: "editGender", oldValue: m.gender || "غير مسجّل", newValue: gender });
  }

  // النسخة 3.0: تعديل اللغة — للمدير فقط، بحركة audit
  if (language !== undefined && language !== (m.language || "")) {
    if (language !== "ar" && language !== "en") {
      throw loyaltyError("language-invalid", "قيمة اللغة غير صالحة");
    }
    update.language = language;
    changes.push({ action: "editLanguage", oldValue: m.language || "غير مسجّل", newValue: language });
  }

  if (changes.length === 0) return { changed: false };

  await runTransaction(db, async (tx) => {
    const fresh = await tx.get(memberRef);
    if (!fresh.exists()) throw loyaltyError("member-not-found", "العضوية غير موجودة");
    const balance = Number(fresh.data().balanceHalalas) || 0;
    for (const c of changes) {
      const txRef = doc(collection(db, "loyaltyTransactions"));
      tx.set(txRef, {
        memberId,
        store: m.store,
        type: "audit",
        action: c.action,
        deltaHalalas: 0,
        balanceAfterHalalas: balance,
        oldValue: c.oldValue,
        newValue: c.newValue,
        reason: String(reason || "").trim(),
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

// ---------- تعليم إرسال الترحيب (Batch 92) ----------
/**
 * يسجّل أن زر الترحيب فُتح لهذا العضو — welcomeSentAt.
 * تنبيه مهم: هذا يسجّل «فتح تبويب wa.me» لا «الإرسال الفعلي داخل واتساب»
 * (لا يمكن تقنياً معرفة الضغط على إرسال هناك) — لا تبنِ عليه أي تقرير
 * يفترض وصول الرسالة. غرضه الوحيد: تبديل نص الزر لمنع التكرار غير المقصود.
 */
export async function markLoyaltyWelcomeSent(memberId) {
  await updateDoc(doc(db, "loyaltyMembers", memberId), {
    welcomeSentAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidateCachePrefix("loyalty");
}

// ---------- درجات الحذف عبر /api/loyaltyAdmin ----------
// نفس نمط adminChangeUserPin في firebaseUsers.js: توكن المدير + POST.
// قواعد Firestore فيها allow delete: if false — الحذف/الإخفاء يمران
// حصراً عبر Admin SDK على الخادم.
async function callLoyaltyAdmin(body, fallbackMsg) {
  if (!auth.currentUser) throw loyaltyError("auth-required", "مطلوب تسجيل دخول");
  const token = await auth.currentUser.getIdToken();
  const res = await fetch("/api/loyaltyAdmin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw loyaltyError("admin-api", err.error || fallbackMsg);
  }
  invalidateCachePrefix("loyalty");
  return res.json();
}

/** إخفاء هوية عضو: يمسح الاسم/الجوال/الجنس ويبطل البطاقة — السجلات تبقى كاملة */
export async function loyaltyAnonymizeMember({ memberId, reason }) {
  return callLoyaltyAdmin(
    { action: "anonymize", memberId, reason },
    "تعذّر إخفاء الهوية"
  );
}

/** حذف كامل مع أرشفة — يتطلب كتابة رقم العضوية للتأكيد (يُتحقق منه خادمياً أيضاً) */
export async function loyaltyDeleteMemberWithArchive({ memberId, reason, confirmMemberNo }) {
  return callLoyaltyAdmin(
    { action: "deleteWithArchive", memberId, reason, confirmMemberNo },
    "تعذّر الحذف الكامل"
  );
}
