// src/firebaseUsers.js
// ========================================================
// إدارة المستخدمين (§S1) — مُستخرج من firebase.js (نقل فقط، نفس المنطق).
// يشمل: getUsers, saveUserLanguage, changeMyPin, setUserActive,
//        adminUpdateUserProfile, adminChangeUserPin, adminDeleteUser
//
// db/auth/pinToPassword تأتي من firebase.js (نقطة التهيئة الوحيدة)؛
// تُستخدم داخل أجسام الدوال فقط ⇒ لا مشكلة دورة وقت التحميل.
// ========================================================
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth, db, pinToPassword } from "./firebase";

// قائمة كل المستخدمين (للمدير — شاشة إدارة المستخدمين)
export async function getUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ========== تفضيل اللغة للموظف (طلب اللغتين) ==========
// language: "ar" | "en"
export async function saveUserLanguage(uid, language) {
  if (!uid || !['ar', 'en'].includes(language)) return;
  await updateDoc(doc(db, "users", uid), { language });
}

// تغيير رمز المستخدم الحالي (لنفسه) — يحتاج الرمز الحالي
export async function changeMyPin(currentPin, newPin) {
  if (!auth.currentUser) throw new Error("مطلوب تسجيل دخول");
  if (!/^\d{4}$/.test(String(currentPin || "").trim())) {
    throw new Error("الرمز الحالي يجب أن يكون 4 أرقام");
  }
  if (!/^\d{4}$/.test(String(newPin || "").trim())) {
    throw new Error("الرمز الجديد يجب أن يكون 4 أرقام");
  }
  // إعادة مصادقة بالرمز الحالي
  const credOld = EmailAuthProvider.credential(
    auth.currentUser.email,
    pinToPassword(currentPin)
  );
  await reauthenticateWithCredential(auth.currentUser, credOld);
  await updatePassword(auth.currentUser, pinToPassword(newPin));
}

// تعطيل/تفعيل مستخدم (soft) — لا يحذف من Auth، يضع active=false
export async function setUserActive(uid, active) {
  await updateDoc(doc(db, "users", uid), { active: !!active });
}

// تحديث ملف مستخدم (الاسم/الدور/الفرع) — لا يلمس Auth، فقط Firestore.
// كلمة المرور تحدّث عبر adminChangeUserPin منفصلاً.
export async function adminUpdateUserProfile(uid, { displayName, role, branchId } = {}) {
  const patch = {};
  if (typeof displayName === 'string') patch.displayName = displayName.trim();
  if (role === 'admin' || role === 'employee') patch.role = role;
  if (typeof branchId === 'string') patch.branchId = branchId; // 'toia' | 'wardana' | 'all'
  if (Object.keys(patch).length === 0) return;
  await updateDoc(doc(db, "users", uid), patch);
}

// طلب من Admin API: تغيير رمز مستخدم آخر (للمدير فقط)
export async function adminChangeUserPin(targetUid, newPin) {
  if (!auth.currentUser) throw new Error("مطلوب تسجيل دخول");
  const token = await auth.currentUser.getIdToken();
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: "changePassword", targetUid, newPin }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "تعذّر تغيير الرمز");
  }
  return res.json();
}

// حذف نهائي لمستخدم (Auth + Firestore) — للمدير فقط
export async function adminDeleteUser(targetUid) {
  if (!auth.currentUser) throw new Error("مطلوب تسجيل دخول");
  const token = await auth.currentUser.getIdToken();
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: "deleteUser", targetUid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "تعذّر الحذف");
  }
  return res.json();
}
