// src/loyaltyShare.js
// ====================================================================
// برنامج الولاء — منطق المشاركة النقي. بلا Firebase وبلا DOM،
// حتى يستورده كلٌّ من التطبيق و api/card.js (سيرفرless) والاختبارات.
//
// النسخة 3.0 — نظام رصيد بالريال (هللات صحيحة):
//   • LOYALTY_DEFAULT_SETTINGS بالبنية الجديدة (فئات بنسب كسب، بلا مكافآت)
//   • بناء payload البطاقة العامة بقائمة حقول مسموحة صراحة (whitelist) —
//     language ممرَّر عمداً استعداداً للمرحلة B، وgender لا يظهر أبداً
//   • تقنيع رقم الجوال
//   • قوالب رسائل واتساب (ترحيبية {ar,en} / تنبيه انتهاء {ar,en} /
//     إشعار الرصيد — نص عربي واحد الآن، يصير {ar,en} في المرحلة B)
//   • رابط wa.me (بدون + وبدون أصفار بادئة) ورابط البطاقة
// ====================================================================
// الامتداد .js صريح — هذه الوحدة يستوردها api/card.js وتعمل تحت Node ESM
// مباشرة على Vercel (الاستيراد بلا امتداد يفشل هناك خارج حزم Vite).
import {
  normalizePhone,
  toDateSafe,
  effectiveTier,
  isBalanceExpired,
} from "./loyaltyMath.js";

// ---------- أسماء المتاجر (للبطاقة والرسائل — عربية دائماً) ----------
export const STORE_NAMES = { toia: "تويا", wardana: "وردانة" };

// ---------- قالب إشعار الرصيد الافتراضي (بديل إشعار النقاط — Batch 92/92.2) ----------
// رسالة معاملاتية بحتة — بلا محتوى تسويقي، لا تخضع لـ marketingConsent
// ولا لأي حد يومي ولا تُسجَّل في أي مجموعة. بلا «اليوم» عمداً: صياغة
// صحيحة للإرسال الفوري وإعادة الإرسال معاً.
// قابل للتعديل من الإعدادات (creditMessage) — نص عربي واحد الآن،
// ويصير {ar,en} في المرحلة B مثل بقية الرسائل.
export const CREDIT_NOTIFY_TEMPLATE =
  "مرحبًا {name} 🌸\n" +
  "أُضيف إلى رصيدك {earned} ريال من مشترياتك.\n" +
  "رصيدك الآن: {balance} ريال.\n\n" +
  "بطاقتك: {cardUrl}\n\n" +
  "نسعد بخدمتك — {storeName}";

// المتغيرات المتاحة لرسالة إشعار الرصيد تحديداً — {memberNo} و{tier}
// يستبدلهما المُستبدِل عموماً لكن هذه الرسالة لا تمرر قيمتيهما (فراغ صامت)،
// لذلك يُعدّان «غير معروفين» في تحذير محرر هذا الحقل.
export const CREDIT_MESSAGE_VARS = ["name", "earned", "balance", "cardUrl", "storeName"];

// المتغيرات المتاحة للرسالة الترحيبية ولتنبيه الانتهاء (سطر المساعدة في الإعدادات)
export const WELCOME_MESSAGE_VARS = ["name", "storeName", "memberNo", "tier", "balance", "cardUrl"];
export const EXPIRY_MESSAGE_VARS = ["name", "storeName", "balance", "expiryDate", "cardUrl"];

