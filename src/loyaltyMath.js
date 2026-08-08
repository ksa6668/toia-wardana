// src/loyaltyMath.js
// ====================================================================
// برنامج الولاء — المنطق الحسابي النقي (بلا Firebase، بلا DOM).
// على غرار madaMath.js: كل الدوال هنا قابلة للاختبار بـ vitest مباشرة.
//
// النسخة 3.0 — نظام رصيد بالريال بدل النقاط:
//   • التخزين بالهللات كأعداد صحيحة حصراً — ممنوع تمثيل الريالات بعدد
//     عشري في أي منطق أو مستند؛ القسمة على 100 تحدث عند نقطة الرسم فقط
//     (halalasToRiyalLabel).
//   • الكسب: نسبة مئوية من مبلغ الفاتورة حسب فئة العميل، بتقريب لأقرب
//     ربع ريال (earnRoundingHalalas).
//   • الفئة تُحسب عند القراءة من مجموع deltaHalalas لحركات earn ضمن
//     نافذة الشهور، ناقصاً ما عُكس — welcome/redeem/expire/audit لا
//     تدخل هذا المجموع إطلاقاً.
//   • المكافأة الترحيبية معلّقة welcomeBonusDelayHours ساعة — الرصيد
//     المتاح للاستبدال يخصمها أثناء فترة الانتظار (بحد أدنى صفر).
//   • انتهاء الرصيد: balanceExpiresAt = lastPurchaseAt + expiryMonths.
// ====================================================================

// ---------- أرقام عربية → إنجليزية ----------
// الموظف قد يُدخل أرقاماً عربية-هندية (٠١٢…) أو فارسية (۰۱۲…) من الكيبورد.
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export function toEnglishDigits(str) {
  return String(str ?? '').replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_DIGITS.indexOf(ch);
    if (a >= 0) return String(a);
    const p = PERSIAN_DIGITS.indexOf(ch);
    return p >= 0 ? String(p) : ch;
  });
}

// ---------- توحيد رقم الجوال ----------
/**
 * يوحّد أي صيغة شائعة لجوال سعودي إلى +9665XXXXXXXX.
 * يقبل: 05XXXXXXXX / 5XXXXXXXX / 9665XXXXXXXX / +9665XXXXXXXX / 009665XXXXXXXX
 * (مع مسافات/شرطات/أقواس وأرقام عربية).
 * يرجع null إذا الصيغة غير صالحة.
 */
export function normalizePhone(input) {
  if (input == null) return null;
  let s = toEnglishDigits(input).replace(/[\s\-()]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) s = s.slice(1);
  if (/\D/.test(s)) return null;          // بعد إزالة + لا يُقبل غير الأرقام
  if (s.startsWith('00966')) s = s.slice(5);
  else if (s.startsWith('966')) s = s.slice(3);
  else if (s.startsWith('05')) s = s.slice(1);
  else if (s.startsWith('0')) return null; // 0X آخر غير 05 → غير صالح
  // الآن يجب أن يكون 5XXXXXXXX (9 أرقام تبدأ بـ5)
  if (!/^5\d{8}$/.test(s)) return null;
  return `+966${s}`;
}

// ---------- تحويل العملة (هللات صحيحة ↔ عرض بالريال) ----------
/**
 * إدخال الواجهة بالريال (نص، قد يحمل أرقاماً عربية وكسوراً) → هللات صحيحة.
 * يرجع null لقيمة غير صالحة. هذه نقطة الدخول الوحيدة لأي مبلغ من الواجهة.
 */
