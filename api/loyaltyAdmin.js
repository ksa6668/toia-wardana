// api/loyaltyAdmin.js
// ----------------------------------------------------------
// عمليات الولاء الإدارية الحسّاسة عبر Firebase Admin SDK
// (المرحلة 5) — على نمط api/admin.js حرفياً:
//   • التحقق من ID token للمستدعي
//   • التأكد أن users/{uid}.role === "admin"
//
// الإجراءان:
//   anonymize          إخفاء الهوية: مسح name/phone/gender ووضع
//                      «عضو محذوف»، إبطال cardToken (البطاقة 404)،
//                      إبقاء الحركات والسجلات كاملة، وحركة audit
//   deleteWithArchive  حذف كامل مع أرشفة: نسخ العضوية وكل حركاتها
//                      إلى loyaltyDeletedArchive أولاً، وعند نجاح
//                      النسخ كاملاً فقط تُحذف الأصول. أي فشل في أي
//                      خطوة → توقف وإبلاغ بلا حذف جزئي.
//
// قيد إلزامي: مستندات loyaltyInvoices لا تُحذف إطلاقاً — معرّفاتها
// {store}_{invoiceNo} هي ضمان عدم إعادة استخدام أرقام الفواتير.
//
// السبب في المسار الخادمي: قواعد Firestore المنشورة فيها
// allow delete: if false (ولا تُفتح) — Admin SDK يتجاوزها بأمان هنا.
// نفس متغيرات البيئة القائمة — لا جديدة.
// ----------------------------------------------------------
/* global process */ // بيئة Node (دالة Vercel)
import admin from "firebase-admin";

// تهيئة كسولة داخل الـ handler (درس Batch 90.1 — فشل التهيئة يعود JSON واضحاً)
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

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const ANON_NAME = "عضو محذوف";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getAdminDb();

    // 1) تحقّق من توكن المستدعي (نمط api/admin.js حرفياً)
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return res.status(401).json({ error: "مطلوب تسجيل دخول" });

    const decoded = await admin.auth().verifyIdToken(token);
    const callerUid = decoded.uid;

    // 2) تأكد أن المستدعي مدير
    const callerDoc = await db.doc(`users/${callerUid}`).get();
    if (!callerDoc.exists || callerDoc.data().role !== "admin") {
      return res.status(403).json({ error: "صلاحيات غير كافية" });
    }
    const callerName = callerDoc.data().displayName || callerDoc.data().username || "";

    const { action, memberId, reason, confirmMemberNo } = req.body || {};
    if (!memberId) return res.status(400).json({ error: "مطلوب معرّف العضوية" });
    if (!String(reason || "").trim()) return res.status(400).json({ error: "السبب إلزامي" });

    const memberRef = db.doc(`loyaltyMembers/${memberId}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return res.status(404).json({ error: "العضوية غير موجودة" });
    const member = memberSnap.data();

    // ====== إخفاء الهوية ======
    if (action === "anonymize") {
      if (member.anonymized) {
        return res.status(400).json({ error: "الهوية مخفاة مسبقاً" });
      }
      const batch = db.batch();
      batch.update(memberRef, {
        name: ANON_NAME,
        phone: "",
        gender: admin.firestore.FieldValue.delete(),
        marketingConsent: false,
        source: member.source || "",
        // إبطال التوكن: الشرطة السفلية تُخرجه من نمط التوكن الصالح في
        // /api/card ‏(^[A-Za-z0-9]{22,64}$) → الرابط يعطي 404 مباشرة
        cardToken: `revoked_${memberId}`,
        anonymized: true,
        anonymizedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // حركة audit — سجل إضافي، القيمة 0 (مستثناة من كل الحسابات)
      const txRef = db.collection("loyaltyTransactions").doc();
      batch.set(txRef, {
        memberId,
        store: member.store,
        type: "audit",
        action: "anonymize",
        deltaHalalas: 0,
        balanceAfterHalalas: Number(member.balanceHalalas) || 0,
        oldValue: member.name || "",
        newValue: ANON_NAME,
        reason: String(reason).trim(),
        byUid: callerUid,
        byName: callerName,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return res.status(200).json({ ok: true });
    }

    // ====== حذف كامل مع أرشفة ======
    if (action === "deleteWithArchive") {
      // تأكيد مزدوج خادمي: رقم العضوية المكتوب يجب أن يطابق
      if (String(confirmMemberNo || "").trim().toUpperCase() !== String(member.memberNo || "").toUpperCase()) {
        return res.status(400).json({ error: "رقم العضوية المُدخل للتأكيد غير مطابق" });
      }

      // كل حركات العضو (تُنسخ ثم تُحذف — loyaltyInvoices لا تُمس إطلاقاً)
      const txsSnap = await db
        .collection("loyaltyTransactions")
        .where("memberId", "==", memberId)
        .get();

      const archiveRef = db.doc(`loyaltyDeletedArchive/${memberId}`);

      // — المرحلة أ: النسخ كاملاً أولاً. أي فشل هنا يوقف كل شيء بلا أي حذف —
      await archiveRef.set({
        member: { id: memberId, ...member },
        txCount: txsSnap.size,
        reason: String(reason).trim(),
        deletedBy: callerUid,
        deletedByName: callerName,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const txDocs = txsSnap.docs;
      for (let i = 0; i < txDocs.length; i += 400) {
        const batch = db.batch();
        for (const d of txDocs.slice(i, i + 400)) {
          batch.set(archiveRef.collection("transactions").doc(d.id), d.data());
        }
        await batch.commit(); // فشل أي دفعة → يُرمى الخطأ قبل أي حذف
      }

      // — المرحلة ب: الحذف بعد اكتمال النسخ فقط. مستند العضوية آخر ما يُحذف —
      for (let i = 0; i < txDocs.length; i += 400) {
        const batch = db.batch();
        for (const d of txDocs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
      await memberRef.delete();

      return res.status(200).json({ ok: true, archivedTx: txsSnap.size });
    }

    return res.status(400).json({ error: "إجراء غير معروف" });
  } catch (err) {
    console.error("Loyalty admin API error:", err?.errorInfo || err?.code || "", err);
    return res.status(500).json({ error: err?.message || "فشلت العملية" });
  }
}