// ---------- الإعدادات الافتراضية (الوثيقة المرجعية 3.0) ----------
export const LOYALTY_DEFAULT_SETTINGS = {
  enabled: true,
  // الفئات: عتبة مكتسب (هللات) + نسبة كسب مئوية — بلا max، أعلى عتبة مبلوغة تفوز
  tiers: [
    { key: "silver", name: { ar: "فضية", en: "Silver" }, minEarnedHalalas: 0, ratePercent: 2.5 },
    { key: "gold", name: { ar: "ذهبية", en: "Gold" }, minEarnedHalalas: 5000, ratePercent: 2.75 },
    { key: "platinum", name: { ar: "بلاتينية", en: "Platinum" }, minEarnedHalalas: 10000, ratePercent: 3 },
  ],
  tierWindowMonths: 24,
  expiryMonths: 12,
  expiryWarningDays: 30,
  welcomeBonusEnabled: true,
  welcomeBonusHalalas: 500, // 5 ريالات
  welcomeBonusDelayHours: 24,
  earnRoundingHalalas: 25, // تقريب الكسب لأقرب ربع ريال
  redeemStepHalalas: 25, // خطوة الاستبدال ربع ريال
  vatRegistered: false,
  amountBasis: "gross", // "gross" | "net"
  vatRate: 0.15,
  largeTransactionAlertRiyals: 1000,
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
  // الرسالة الترحيبية — حقلان (عربي/إنجليزي). المتغيرات: WELCOME_MESSAGE_VARS
  welcomeMessage: {
    ar:
      "مرحبًا {name} 🌹\n" +
      "تم تسجيلك في برنامج ولاء {storeName}.\n" +
      "رقم عضويتك: {memberNo}\n" +
      "رصيدك الحالي: {balance} ريال\n\n" +
      "بطاقتك الرقمية:\n{cardUrl}\n\n" +
      "اعرض الرمز عند الدفع لتجميع رصيدك واستخدامه من مشترياتك.",
    en:
      "Hello {name} 🌹\n" +
      "You are now a member of the {storeName} loyalty program.\n" +
      "Membership no: {memberNo}\n" +
      "Your balance: SAR {balance}\n\n" +
      "Your digital card:\n{cardUrl}\n\n" +
      "Show the code at checkout to earn and redeem your balance.",
  },
  // تنبيه قرب انتهاء الرصيد — حقلان (عربي/إنجليزي). المتغيرات: EXPIRY_MESSAGE_VARS
  expiryWarningMessage: {
    ar:
      "مرحبًا {name} 🌸\n" +
      "رصيدك {balance} ريال في {storeName} سينتهي بتاريخ {expiryDate}.\n" +
      "نسعد بزيارتك لاستخدامه قبل الانتهاء.",
    en:
      "Hello {name} 🌸\n" +
      "Your SAR {balance} balance at {storeName} expires on {expiryDate}.\n" +
      "We would love to see you before it expires.",
  },
  // إشعار الرصيد بعد الشراء — قابل للتعديل، عربي واحد الآن (المرحلة B: ثنائي)
  creditMessage: CREDIT_NOTIFY_TEMPLATE,
  // قنوات التواصل — تُعرض في صفحة البطاقة (المرحلة B) وتُدار من الإعدادات الآن
  contacts: { whatsapp: "", instagram: "", tiktok: "" },
};

// ---------- تقنيع الجوال ----------
/**
 * +966501234567 → 05******67 (صيغة محلية، أول خانتين وآخر خانتين فقط).
 * أي صيغة غير صالحة → قناع كامل ثابت (لا تسريب).
 */
export function maskPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return "**********";
  const local = "0" + normalized.slice(4); // +9665XXXXXXXX → 05XXXXXXXX
  return local.slice(0, 2) + "*".repeat(local.length - 4) + local.slice(-2);
}

// ---------- تنسيق تاريخ YYYY-MM-DD بتوقيت السعودية ----------
// (بلا toISOString — القاعدة نفسها المتبعة في dateHelpers)
function fmtDateSaudi(v) {
  const d = toDateSafe(v);
  if (!d) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }); // YYYY-MM-DD
}

// ---------- payload البطاقة العامة ----------
// القائمة البيضاء الوحيدة المسموح بها في استجابة /api/card —
// أي حقل خارجها يفشل اختبار vitest المخصص.
// language ممرَّر عمداً (تحتاجه صفحة البطاقة ثنائية اللغة في المرحلة B) —
// أما gender فلا يظهر أبداً بأي شكل.
export const CARD_PAYLOAD_ALLOWED_KEYS = [
  "store",
  "storeName",
  "name",
  "memberNo",
  "tier",
  "language",
  "balanceHalalas",
  "joinedAt",
  "balanceExpiresAt",
  "phoneMasked",
  "expiryMonths",
];

/**
 * يبني استجابة /api/card من مستند العضو + حركاته + الإعدادات.
 * لا يعيد إطلاقاً: memberId، cardToken، الجوال كاملاً، الجنس، سجل
 * المشتريات، أرقام الفواتير، أي حركة، أي حقل إداري.
 * الرصيد المنتهي (كسولاً) يُعرض 0 دون أي كتابة — العرض فقط.
 */