export function riyalsToHalalas(input) {
  const n = Number(toEnglishDigits(input));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * هللات → نص عرض بالريال ("375" هللة → "3.75"، ‏"400" → "4").
 * للعرض فقط — لا يدخل ناتجها في أي حساب.
 */
export function halalasToRiyalLabel(halalas) {
  const h = Math.round(Number(halalas) || 0);
  const sign = h < 0 ? '-' : '';
  const abs = Math.abs(h);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  if (frac === 0) return sign + whole.toLocaleString('en-US');
  return `${sign}${whole.toLocaleString('en-US')}.${String(frac).padStart(2, '0')}`;
}

// ---------- حساب الكسب ----------
/**
 * المبلغ المحتسب (بالهللات) حسب أساس الاحتساب:
 *   net  → المبلغ ÷ (1 + vatRate)   (منشأة مسجلة بالضريبة)
 *   gross → المبلغ كما هو
 * الناتج وسيط كسري يُقرَّب فوراً في computeEarnedHalalas.
 */
export function countedAmountHalalas(amountHalalas, { amountBasis = 'gross', vatRate = 0.15 } = {}) {
  const a = Number(amountHalalas) || 0;
  return amountBasis === 'net' ? a / (1 + (Number(vatRate) || 0)) : a;
}

/**
 * الكسب بالهللات = تقريب (المبلغ المحتسب × النسبة ÷ 100) لأقرب مضاعف
 * earnRoundingHalalas (افتراضياً 25 هللة = ربع ريال).
 * النسبة تأتي من فئة العميل لحظة العملية وتُحفظ في الحركة — لا يُعاد حسابها.
 */
export function computeEarnedHalalas(amountHalalas, ratePercent, settings = {}) {
  const counted = countedAmountHalalas(amountHalalas, settings);
  const rate = Number(ratePercent) || 0;
  const raw = (counted * rate) / 100;
  const step = Math.max(1, Math.round(Number(settings.earnRoundingHalalas) || 1));
  return Math.round(raw / step) * step;
}

// ---------- التواريخ ----------
/**
 * تحويل آمن لأي قيمة تاريخ (Firestore Timestamp / Date / string / ms) إلى Date أو null.
 *
 * Batch 91.3 — الحالة الحرجة: طبقة كاش sessionStorage تمر بـ JSON.stringify،
 * فيتحول Timestamp الحي إلى كائن عادي {seconds, nanoseconds} بلا toDate() —
 * وكانت هذه القيم ترجع null فتسقط من كل الحسابات الزمنية بصمت (أصفار
 * الإحصائيات). كل قراءة تاريخ من بيانات مكاشة يجب أن تمر من هنا.
 */
export function toDateSafe(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate(); // Firestore Timestamp حي
  if (v instanceof Date) return v;
  // Timestamp مُحيا من JSON (كاش sessionStorage) — شكل client SDK
  if (typeof v.seconds === 'number') {
    return new Date(v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6));
  }
  // نفس الشكل من Admin SDK بعد التسلسل (احتياطاً)
  if (typeof v._seconds === 'number') {
    return new Date(v._seconds * 1000 + Math.round((v._nanoseconds || 0) / 1e6));
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** إضافة شهور بتقويم محلي مع ضبط نهاية الشهر (31 يناير + شهر = 28/29 فبراير لا 3 مارس) */
export function addMonths(date, months) {
  const d = toDateSafe(date);
  if (!d) return null;
  const day = d.getDate();
  const res = new Date(d.getFullYear(), d.getMonth() + Number(months || 0), 1,
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  const lastDay = new Date(res.getFullYear(), res.getMonth() + 1, 0).getDate();
  res.setDate(Math.min(day, lastDay));
  return res;
}

/** إضافة ساعات (لفترة انتظار الترحيبية) */
export function addHours(date, hours) {
  const d = toDateSafe(date);
  if (!d) return null;
  return new Date(d.getTime() + (Number(hours) || 0) * 3600 * 1000);
}

/** تاريخ انتهاء الرصيد = lastPurchaseAt + expiryMonths (وللترحيبية: joinedAt + expiryMonths) */
export function computeExpiryAt(from, expiryMonths) {
  return addMonths(from, expiryMonths);
}

/** هل تنطبق تصفية الانتهاء الكسول؟ (الآن > balanceExpiresAt والرصيد موجب) */
export function isBalanceExpired(member, now = new Date()) {
  if (!member) return false;
  const expireAt = toDateSafe(member.balanceExpiresAt);
  if (!expireAt) return false;
  return now.getTime() > expireAt.getTime() && (Number(member.balanceHalalas) || 0) > 0;
}

// ---------- المكافأة الترحيبية المعلّقة ----------
/** متى تصبح الترحيبية متاحة للاستبدال؟ (welcomeBonusAt + delayHours) أو null */
export function welcomeAvailableAt(member, settings = {}) {
  const at = toDateSafe(member?.welcomeBonusAt);
  if (!at) return null;
  return addHours(at, Number(settings.welcomeBonusDelayHours) || 0);
}

/** هل الترحيبية ما تزال في فترة الانتظار؟ */
export function isWelcomeOnHold(member, settings = {}, now = new Date()) {
  const availableAt = welcomeAvailableAt(member, settings);
  return !!availableAt && now.getTime() < availableAt.getTime();
}

/**
 * الرصيد المتاح للاستبدال = balanceHalalas ناقص الترحيبية ما دامت معلّقة —
 * مثبّت عند صفر كحد أدنى: لا رصيد متاح سالب في أي حالة.
 */
export function availableBalanceHalalas(member, settings = {}, now = new Date()) {
  const balance = Number(member?.balanceHalalas) || 0;
  const held = isWelcomeOnHold(member, settings, now)
    ? Number(settings.welcomeBonusHalalas) || 0
    : 0;
  return Math.max(0, balance - held);
}

// ---------- الاستبدال ----------
/** صلاحية مبلغ الخصم: عدد صحيح موجب من مضاعفات redeemStepHalalas */
export function isValidRedeemAmount(amountHalalas, stepHalalas) {
  const a = Number(amountHalalas);
  const s = Math.max(1, Math.round(Number(stepHalalas) || 1));
  return Number.isInteger(a) && a > 0 && a % s === 0;
}

// ---------- المكتسب في النافذة والفئات ----------
/**
 * مجموع deltaHalalas لحركات type="earn" خلال آخر windowMonths شهراً،
 * مستبعداً الحركات المعكوسة (تُشتق من حركات reverse عبر reversesTxId —
 * سجل إضافي فقط، لا يُعدَّل مستند الحركة الأصلية في مكانه).
 * استثناءات صريحة: welcome و redeem و expire و audit لا تدخل هذا
 * المجموع إطلاقاً (الشرط يمر فقط على type === "earn").
 */
export function earnedHalalasInWindow(transactions, windowMonths, now = new Date()) {
  const txs = Array.isArray(transactions) ? transactions : [];
  const reversed = new Set(
    txs.filter((t) => t.type === 'reverse' && t.reversesTxId).map((t) => t.reversesTxId)
  );
  const windowStart = addMonths(now, -(Number(windowMonths) || 0));
  let sum = 0;
  for (const t of txs) {
    if (t.type !== 'earn') continue;
    if (t.id && reversed.has(t.id)) continue;
    const at = toDateSafe(t.at);
    if (!at) continue;
    if (windowStart && at.getTime() < windowStart.getTime()) continue;
    if (at.getTime() > now.getTime()) continue;
    sum += Number(t.deltaHalalas) || 0;
  }
  return sum;
}

// أنواع الحركات التي تدخل في حساب الرصيد. حركات "audit" (سجل التدقيق —
// تعطيل/تفعيل/تعديل بيانات، بقيمة 0) مستثناة صراحةً من أي حساب للرصيد
// أو للمكتسب، حتى لو حملت قيمة بالخطأ.
export const BALANCE_TX_TYPES = new Set(['earn', 'welcome', 'redeem', 'adjust', 'reverse', 'expire']);

/**
 * إعادة اشتقاق الرصيد من سجل الحركات (للتحقق/التدقيق):
 * مجموع deltaHalalas لكل الأنواع الرصيدية — audit مستثناة دائماً.
 */
export function deriveBalance(transactions) {
  const txs = Array.isArray(transactions) ? transactions : [];
  return txs.reduce(
    (sum, t) => (BALANCE_TX_TYPES.has(t.type) ? sum + (Number(t.deltaHalalas) || 0) : sum),
    0
  );
}

/** الفئات مرتبة تصاعدياً بعتبة minEarnedHalalas */
export function sortedTiers(tiers) {
  return (Array.isArray(tiers) ? [...tiers] : []).sort(
    (a, b) => (Number(a.minEarnedHalalas) || 0) - (Number(b.minEarnedHalalas) || 0)
  );
}

/**
 * الفئة المطابقة للمكتسب: أعلى فئة بلغ عتبتها minEarnedHalalas.
 * الفضية بعتبة 0 — كل عضو فضي على الأقل. يرجع null فقط لقائمة فئات فارغة.
 */
export function tierForEarned(earnedHalalas, tiers) {
  const e = Number(earnedHalalas) || 0;
  let match = null;
  for (const t of sortedTiers(tiers)) {
    if (e >= (Number(t.minEarnedHalalas) || 0)) match = t;
  }
  return match;
}

/**
 * الفئة التالية والمتبقي للترقية (بالهللات).
 * يرجع { nextTier, remainingHalalas } أو null إن كان في أعلى فئة.
 */
export function nextTierInfo(earnedHalalas, tiers) {
  const e = Number(earnedHalalas) || 0;
  for (const t of sortedTiers(tiers)) {
    const min = Number(t.minEarnedHalalas) || 0;
    if (min > e) return { nextTier: t, remainingHalalas: min - e };
  }
  return null;
}

/** هل الترقية اليدوية سارية الآن؟ (بلا until = دائمة حتى الإلغاء) */
export function isManualTierActive(manualTier, now = new Date()) {
  if (!manualTier || !manualTier.tier) return false;
  const until = toDateSafe(manualTier.until);
  return !until || now.getTime() <= until.getTime();
}

/**
 * الفئة الفعلية للعضو: الترقية اليدوية السارية تتقدم على المحسوبة آلياً.
 * يرجع { tier, manual, earnedHalalas, nextTier, remainingToNextHalalas }
 * — المتبقي للترقية يُحسب دائماً من المكتسب المحسوب (لا من اليدوية).
 */
export function effectiveTier(member, transactions, settings = {}, now = new Date()) {
  const tiers = settings.tiers || [];
  const earnedHalalas = earnedHalalasInWindow(transactions, settings.tierWindowMonths, now);
  const computed = tierForEarned(earnedHalalas, tiers);
  const next = nextTierInfo(earnedHalalas, tiers);
  const base = {
    earnedHalalas,
    nextTier: next?.nextTier || null,
    remainingToNextHalalas: next?.remainingHalalas ?? null,
  };
  if (member && isManualTierActive(member.manualTier, now)) {
    const manual = tiers.find((t) => t.key === member.manualTier.tier);
    if (manual) return { tier: manual, manual: true, ...base };
  }
  return { tier: computed, manual: false, ...base };
}

/** اسم الفئة بلغة العرض — name صار {ar,en} (توافق مع نص قديم احتياطاً) */
export function tierName(tier, lang = 'ar') {
  if (!tier) return '';
  const n = tier.name;
  if (n && typeof n === 'object') return n[lang] || n.ar || n.en || '';
  return String(n || '');
}

// ---------- معرّف مستند الفاتورة ----------
/**
 * معرّف مستند loyaltyInvoices: {store}_{invoiceNo} — المعرّف نفسه هو ضمان
 * عدم التكرار الذرّي (create فقط داخل معاملة يفشل تلقائياً عند التكرار).
 * يوحّد الأرقام العربية والمسافات حتى لا يمرّ نفس الرقم بصيغتين.
 * يرجع null إذا رقم الفاتورة فارغ/غير صالح.
 */
export function invoiceDocId(store, invoiceNo) {
  const clean = toEnglishDigits(invoiceNo).trim().replace(/\s+/g, '').replace(/\//g, '-');
  if (!store || !clean) return null;
  return `${store}_${clean}`;
}

// ---------- التوليد العشوائي ----------
// أعداد عشوائية آمنة عبر crypto.getRandomValues (متوفر في المتصفح وNode 18+).
function secureRandomInt(maxExclusive) {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}

/** حرف المتجر لرقم العضوية: تويا T / وردانة W */
export function storeLetter(store) {
  return store === 'wardana' ? 'W' : 'T';
}

/** رقم عضوية: حرف المتجر + 5 أرقام عشوائية، مثال T-48271 (فحص التفرد في طبقة البيانات) */
export function randomMemberNo(store, randInt = secureRandomInt) {
  const num = String(randInt(100000)).padStart(5, '0');
  return `${storeLetter(store)}-${num}`;
}

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // بلا حروف ملتبسة
/** توكن بطاقة عشوائي آمن ≥22 حرفاً (نستخدم 26 احتياطاً) */
export function randomCardToken(length = 26, randInt = secureRandomInt) {
  let out = '';
  for (let i = 0; i < length; i++) out += TOKEN_ALPHABET[randInt(TOKEN_ALPHABET.length)];
  return out;
}
