// src/loyaltyShare.js
// ====================================================================
// برنامج الولاء — منطق المشاركة النقي (المرحلة 2). بلا Firebase وبلا DOM،
// حتى يستورده كلٌّ من التطبيق و api/card.js (سيرفرless) والاختبارات.
//
// يغطي:
//   • LOYALTY_DEFAULT_SETTINGS (انتقل من firebaseLoyalty — يُعاد تصديره هناك)
//   • بناء payload البطاقة العامة بقائمة حقول مسموحة صراحة (whitelist)
//   • تقنيع رقم الجوال
//   • قالب رسالة واتساب الترحيبية واستبدال المتغيرات
//   • رابط wa.me (بدون + وبدون أصفار بادئة) ورابط البطاقة
// ====================================================================
// الامتداد .js صريح — هذه الوحدة يستوردها api/card.js وتعمل تحت Node ESM
// مباشرة على Vercel (الاستيراد بلا امتداد يفشل هناك خارج حزم Vite).
import {
  normalizePhone,
  toDateSafe,
  effectiveTier,
  isPointsExpired,
} from "./loyaltyMath.js";

// ---------- أسماء المتاجر (للبطاقة والرسائل — عربية دائماً) ----------
export const STORE_NAMES = { toia: "تويا", wardana: "وردانة" };

// ---------- الإعدادات الافتراضية (وثيقة المنطق 2.1 + قالب المرحلة 2) ----------
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
  // المتغيرات المدعومة: {name} {storeName} {memberNo} {tier} {points} {cardUrl}
  welcomeMessage:
    "مرحبًا {name} 🌹\n" +
    "تم تسجيلك في برنامج ولاء {storeName}.\n" +
    "رقم عضويتك: {memberNo}\n" +
    "رصيدك الحالي: {points} نقطة\n\n" +
    "بطاقتك الرقمية:\n{cardUrl}\n\n" +
    "اعرض الرمز عند الدفع لتجميع نقاطك واستبدال مكافآتك.",
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
export const CARD_PAYLOAD_ALLOWED_KEYS = [
  "store",
  "storeName",
  "name",
  "memberNo",
  "tier",
  "pointsBalance",
  "redemptionsCount",
  "joinedAt",
  "pointsExpireAt",
  "rewards",
  "nextReward",
  "phoneMasked",
  "expiryMonths",
];

/**
 * يبني استجابة /api/card من مستند العضو + حركاته + الإعدادات.
 * لا يعيد إطلاقاً: memberId، cardToken، الجوال كاملاً، سجل المشتريات،
 * أرقام الفواتير، أي حركة، أي حقل إداري.
 * النقاط المنتهية (كسولاً) تُعرض 0 دون أي كتابة — العرض فقط.
 */
export function buildCardPayload(member, transactions, settings, now = new Date()) {
  const s = { ...LOYALTY_DEFAULT_SETTINGS, ...(settings || {}) };
  const expiredNow = isPointsExpired(member, now);
  const balance = expiredNow ? 0 : Number(member.pointsBalance) || 0;
  const { tier } = effectiveTier(member, transactions, s, now);

  const activeRewards = (s.rewards || []).filter((r) => r.active !== false);
  const rewards = activeRewards.map((r) => ({
    id: r.id,
    label: r.label,
    points: Number(r.points) || 0,
    unlocked: balance >= (Number(r.points) || 0) && balance > 0,
  }));
  // المكافأة التالية: أرخص مكافأة لم يبلغها الرصيد بعد
  const next = activeRewards
    .filter((r) => (Number(r.points) || 0) > balance)
    .sort((a, b) => (Number(a.points) || 0) - (Number(b.points) || 0))[0] || null;

  return {
    store: member.store,
    storeName: STORE_NAMES[member.store] || member.store,
    name: member.name || "",
    memberNo: member.memberNo || "",
    tier: tier ? { key: tier.key, name: tier.name } : null,
    pointsBalance: balance,
    redemptionsCount: Number(member.redemptionsCount) || 0,
    joinedAt: fmtDateSaudi(member.joinedAt),
    pointsExpireAt: expiredNow ? null : fmtDateSaudi(member.pointsExpireAt),
    rewards,
    nextReward: next ? { label: next.label, points: Number(next.points) || 0 } : null,
    phoneMasked: maskPhone(member.phone),
    // مدة انتهاء النقاط (شهور) — من إعدادات المتجر، لنص الشروط في البطاقة
    expiryMonths: Number(s.expiryMonths) || 0,
  };
}

// ---------- رسالة واتساب ----------
/**
 * استبدال متغيرات القالب: {name} {storeName} {memberNo} {tier} {points} {cardUrl}
 * قالب بلا متغيرات (نصوص محفوظة قديمة) يُترك كما هو.
 * متغير بلا قيمة → يُستبدل بنص فارغ.
 */
export function renderWelcomeMessage(template, vars = {}) {
  const known = ["name", "storeName", "memberNo", "tier", "points", "cardUrl"];
  let out = String(template || "");
  for (const key of known) {
    const value = vars[key] == null ? "" : String(vars[key]);
    out = out.split(`{${key}}`).join(value);
  }
  return out;
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