export function buildCardPayload(member, transactions, settings, now = new Date()) {
  const s = { ...LOYALTY_DEFAULT_SETTINGS, ...(settings || {}) };
  const expiredNow = isBalanceExpired(member, now);
  const balance = expiredNow ? 0 : Number(member.balanceHalalas) || 0;
  const { tier } = effectiveTier(member, transactions, s, now);

  return {
    store: member.store,
    storeName: STORE_NAMES[member.store] || member.store,
    name: member.name || "",
    memberNo: member.memberNo || "",
    tier: tier ? { key: tier.key, name: tier.name } : null,
    language: member.language === "en" ? "en" : "ar",
    balanceHalalas: balance,
    joinedAt: fmtDateSaudi(member.joinedAt),
    balanceExpiresAt: expiredNow ? null : fmtDateSaudi(member.balanceExpiresAt),
    phoneMasked: maskPhone(member.phone),
    // مدة انتهاء الرصيد (شهور) — من إعدادات المتجر، لنص الشروط في البطاقة
    expiryMonths: Number(s.expiryMonths) || 0,
  };
}

// ---------- رسائل واتساب ----------
/**
 * استبدال متغيرات القالب: {name} {storeName} {memberNo} {tier} {balance}
 * {earned} {expiryDate} {cardUrl}
 * قالب بلا متغيرات (نصوص محفوظة قديمة) يُترك كما هو.
 * متغير بلا قيمة → يُستبدل بنص فارغ.
 */
export function renderWelcomeMessage(template, vars = {}) {
  const known = ["name", "storeName", "memberNo", "tier", "balance", "earned", "expiryDate", "cardUrl"];
  let out = String(template || "");
  for (const key of known) {
    const value = vars[key] == null ? "" : String(vars[key]);
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

// ---------- إشعار الرصيد المعاملاتي (خلف Batch 92 / 92.2) ----------
/**
 * نص إشعار الرصيد بعد الشراء — نفس آلية الرسالة الترحيبية.
 * {earned} و{balance} تأتيان من الحركة نفسها (deltaHalalas/balanceAfterHalalas
 * بصيغة عرض بالريال) لا من قراءة جديدة — حتى تكون إعادة الإرسال دقيقة تاريخياً.
 *
 * template اختياري (من loyaltySettings.creditMessage) —
 * إن كان غير ممرر أو فارغاً بعد trim يُستخدم القالب الثابت.
 */
export function buildCreditMessage(vars = {}, template) {
  const effective = String(template || "").trim() ? template : CREDIT_NOTIFY_TEMPLATE;
  return renderWelcomeMessage(effective, vars);
}

/**
 * يكشف المتغيرات {...} غير المعروفة في قالب — لتحذير غير مانع
 * في محرر الإعدادات. allowed هي قائمة المسموح لهذا الحقل تحديداً.
 * يرجع مصفوفة أسماء فريدة (بلا أقواس)، فارغة إن كان القالب نظيفاً.
 */
export function findUnknownVars(template, allowed = CREDIT_MESSAGE_VARS) {
  const found = new Set();
  const allowedSet = new Set(allowed);
  const re = /\{([^{}\s]+)\}/g;
  let m;
  while ((m = re.exec(String(template || ""))) !== null) {
    if (!allowedSet.has(m[1])) found.add(m[1]);
  }
  return [...found];
}

/**
 * رابط wa.me — يتطلب الرقم بلا + وبلا أصفار بادئة: 966501234567.
 * يقبل أي صيغة جوال صالحة (يوحّدها أولاً). يرجع null لصيغة غير صالحة.
 */
export function buildWhatsappUrl(phone, text) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const digits = normalized.slice(1); // +966501234567 → 966501234567
  return `https://wa.me/${digits}?text=${encodeURIComponent(String(text || ""))}`;
}

// ---------- رابط البطاقة ----------
export function cardUrlFor(origin, cardToken) {
  if (!origin || !cardToken) return null;
  return `${String(origin).replace(/\/+$/, "")}/c/${cardToken}`;
}

/** أصل تطوير محلي؟ (لا يصلح رابط بطاقة يُرسل للعميل) */
export function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(String(origin || ""));
}
