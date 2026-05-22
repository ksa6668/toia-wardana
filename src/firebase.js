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
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
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
  const data = userDoc.data();
  if (data.active === false) {
    await signOut(auth);
    throw new Error("هذا الحساب معطّل. تواصل مع المدير.");
  }
  return { uid: cred.user.uid, ...data };
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

// ========== حسبة رسوم مدى (طلب المالك) ==========
// كل 10 ريال => 0.80 هلله رسوم + 15% ضريبة على الرسوم = 0.92 هلله
// نسبة الرسوم الإجمالية على المبلغ = 0.092 / 10 = 0.92%
export const MADA_FEE_RATE = 0.0092;
export function madaFees(grossMada) {
  const g = Number(grossMada) || 0;
  return +(g * MADA_FEE_RATE).toFixed(2);
}
export function madaNet(grossMada) {
  const g = Number(grossMada) || 0;
  return +(g * (1 - MADA_FEE_RATE)).toFixed(2);
}

// تسجيل مبيعات يومية (القسم 6 من المنطق)
// ملاحظة: المبلغ المدخل لـ mada هو الإجمالي قبل الرسوم.
// نحفظ كذلك madaFees و madaNet لأغراض التقارير.
export async function addDailySales({ date, branchId, cash, mada, transfer }) {
  const cashN = Number(cash) || 0;
  const madaN = Number(mada) || 0;
  const transferN = Number(transfer) || 0;
  const total = cashN + madaN + transferN;
  const madaFeesAmt = +(madaN * MADA_FEE_RATE).toFixed(2);
  const madaNetAmt = +(madaN - madaFeesAmt).toFixed(2);
  const netTotal = +(cashN + madaNetAmt + transferN).toFixed(2);

  return addDoc(collection(db, "dailySales"), {
    date,
    branchId,
    cash: cashN,
    mada: madaN,
    madaFees: madaFeesAmt,
    madaNet: madaNetAmt,
    transfer: transferN,
    total,        // الإجمالي قبل خصم رسوم مدى
    netTotal,     // الإجمالي بعد خصم رسوم مدى
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
  notes = null,
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
    notes,
    invoiceUrl,
    invoicePath,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });
}

// ========== Batch 12: تعديل/حذف المبيعات والمصاريف (للمدير فقط) ==========
// التحقق من صلاحيات المدير يتم على مستوى الـ UI + Firestore Security Rules.

