// api/card.js
// ----------------------------------------------------------
// البطاقة العامة لبرنامج الولاء — GET /api/card?token={cardToken}
//
// العميل يفتح /c/{token} بلا تسجيل دخول، وقواعد Firestore تشترط
// المصادقة لقراءة loyaltyMembers — لذلك القراءة هنا عبر Firebase
// Admin SDK فقط (نفس نمط api/admin.js ونفس متغيرات البيئة —
// لا متغيرات جديدة).
//
// الاستجابة تُبنى بـ buildCardPayload من src/loyaltyShare.js
// (قائمة حقول بيضاء صريحة): لا memberId، لا cardToken، لا جوال
// كامل، لا سجلات ولا أرقام فواتير ولا حقول إدارية.
//
// توكن غير موجود أو عضوية معطّلة → 404 موحّد بنص عربي محايد
// (بلا تمييز بين الحالتين — لا تسريب معلومات).
//
// rate limit بسيط لكل IP في ذاكرة الدالة — أفضل جهد لكل
// instance من serverless (يكفي لإبطاء المسح الآلي).
// ----------------------------------------------------------
/* global process */ // بيئة Node (دالة Vercel) — إعداد ESLint العام للمتصفح
import admin from "firebase-admin";
import { buildCardPayload } from "../src/loyaltyShare.js";

// ---------- تهيئة Admin SDK — كسولة (داخل الـ handler، ليست في نطاق الوحدة) ----------
// نفس نمط api/admin.js حرفياً (بما فيه معالجة privateKey وحارس admin.apps.length).
// السبب في الكسل: فشل التهيئة في نطاق الوحدة يقتل العملية قبل تشغيل أي كود،
// فيصل للعميل 500 عام بلا رسالة — هنا يُلتقط داخل try/catch الـ handler
// ويعيد JSON واضحاً مع تسجيل الخطأ كاملاً في Logs.
function getAdminDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return admin.firestore();
}

// عند فشل تحليل المفتاح: تشخيص آمن في Logs (طول وشكل القيمة فقط — لا محتواها)
function logKeyDiagnostics() {
  const k = process.env.FIREBASE_PRIVATE_KEY || "";
  console.error("FIREBASE_PRIVATE_KEY diagnostics:", {
    present: !!k,
    length: k.length,
    hasLiteralBackslashN: k.includes("\\n"),
    hasRealNewlines: k.includes("\n"),
    startsWithQuote: k.startsWith('"') || k.startsWith("'"),
    startsWithBegin: k.replace(/^["']/, "").startsWith("-----BEGIN"),
  });
}

// ---------- rate limit في الذاكرة: 30 طلباً / دقيقة / IP ----------
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;
const rateMap = new Map(); // ip → { count, windowStart }

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  if (rateMap.size > 5000) rateMap.clear(); // حارس ذاكرة بسيط
  return entry.count > RATE_LIMIT;
}

const NOT_FOUND_MSG = "البطاقة غير متوفرة"; // رسالة محايدة موحّدة

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  // بيانات شخصية — لا caching على أي وسيط
  res.setHeader("Cache-Control", "no-store");

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "طلبات كثيرة — حاول بعد قليل" });
  }

  // توكن البطاقة: ≥22 حرفاً من أبجدية آمنة — أي شكل آخر يرفض مبكراً
  const token = String(req.query?.token || "").trim();
  if (!/^[A-Za-z0-9]{22,64}$/.test(token)) {
    return res.status(404).json({ error: NOT_FOUND_MSG });
  }

  try {
    // التهيئة الكسولة داخل الـ try — فشلها يعود 500 بجسم JSON واضح بدل موت العملية
    const db = getAdminDb();

    // 1) العضو بالتوكن (فهرس أحادي تلقائي)
    const memberSnap = await db
      .collection("loyaltyMembers")
      .where("cardToken", "==", token)
      .limit(1)
      .get();
    if (memberSnap.empty) {
      return res.status(404).json({ error: NOT_FOUND_MSG });
    }
    const memberDoc = memberSnap.docs[0];
    const member = memberDoc.data();
    // عضوية معطّلة → نفس 404 المحايد تماماً
    if (member.status === "disabled") {
      return res.status(404).json({ error: NOT_FOUND_MSG });
    }

    // 2) الحركات (لحساب الفئة) + الإعدادات
    const [txsSnap, settingsSnap] = await Promise.all([
      db.collection("loyaltyTransactions").where("memberId", "==", memberDoc.id).get(),
      db.collection("loyaltySettings").doc(member.store).get(),
    ]);
    const transactions = txsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const settings = settingsSnap.exists ? settingsSnap.data() : null;

    // 3) الاستجابة بالقائمة البيضاء فقط (loyaltyShare — نفس مصدر الحقيقة)
    const payload = buildCardPayload(member, transactions, settings);

    // 4) عدّاد فتح الرابط — كتابة من Admin SDK فقط، وفشلها لا يمنع العرض
    memberDoc.ref
      .update({
        cardViews: admin.firestore.FieldValue.increment(1),
        lastCardViewAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      .catch(() => { /* عدّاد فقط — لا يؤثر على الاستجابة */ });

    return res.status(200).json(payload);
  } catch (err) {
    // الخطأ كاملاً في Logs (رسالة + stack + كود Firebase إن وجد)
    console.error("Card API error:", err?.errorInfo || err?.code || "", err);
    if (/private key/i.test(err?.message || "")) logKeyDiagnostics();
    return res.status(500).json({
      error: "تعذّر تحميل البطاقة — خطأ في الخادم، حاول لاحقاً",
      code: "server-error",
    });
  }
}
