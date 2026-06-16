// src/firebaseStorage.js
// ====================================================================
// رفع صورة الفاتورة إلى R2 عبر /api/upload (§S1 — المرحلة 10) — نقل فقط.
// يحوّل الملف إلى base64، يرسله للـ API مع توكن المستخدم،
// ويرجّع { invoiceUrl, invoicePath } لحفظهما مع المصروف.
//
// التبعية: auth من firebaseCore (للحصول على ID token) — وقت-تشغيل فقط.
// ====================================================================
import { auth } from "./firebaseCore";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export async function uploadInvoiceImage(file) {
  if (!auth.currentUser) throw new Error("مطلوب تسجيل دخول");
  if (!file) throw new Error("لا يوجد ملف");

  const token = await auth.currentUser.getIdToken();
  const fileBase64 = await fileToBase64(file);

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      fileBase64,
      fileName: file.name,
      contentType: file.type || "image/jpeg",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "فشل رفع الصورة");
  }
  return res.json(); // { invoiceUrl, invoicePath }
}
