// src/firebaseCore.js
// ====================================================================
// تهيئة Firebase الأساسية (§S1 — المرحلة 10) — مُستخرجة من firebase.js.
//
// هذا ملف "ورقة" (leaf): لا يستورد أي وحدة firebase* أخرى ⇒ لا دورة وقت تحميل.
// كل الوحدات الأخرى تستورد db/auth من هنا (المصدر الوحيد للتهيئة).
//
// firebaseConfig عام بالتصميم (مفاتيح العميل ليست أسراراً).
// ====================================================================
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔻 كائن firebaseConfig من Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCsNvbrQ_eIGPnU_dR8LJ8Z0w0f1Fp9VuQ",
  authDomain: "toia-wardana.firebaseapp.com",
  projectId: "toia-wardana",
  storageBucket: "toia-wardana.firebasestorage.app",
  messagingSenderId: "382308751925",
  appId: "1:382308751925:web:d340344a5dd7de83782f7c",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ========== Batch 56: ثبات الجلسة + خمول 30 يوم ==========
// نثبّت الجلسة محلياً → عند فتح التطبيق يدخل مباشرة بدون طلب الاسم/الرمز.
// نطبّق خروجاً تلقائياً فقط بعد 30 يوماً من عدم الاستخدام (في firebaseAuth).
setPersistence(auth, browserLocalPersistence).catch(() => { /* fallback للافتراضي */ });
