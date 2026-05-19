// src/firebase.js
// ----------------------------------------------------------
// إعداد Firebase + تسجيل دخول باسم مستخدم + رمز سري 4 أرقام
//
// كيف يعمل: المستخدم يكتب اسماً ورمزاً من 4 أرقام، والتطبيق
// يحوّلهما داخلياً إلى بريد وكلمة مرور صالحة لـ Firebase.
//   اسم المستخدم "toia" + رمز "1234"
//     → البريد:        toia@toia-wardana.app
//     → كلمة المرور:   1234__twpin   (لاحقة ثابتة لتجاوز حد 6 أحرف)
// المستخدم لا يرى البريد إطلاقاً.
// ----------------------------------------------------------
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

// 🔻 الصق هنا كائن firebaseConfig من Firebase Console
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

// ========== تحويل اسم المستخدم/الرمز ==========

const EMAIL_DOMAIN = "toia-wardana.app"; // نطاق وهمي داخلي فقط
const PIN_SUFFIX = "__twpin";            // لاحقة ثابتة لإطالة كلمة المرور

// يحوّل اسم المستخدم إلى بريد داخلي. ينظّف المسافات والحروف الكبيرة.
function usernameToEmail(username) {
  const clean = String(username).trim().toLowerCase().replace(/\s+/g, "");
  return `${clean}@${EMAIL_DOMAIN}`;
}

// يحوّل الرمز (4 أرقام) إلى كلمة مرور صالحة (6+ أحرف)
function pinToPassword(pin) {
  return `${String(pin).trim()}${PIN_SUFFIX}`;
}

// ========== المصادقة ==========

// تسجيل الدخول باسم مستخدم + رمز 4 أرقام
// يرجّع ملف المستخدم من مجموعة users (فيه role و branchId)
export async function login(username, pin) {
  if (!username || !pin) throw new Error("أدخل اسم المستخدم والرمز");
  if (!/^\d{4}$/.test(String(pin).trim())) {
    throw new Error("الرمز يجب أن يكون 4 أرقام");
  }
  const email = usernameToEmail(username);
  const password = pinToPassword(pin);

  const cred = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, "users", cred.user.uid));
  if (!userDoc.exists()) {
    throw new Error("لا يوجد ملف لهذا المستخدم في قاعدة البيانات");
  }
  return { uid: cred.user.uid, ...userDoc.data() };
}

export async function logout() {
  await signOut(auth);
}

// مراقبة حالة الدخول (تُستخدم عند فتح التطبيق)
export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) return callback(null);
    const userDoc = await getDoc(doc(db, "users", user.uid));
    callback(userDoc.exists() ? { uid: user.uid, ...userDoc.data() } : null);
  });
}

// ========== إنشاء مستخدم جديد (للمدير فقط) ==========
// يُستخدم من شاشة الإعدادات لإضافة موظف/مدير جديد.
// ينشئ حساب Auth + ملف users بنفس الـ UID.
export async function createStaffUser({ username, pin, role, branchId, displayName }) {
  if (!/^\d{4}$/.test(String(pin).trim())) {
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

// ========== كتابة البيانات ==========

// تسجيل مبيعات يومية (القسم 6 من المنطق)
export async function addDailySales({ date, branchId, cash, mada, transfer }) {
  const total = (Number(cash) || 0) + (Number(mada) || 0) + (Number(transfer) || 0);
  return addDoc(collection(db, "dailySales"), {
    date,
    branchId,
    cash: Number(cash) || 0,
    mada: Number(mada) || 0,
    transfer: Number(transfer) || 0,
    total,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });
}

// تصنيف نوع المصروف لأغراض التقارير (ورد/توصيل/تسويق/عام)
export function classifyExpense(categoryId) {
  if (categoryId === "ورد") return "flower";
  if (categoryId === "توصيل") return "delivery";
  if (categoryId === "تسويق") return "marketing";
  return "general";
}

// تسجيل مصروف متغير (القسم 7 من المنطق)
export async function addExpense({
  date,
  branchId,
  categoryId,
  amount,
  paymentMethodId,
  invoiceUrl = null,
  invoicePath = null,
}) {
  return addDoc(collection(db, "expenses"), {
    date,
    branchId,
    categoryId,
    expenseType: classifyExpense(categoryId),
    amount: Number(amount) || 0,
    paymentMethodId,
    invoiceUrl,
    invoicePath,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });
}

// ========== قراءة البيانات (للوحة المدير) ==========

// المبيعات بين تاريخين (date محفوظ كنص YYYY-MM-DD)
export async function getSales(fromDate, toDate) {
  const q = query(
    collection(db, "dailySales"),
    where("date", ">=", fromDate),
    where("date", "<=", toDate)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getExpenses(fromDate, toDate) {
  const q = query(
    collection(db, "expenses"),
    where("date", ">=", fromDate),
    where("date", "<=", toDate)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// المصاريف الثابتة لشهر معيّن، مثال month = "2026-05" (القسم 9 من المنطق)
export async function getFixedExpenses(month) {
  const q = query(collection(db, "fixedExpenses"), where("month", "==", month));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// حفظ المصروف الثابت الشهري لفرع (معرّف المستند = month_branchId)
export async function setFixedExpense({ month, branchId, amount }) {
  await setDoc(doc(db, "fixedExpenses", `${month}_${branchId}`), {
    month,
    branchId,
    amount: Number(amount) || 0,
    updatedAt: serverTimestamp(),
  });
}

// قائمة كل المستخدمين (للمدير — شاشة إدارة المستخدمين)
export async function getUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// ========== رفع صورة الفاتورة إلى R2 عبر /api/upload ==========
// يحوّل الملف إلى base64، يرسله للـ API مع توكن المستخدم،
// ويرجّع { invoiceUrl, invoicePath } لحفظهما مع المصروف.
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
