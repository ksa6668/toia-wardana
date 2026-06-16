// src/firebaseSettings.js
// ========================================================
// App Settings (§Batch 3 / S1) — الإعدادات العامة للتطبيق (مُستخرج من firebase.js)
// المسار: appSettings/main  →  { businessName, contactPhone, defaultLang, currency, dateSystem }
//
// نقل فقط — نفس المنطق حرفياً. db يأتي من firebase.js (نقطة التهيئة الوحيدة).
// لا استخدام لـ db على مستوى الوحدة (فقط داخل الدوال) ⇒ لا مشكلة دورة وقت التحميل.
// ========================================================
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * جلب الإعدادات العامة. لو ما فيه، يرجع defaults.
 */
export async function getAppSettings() {
  const ref = doc(db, "appSettings", "main");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return {
      businessName: "Toia & Wardana",
      contactPhone: "",
      defaultLang: "ar",
      currency: "SAR",
      dateSystem: "gregorian",
      notifInApp: true,
      notifSystem: false,
      exists: false,
    };
  }
  return { ...snap.data(), exists: true };
}

/**
 * حفظ الإعدادات العامة.
 */
export async function setAppSettings(data) {
  const ref = doc(db, "appSettings", "main");
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
