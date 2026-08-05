// src/loyaltyMath.js
// ====================================================================
// برنامج الولاء — المنطق الحسابي النقي (بلا Firebase، بلا DOM).
// على غرار madaMath.js: كل الدوال هنا قابلة للاختبار بـ vitest مباشرة.
//
// يغطي:
//   • توحيد صيغة رقم الجوال السعودي → +9665XXXXXXXX
//   • حساب نقاط الشراء (gross / net مع الضريبة)
//   • نقاط الفئة (تُحسب عند القراءة من حركات earn ضمن نافذة الشهور،
//     ناقصاً ما عُكس منها — الاستبدال والانتهاء لا يؤثران)
//   • الفئة الفعلية (الترقية اليدوية السارية تتقدم على المحسوبة)
//   • تاريخ انتهاء النقاط (lastPurchaseAt + expiryMonths)
//   • معرّف مستند الفاتورة {store}_{invoiceNo} (ضمان عدم التكرار الذرّي)
//   • توليد رقم العضوية والتوكن العشوائي
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

// ---------- حساب النقاط ----------
/**
 * المبلغ المحتسب حسب أساس النقاط:
 *   net  → المبلغ ÷ (1 + vatRate)   (منشأة مسجلة بالضريبة)
 *   gross → المبلغ كما هو
 */
export function countedAmount(amount, { pointsBasis = 'gross', vatRate = 0.15 } = {}) {
  const a = Number(amount) || 0;
  return pointsBasis === 'net' ? a / (1 + (Number(vatRate) || 0)) : a;
}

/** النقاط = round(المبلغ المحتسب × pointsPerRiyal) */
export function computeEarnPoints(amount, settings = {}) {
  const perRiyal = Number(settings.pointsPerRiyal) || 0;
  return Math.round(countedAmount(amount, settings) * perRiyal);
}

// ---------- التواريخ ----------
/** تحويل آمن لأي قيمة تاريخ (Firestore Timestamp / Date / string / ms) إلى Date أو null */
export function toDateSafe(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate(); // Firestore Timestamp
  if (v instanceof Date) return v;
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

/** تاريخ انتهاء النقاط = lastPurchaseAt + expiryMonths */
export function computeExpiryAt(lastPurchaseAt, expiryMonths) {
  return addMonths(lastPurchaseAt, expiryMonths);
}

/** هل تنطبق تصفية الانتهاء الكسول؟ (الآن > pointsExpireAt والرصيد موجب) */
export function isPointsExpired(member, now = new Date()) {
  if (!member) return false;
  const expireAt = toDateSafe(member.pointsExpireAt);
  if (!expireAt) return false;
  return now.getTime() > expireAt.getTime() && (Number(member.pointsBalance) || 0) > 0;
}

// ---------- نقاط الفئة والفئات ----------
/**
 * مجموع نقاط حركات earn خلال آخر windowMonths شهراً، مستبعداً الحركات المعكوسة.
 * الحركات المعكوسة تُشتق من حركات reverse عبر reversesTxId (سجل إضافي فقط —
 * لا يُعدَّل مستند الحركة الأصلية في مكانه).
 * الاستبدال (redeem) والانتهاء (expire) لا يؤثران على نقاط الفئة.
 */
export function tierPointsInWindow(transactions, windowMonths, now = new Date()) {
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
    sum += Number(t.points) || 0;
  }
  return sum;
}

/** إيجاد الفئة المطابقة لعدد النقاط من مصفوفة tiers ({key,name,min,max|null}) */
export function tierForPoints(points, tiers) {
  const p = Number(points) || 0;
  const list = Array.isArray(tiers) ? tiers : [];
  for (const t of list) {
    const min = Number(t.min) || 0;
    const max = t.max == null ? Infinity : Number(t.max);
    if (p >= min && p <= max) return t;
  }
  return null; // أقل من حد أول فئة (مثلاً 0 نقاط)
}

/** هل الترقية اليدوية سارية الآن؟ (بلا until = دائمة حتى الإلغاء) */
export function isManualTierActive(manualTier, now = new Date()) {
  if (!manualTier || !manualTier.tier) return false;
  const until = toDateSafe(manualTier.until);
  return !until || now.getTime() <= until.getTime();
}

/**
 * الفئة الفعلية للعضو: الترقية اليدوية السارية تتقدم على المحسوبة آلياً.
 * ترجع { tier: {key,name,...}|null, manual: boolean, tierPoints: number }
 */
export function effectiveTier(member, transactions, settings = {}, now = new Date()) {
  const tiers = settings.tiers || [];
  const tierPoints = tierPointsInWindow(transactions, settings.tierWindowMonths, now);
  const computed = tierForPoints(tierPoints, tiers);
  if (member && isManualTierActive(member.manualTier, now)) {
    const manual = tiers.find((t) => t.key === member.manualTier.tier);
    if (manual) return { tier: manual, manual: true, tierPoints };
  }
  return { tier: computed, manual: false, tierPoints };
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
