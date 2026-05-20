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
  updateDoc,
  deleteDoc,
  orderBy,
  writeBatch,
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

// تصنيف نوع المصروف لأغراض التقارير (للتوافق الخلفي مع البيانات القديمة)
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
  categoryName,
  expenseType,
  amount,
  paymentMethodId,
  invoiceUrl = null,
  invoicePath = null,
}) {
  return addDoc(collection(db, "expenses"), {
    date,
    branchId,
    categoryId,
    categoryName: categoryName || categoryId,
    expenseType: expenseType || classifyExpense(categoryName || categoryId),
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

// ========== تصنيفات المصاريف (قابلة للإدارة من المدير) ==========

// التصنيفات الافتراضية — تُزرع تلقائياً أول مرة
const DEFAULT_CATEGORIES = [
  { id: "flower", name: "ورد", requiresImage: true, expenseType: "flower", order: 1 },
  { id: "customer_orders", name: "طلبات العملاء", requiresImage: true, expenseType: "general", order: 2 },
  { id: "supplies", name: "مستلزمات وبضائع", requiresImage: true, expenseType: "general", order: 3 },
  { id: "delivery", name: "توصيل", requiresImage: false, expenseType: "delivery", order: 4 },
  { id: "marketing", name: "تسويق", requiresImage: false, expenseType: "marketing", order: 5 },
  { id: "electricity", name: "كهرباء", requiresImage: false, expenseType: "general", order: 6 },
  { id: "internet", name: "إنترنت", requiresImage: false, expenseType: "general", order: 7 },
  { id: "services", name: "خدمات", requiresImage: false, expenseType: "general", order: 8 },
  { id: "maintenance", name: "صيانة", requiresImage: false, expenseType: "general", order: 9 },
  { id: "other", name: "أخرى", requiresImage: false, expenseType: "general", order: 10 },
];

// جلب كل التصنيفات النشطة، مرتبة. يزرع الافتراضي إذا لم توجد تصنيفات.
export async function getCategories() {
  const snap = await getDocs(collection(db, "categories"));
  if (snap.empty) {
    // أول تشغيل — ازرع الافتراضي (يتطلب صلاحية مدير حسب قواعد الأمان)
    try {
      const batch = writeBatch(db);
      for (const c of DEFAULT_CATEGORIES) {
        batch.set(doc(db, "categories", c.id), {
          name: c.name,
          requiresImage: c.requiresImage,
          expenseType: c.expenseType,
          order: c.order,
          active: true,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      // لو الزرع فشل (موظف بدون صلاحية)، ارجع الافتراضي محلياً
      return DEFAULT_CATEGORIES.map((c) => ({ ...c, active: true }));
    }
    return DEFAULT_CATEGORIES.map((c) => ({ ...c, active: true }));
  }
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.active !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// تبديل خاصية "يتطلب صورة" لتصنيف
export async function setCategoryRequiresImage(id, requiresImage) {
  await updateDoc(doc(db, "categories", id), { requiresImage: !!requiresImage });
}

// إضافة تصنيف جديد
export async function addCategory({ name, requiresImage = false, expenseType = "general" }) {
  if (!name?.trim()) throw new Error("اسم التصنيف مطلوب");
  // معرّف بسيط من الاسم + رقم وقت لتجنب التكرار
  const cleanId = String(name).trim().toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
  // احسب الترتيب التالي
  const snap = await getDocs(collection(db, "categories"));
  const maxOrder = snap.docs.reduce((m, d) => Math.max(m, d.data().order || 0), 0);
  await setDoc(doc(db, "categories", cleanId), {
    name: name.trim(),
    requiresImage: !!requiresImage,
    expenseType,
    order: maxOrder + 1,
    active: true,
    createdAt: serverTimestamp(),
  });
  return cleanId;
}

// حذف تصنيف (نخفيه بدل حذف نهائي، حتى لا تتأثر سجلات قديمة)
export async function deleteCategory(id) {
  await updateDoc(doc(db, "categories", id), { active: false });
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
