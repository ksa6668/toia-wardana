// src/firebaseAuth.js
// ====================================================================
// المصادقة + الجلسة (§S1 — المرحلة 10) — مُستخرجة من firebase.js (نقل فقط).
//
// تسجيل دخول باسم مستخدم + رمز 4 أرقام (يُحوَّل داخلياً إلى بريد/كلمة مرور).
//   اسم "toia" + رمز "1234" → toia@toia-wardana.app / 1234__twpin
// + ثبات الجلسة وخمول 30 يوم (markActive / isSessionExpired).
//
// التبعيات: auth/db من firebaseCore (الورقة)؛ clearUserNameCache من
// firebaseTelegram (يُستدعى وقت-تشغيل داخل logout فقط ⇒ لا دورة تحميل).
// ====================================================================
import {
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebaseCore";
import { clearUserNameCache } from "./firebaseTelegram";
import { toLatinDigits } from "./utils/digits";

// ========== Batch 56: ثبات الجلسة + خمول 30 يوم ==========
const LAST_ACTIVE_KEY = 'tw_last_active';
const INACTIVITY_LIMIT_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوم

// يجدّد ختم آخر نشاط (يُستدعى عند الدخول وفتح/استخدام التطبيق)
export function markActive() {
  try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch { /* ignore */ }
}

// هل تجاوزت الجلسة 30 يوم خمول؟ (لا سجل = ليست منتهية — أول استخدام/ترقية)
export function isSessionExpired() {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return false;
    const last = Number(raw);
    if (!last || Number.isNaN(last)) return false;
    return (Date.now() - last) > INACTIVITY_LIMIT_MS;
  } catch {
    return false;
  }
}

function clearLastActive() {
  try { localStorage.removeItem(LAST_ACTIVE_KEY); } catch { /* ignore */ }
}

// ========== تحويل اسم المستخدم/الرمز ==========

const EMAIL_DOMAIN = "toia-wardana.app"; // نطاق وهمي داخلي فقط
const PIN_SUFFIX = "__twpin";            // لاحقة ثابتة لإطالة كلمة المرور

// يحوّل اسم المستخدم إلى بريد داخلي. ينظّف المسافات والحروف الكبيرة.
function usernameToEmail(username) {
  const clean = String(username).trim().toLowerCase().replace(/\s+/g, "");
  return `${clean}@${EMAIL_DOMAIN}`;
}

// يحوّل الرمز (4 أرقام) إلى كلمة مرور صالحة (6+ أحرف)
// S1: مُصدّرة ليستخدمها firebaseUsers.js (changeMyPin) — نفس المنطق.
// Batch 94: حصانة دفاعية — توحيد الأرقام الهندية/الفارسية قبل البناء،
// حتى لو وصل الرمز من مسار لم يُوحَّد عند الكتابة.
export function pinToPassword(pin) {
  return `${toLatinDigits(String(pin)).trim()}${PIN_SUFFIX}`;
}

// ========== المصادقة ==========

// تسجيل الدخول باسم مستخدم + رمز 4 أرقام
// يرجّع ملف المستخدم من مجموعة users (فيه role و branchId)
export async function login(username, pin) {
  if (!username || !pin) throw new Error("أدخل اسم المستخدم والرمز");
  // Batch 94: \d تطابق ASCII فقط — نوحّد الأرقام الهندية أولاً كي لا يُرفض رمز صحيح
  if (!/^\d{4}$/.test(toLatinDigits(String(pin)).trim())) {
    throw new Error("الرمز يجب أن يكون 4 أرقام");
  }
  const email = usernameToEmail(username);
  const password = pinToPassword(pin);

  // Batch 56: نضمن ثبات الجلسة قبل الدخول
  try { await setPersistence(auth, browserLocalPersistence); } catch { /* fallback */ }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, "users", cred.user.uid));
  if (!userDoc.exists()) {
    throw new Error("لا يوجد ملف لهذا المستخدم في قاعدة البيانات");
  }
  const data = userDoc.data();
  if (data.active === false) {
    await signOut(auth);
    throw new Error("هذا الحساب معطّل. تواصل مع المدير.");
  }
  markActive(); // Batch 56: بدء عدّاد الخمول
  return { uid: cred.user.uid, ...data };
}

export async function logout() {
  // Batch 40: مسح cache اسم المستخدم (إن وُجد)
  try { clearUserNameCache(); } catch { /* ignore */ }
  clearLastActive(); // Batch 56: إنهاء عدّاد الخمول
  await signOut(auth);
}

// مراقبة حالة الدخول (تُستخدم عند فتح التطبيق)
export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) { clearLastActive(); return callback(null); }
    // Batch 56: خروج تلقائي بعد 30 يوم خمول
    if (isSessionExpired()) {
      try { await signOut(auth); } catch { /* ignore */ }
      clearLastActive();
      return callback(null);
    }
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (!userDoc.exists()) return callback(null);
    markActive(); // جلسة مستعادة وصالحة → جدّد ختم النشاط
    callback({ uid: user.uid, ...userDoc.data() });
  });
}

// ========== إنشاء مستخدم جديد (للمدير فقط) ==========
// يُستخدم من شاشة الإعدادات لإضافة موظف/مدير جديد.
// ينشئ حساب Auth + ملف users بنفس الـ UID.
export async function createStaffUser({ username, pin, role, branchId, displayName }) {
  // Batch 94: توحيد الأرقام الهندية قبل التحقق (كما في login)
  if (!/^\d{4}$/.test(toLatinDigits(String(pin)).trim())) {
    throw new Error("الرمز يجب أن يكون 4 أرقام");
  }
  const email = usernameToEmail(username);
  const password = pinToPassword(pin);

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    username: String(username).trim().toLowerCase(),
    displayName: displayName || username,
    role,          // "admin" أو "employee"
    branchId,      // "toia" أو "wardana"
    active: true,
    createdAt: serverTimestamp(),
  });
  return cred.user.uid;
}