// تحديث مبيعة يومية — يعيد حساب total/madaFees/madaNet/netTotal تلقائياً
export async function updateDailySales(id, { date, branchId, cash, mada, transfer }) {
  const cashN = Number(cash) || 0;
  const madaN = Number(mada) || 0;
  const transferN = Number(transfer) || 0;
  const total = cashN + madaN + transferN;
  const madaFeesAmt = +(madaN * MADA_FEE_RATE).toFixed(2);
  const madaNetAmt = +(madaN - madaFeesAmt).toFixed(2);
  const netTotal = +(cashN + madaNetAmt + transferN).toFixed(2);

  return updateDoc(doc(db, "dailySales", id), {
    date,
    branchId,
    cash: cashN,
    mada: madaN,
    madaFees: madaFeesAmt,
    madaNet: madaNetAmt,
    transfer: transferN,
    total,
    netTotal,
    updatedBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDailySales(id) {
  return deleteDoc(doc(db, "dailySales", id));
}

export async function updateExpense(id, {
  date,
  branchId,
  categoryId,
  categoryName,
  expenseType,
  amount,
  paymentMethodId,
  notes = null,
  invoiceUrl,
  invoicePath,
}) {
  const payload = {
    date,
    branchId,
    categoryId,
    categoryName: categoryName || categoryId,
    expenseType: expenseType || classifyExpense(categoryName || categoryId),
    amount: Number(amount) || 0,
    paymentMethodId,
    notes,
    updatedBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
  };
  if (invoiceUrl !== undefined) payload.invoiceUrl = invoiceUrl;
  if (invoicePath !== undefined) payload.invoicePath = invoicePath;
  return updateDoc(doc(db, "expenses", id), payload);
}

export async function deleteExpense(id) {
  return deleteDoc(doc(db, "expenses", id));
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

// ========== الفروع (§12 من المنطق) ==========

const DEFAULT_BRANCHES = [
  { id: "toia", name: "تويا", active: true, order: 1 },
  { id: "wardana", name: "وردانة", active: true, order: 2 },
];

// جلب الفروع النشطة، مرتبة، مع زرع افتراضي عند أول تشغيل
export async function getBranches() {
  const snap = await getDocs(collection(db, "branches"));
  if (snap.empty) {
    try {
      const batch = writeBatch(db);
      for (const b of DEFAULT_BRANCHES) {
        batch.set(doc(db, "branches", b.id), {
          name: b.name,
          active: b.active,
          order: b.order,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch {
      return DEFAULT_BRANCHES;
    }
    return DEFAULT_BRANCHES;
  }
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// تحديث اسم فرع أو حالته
export async function updateBranch(id, data) {
  await updateDoc(doc(db, "branches", id), data);
}

// ========== طرق الدفع (§12 من المنطق) ==========

const DEFAULT_PAYMENT_METHODS = [
  { id: "Cash", name: "Cash", labelAr: "نقدي (كاش)", active: true, order: 1 },
  { id: "Mada", name: "Mada", labelAr: "مدى (شبكة)", active: true, order: 2 },
  { id: "Transfer", name: "Transfer", labelAr: "تحويل (أون لاين)", isOnline: true, active: true, order: 3 },
];

export async function getPaymentMethods() {
  const snap = await getDocs(collection(db, "paymentMethods"));
  if (snap.empty) {
    try {
      const batch = writeBatch(db);
      for (const p of DEFAULT_PAYMENT_METHODS) {
        batch.set(doc(db, "paymentMethods", p.id), {
          name: p.name,
          labelAr: p.labelAr,
          isOnline: !!p.isOnline,
          active: p.active,
          order: p.order,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch {
      return DEFAULT_PAYMENT_METHODS;
    }
    return DEFAULT_PAYMENT_METHODS;
  }
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.active !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// ========== تصنيفات المصاريف (قابلة للإدارة من المدير) ==========

// التصنيفات الافتراضية — تُزرع تلقائياً أول مرة
// Batch 11: الترتيب الجديد ورد → توصيل → طلبات → مستلزمات (التصنيفات الأربعة الأساسية)
const DEFAULT_CATEGORIES = [
  { id: "flower", name: "ورد", requiresImage: true, expenseType: "flower", order: 1 },
  { id: "delivery", name: "توصيل", requiresImage: false, expenseType: "delivery", order: 2 },
  { id: "customer_orders", name: "طلبات العملاء", requiresImage: true, expenseType: "customerOrders", order: 3 },
  { id: "supplies", name: "مستلزمات وبضائع", requiresImage: true, expenseType: "supplies", order: 4 },
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

// Batch 11: تحديث ترتيب تصنيف واحد
export async function setCategoryOrder(id, order) {
  await updateDoc(doc(db, "categories", id), { order: Number(order) || 0 });
}

// Batch 11: إعادة ترتيب مجموعة تصنيفات دفعة واحدة (atomic)
// orderedIds: مصفوفة معرّفات بالترتيب الجديد (الفهرس 0 = الأول)
export async function reorderCategories(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  const batch = writeBatch(db);
  orderedIds.forEach((id, idx) => {
    batch.update(doc(db, "categories", id), { order: idx + 1 });
  });
  await batch.commit();
}

// ========== إدارة المستخدمين (الرموز والتعطيل) ==========

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

// ========================================================
// Goals (§Batch 3) — أهداف الميزانية والتقييمات الشهرية لكل فرع
// المسار في Firestore:
//   goals/{branchId}_{YYYY-MM}  →  { budget, reviewsTarget, updatedAt }
// مثال:
//   goals/toia_2026-05  →  { budget: 45000, reviewsTarget: 30 }
// ========================================================

/**
 * يجلب هدف فرع لشهر معين. لو الـ doc غير موجود يرجع defaults.
 */
export async function getMonthlyGoal(branchId, monthStr) {
  const goalId = `${branchId}_${monthStr}`;
  const ref = doc(db, "goals", goalId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { budget: 0, reviewsTarget: 0, exists: false };
  }
  return { ...snap.data(), exists: true };
}

/**
 * يحفظ هدف فرع لشهر معين. الـ data: { budget, reviewsTarget }
 */
export async function setMonthlyGoal(branchId, monthStr, data) {
  const goalId = `${branchId}_${monthStr}`;
  const ref = doc(db, "goals", goalId);
  await setDoc(
    ref,
    {
      budget: Number(data.budget) || 0,
      reviewsTarget: Number(data.reviewsTarget) || 0,
      branchId,
      month: monthStr,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * يجلب أهداف كل الفروع لشهر معين دفعة واحدة (أكفأ من استدعاءات متعددة).
 * يستخدمه ManagerHome لعرض KPIs.
 */
export async function getAllGoalsForMonth(monthStr) {
  const branches = await getBranches();
  const promises = branches.map((b) =>
    getMonthlyGoal(b.id, monthStr).then((g) => ({ branchId: b.id, ...g }))
  );
  return Promise.all(promises);
}

// ========================================================
// Branches CRUD الكاملة (§Batch 3)
// addBranch و deleteBranch — getBranches و updateBranch موجودان أعلاه
// ========================================================

/**
 * إضافة فرع جديد. الـ id يُولّد من الاسم بالإنجليزية slug.
 */
export async function addBranch({ name, nameEn, order }) {
  if (!name || !name.trim()) throw new Error("اسم الفرع مطلوب");
  // ولّد ID من الاسم الإنجليزي إن وُجد، وإلا من timestamp
  let id = (nameEn || name).toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!id) id = `branch_${Date.now()}`;
  // تأكد عدم التكرار
  const existing = await getDoc(doc(db, "branches", id));
  if (existing.exists()) {
    id = `${id}_${Date.now()}`;
  }
  await setDoc(doc(db, "branches", id), {
    name: name.trim(),
    nameEn: (nameEn || "").trim() || null,
    active: true,
    order: Number(order) || 99,
    createdAt: serverTimestamp(),
  });
  return id;
}

/**
 * حذف فرع. ⚠️ يُعطّل (active=false) بدل الحذف الفعلي
 * للحفاظ على تكامل البيانات التاريخية.
 */
export async function deleteBranch(id) {
  await updateDoc(doc(db, "branches", id), { active: false });
}

// ========================================================
// App Settings (§Batch 3) — الإعدادات العامة للتطبيق
// المسار: appSettings/main  →  { businessName, contactPhone, defaultLang, currency, dateSystem }
// ========================================================

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

// ========================================================
// Backup helpers (§Batch 3)
// تصدير كل البيانات في JSON واحد (sales + expenses + users + branches + categories + goals + fixedExpenses)
// ========================================================

/**
 * يجلب كل البيانات لعمل نسخة احتياطية.
 * يستخدمه ManagerBackup.jsx لتصدير JSON/Excel.
 */
export async function getAllDataForBackup() {
  const [salesSnap, expensesSnap, usersSnap, branchesSnap, categoriesSnap, goalsSnap, fixedSnap] = await Promise.all([
    getDocs(collection(db, "dailySales")),
    getDocs(collection(db, "expenses")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "branches")),
    getDocs(collection(db, "categories")),
    getDocs(collection(db, "goals")),
    getDocs(collection(db, "fixedExpenses")),
  ]);
  const toArr = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    sales: toArr(salesSnap),
    expenses: toArr(expensesSnap),
    users: toArr(usersSnap),
    branches: toArr(branchesSnap),
    categories: toArr(categoriesSnap),
    goals: toArr(goalsSnap),
    fixedExpenses: toArr(fixedSnap),
  };
}

/**
 * يجلب إحصائيات سريعة لعرضها في شاشة Backup.
 */
export async function getDataStats() {
  const data = await getAllDataForBackup();
  return {
    sales: data.sales.length,
    expenses: data.expenses.length,
    branches: data.branches.filter((b) => b.active !== false).length,
    users: data.users.length,
    categories: data.categories.length,
  };
}
