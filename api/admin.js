// api/admin.js
// ----------------------------------------------------------
// عمليات إدارية حسّاسة عبر Firebase Admin SDK
// - تغيير كلمة مرور أي مستخدم
// - حذف نهائي (Auth + Firestore)
//
// التحقق: فقط المدير (role === "admin" في users) يمكنه استدعاء هذه العمليات
//
// متغيرات البيئة الجديدة في Vercel:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY    (نسخ كاملة مع \n حرفياً)
//
// المكتبة:
//   npm install firebase-admin
// ----------------------------------------------------------
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

// لاحقة كلمة المرور المستخدمة في firebase.js — لازم تطابق
const PIN_SUFFIX = "__twpin";
function pinToPassword(pin) {
  return `${String(pin).trim()}${PIN_SUFFIX}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) تحقّق من توكن المستدعي
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return res.status(401).json({ error: "مطلوب تسجيل دخول" });

    const decoded = await admin.auth().verifyIdToken(token);
    const callerUid = decoded.uid;

    // 2) تأكد أن المستدعي مدير
    const callerDoc = await admin.firestore().doc(`users/${callerUid}`).get();
    if (!callerDoc.exists || callerDoc.data().role !== "admin") {
      return res.status(403).json({ error: "صلاحيات غير كافية" });
    }

    const { action, targetUid, newPin } = req.body || {};

    // ====== تغيير كلمة المرور ======
    if (action === "changePassword") {
      if (!targetUid) return res.status(400).json({ error: "مطلوب معرّف المستخدم" });
      if (!/^\d{4}$/.test(String(newPin || "").trim())) {
        return res.status(400).json({ error: "الرمز يجب أن يكون 4 أرقام" });
      }
      await admin.auth().updateUser(targetUid, {
        password: pinToPassword(newPin),
      });
      return res.status(200).json({ ok: true });
    }

    // ====== حذف نهائي ======
    if (action === "deleteUser") {
      if (!targetUid) return res.status(400).json({ error: "مطلوب معرّف المستخدم" });
      if (targetUid === callerUid) {
        return res.status(400).json({ error: "لا يمكنك حذف نفسك" });
      }
      // احذف من Firestore أولاً ثم من Auth
      await admin.firestore().doc(`users/${targetUid}`).delete().catch(() => {});
      await admin.auth().deleteUser(targetUid);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "إجراء غير معروف" });
  } catch (err) {
    console.error("Admin API error:", err);
    const msg = err?.message || "فشلت العملية";
    return res.status(500).json({ error: msg });
  }
}
