// api/upload.js
// ----------------------------------------------------------
// رفع آمن لصور الفواتير إلى Cloudflare R2 عبر دالة Vercel
//
// التحقق من المستخدم: عبر Firebase REST API (بدون مكتبة admin)
// مفاتيح R2 السرّية تظل على السيرفر، لا تظهر في المتصفح
//
// متغيرات البيئة المطلوبة في Vercel:
//   R2_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET           (مثل: toia-invoices)
//   R2_PUBLIC_URL       (مثل: https://pub-xxxxx.r2.dev)
//   FIREBASE_API_KEY    (نفس apiKey في firebase.js)
//
// المكتبة المطلوبة:
//   npm install @aws-sdk/client-s3
// ----------------------------------------------------------
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) التحقق من توكن Firebase المرسَل من العميل
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return res.status(401).json({ error: "مطلوب تسجيل دخول" });

    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!verifyRes.ok) return res.status(401).json({ error: "توكن غير صالح" });
    const verifyData = await verifyRes.json();
    if (!verifyData.users || verifyData.users.length === 0) {
      return res.status(401).json({ error: "مستخدم غير معروف" });
    }

    // 2) استقبال الصورة (base64) واسمها
    const { fileBase64, fileName, contentType } = req.body || {};
    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: "ملف غير صالح" });
    }

    // نظّف base64 (يقبل صيغة dataURL أو base64 صافي)
    const base64Data = fileBase64.includes(",")
      ? fileBase64.split(",").pop()
      : fileBase64;
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > 7 * 1024 * 1024) {
      return res.status(413).json({ error: "حجم الصورة أكبر من 7 ميجا" });
    }

    // 3) مسار فريد داخل R2
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `invoices/${Date.now()}-${safeName}`;

    // 4) الرفع إلى R2
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType || "image/jpeg",
      })
    );

    // 5) رد بالرابط والمسار ليُحفظ في expenses
    return res.status(200).json({
      invoiceUrl: `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`,
      invoicePath: key,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "فشل رفع الصورة" });
  }
}
