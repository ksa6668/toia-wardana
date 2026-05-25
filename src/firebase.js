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
  
  writeBatch,
} from "firebase/firestore";

// ============================================================
// Batch 45: Cache Invalidation Helper
// يُستدعى من دوال CRUD لمسح cache الاستعلامات المتأثرة.
// يعمل عبر sessionStorage (نفس آلية useCachedQuery).
// ============================================================
const CACHE_PREFIX = 'tw_cache_';
const VERSION_PREFIX = 'tw_cache_v_';

function _invalidateCachePrefix(prefix) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const fullPrefix = CACHE_PREFIX + prefix;
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    // version token: يجبر useCachedQuery على re-fetch حتى لو cache لا يزال موجوداً في الذاكرة
    const versionKey = VERSION_PREFIX + prefix;
    const currentV = Number(sessionStorage.getItem(versionKey) || '0');
    sessionStorage.setItem(versionKey, String(currentV + 1));
  } catch { /* ignore */ }
}

// ============================================================

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
  // Batch 40: مسح cache اسم المستخدم (إن وُجد)
  try { clearUserNameCache(); } catch { /* ignore */ }
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
// كل 100 ريال => 0.80 هلله رسوم أساسية + 15% ضريبة قيمة مضافة على الرسوم
// = 0.80 + 0.12 = 0.92 هلله (≈ 0.92 ريال لكل 100 ريال)
// نسبة الرسوم الإجمالية على المبلغ = 0.92 / 100 = 0.92%
// النسبة تطبّق على أي مبلغ (ريال واحد أو 10,000)
export const MADA_FEE_RATE = 0.0092;
export function madaFees(grossMada) {
  const g = Number(grossMada) || 0;
  return +(g * MADA_FEE_RATE).toFixed(2);
}
export function madaNet(grossMada) {
  const g = Number(grossMada) || 0;
  return +(g * (1 - MADA_FEE_RATE)).toFixed(2);
}

// Batch 29: helper موحّد لقراءة "صافي المبيعات بعد رسوم مدى" من سجل واحد
// يدعم السجلات القديمة (التي لا تحتوي netTotal) عبر الحساب من cash/mada/transfer
export function salesNet(sale) {
  if (!sale) return 0;
  // لو الحقل موجود (السجلات الجديدة) نستخدمه مباشرة
  if (typeof sale.netTotal === 'number' && !Number.isNaN(sale.netTotal)) {
    return sale.netTotal;
  }
  // fallback للسجلات القديمة: نحسبه من المكوّنات
  const cashN = Number(sale.cash) || 0;
  const madaN = Number(sale.mada) || 0;
  const transferN = Number(sale.transfer) || 0;
  const fees = +(madaN * MADA_FEE_RATE).toFixed(2);
  return +(cashN + (madaN - fees) + transferN).toFixed(2);
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

  const ref = await addDoc(collection(db, "dailySales"), {
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

  // Batch 40: إشعار Telegram (fire-and-forget، لا يعطّل الحفظ)
  notifyTelegramSaleAdded({
    date, branchId, cash: cashN, mada: madaN, transfer: transferN, total,
  });

  // Batch 45: مسح cache الاستعلامات المتأثرة
  _invalidateCachePrefix('sales');

  return ref;
}

// تصنيف نوع المصروف لأغراض التقارير (للتوافق الخلفي مع البيانات القديمة)
export function classifyExpense(categoryId) {
  if (!categoryId) return "general";
  // normalize: lowercase + strip whitespace + remove "ال" prefix for matching
  const k = String(categoryId).trim();
  // التصنيفات الأربعة الأساسية — مظللة باللون الأزرق المميّز في الـ UI
  if (k === "ورد" || k === "flower" || k === "الورد") return "flower";
  if (k === "توصيل" || k === "delivery" || k === "التوصيل") return "delivery";
  if (
    k === "طلبات العملاء" || k === "طلبات عملاء" || k === "customer_orders" || k === "customerOrders"
  ) return "customerOrders";
  if (
    k === "مستلزمات وبضائع" || k === "مستلزمات" || k === "بضائع" || k === "supplies" ||
    k === "المستلزمات" || k === "المستلزمات والبضائع"
  ) return "supplies";
  // التصنيفات الثانوية
  if (k === "تسويق" || k === "marketing" || k === "التسويق") return "marketing";
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
  const amountN = Number(amount) || 0;
  const catName = categoryName || categoryId;

  const ref = await addDoc(collection(db, "expenses"), {
    date,
    branchId,
    categoryId,
    categoryName: catName,
    expenseType: expenseType || classifyExpense(catName),
    amount: amountN,
    paymentMethodId,
    notes,
    invoiceUrl,
    invoicePath,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });

  // Batch 40: إشعار Telegram
  notifyTelegramExpenseAdded({
    date, branchId, categoryName: catName, amount: amountN, paymentMethodId, notes,
  });

  // Batch 45: مسح cache
  _invalidateCachePrefix('expenses');

  return ref;
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

  const result = await updateDoc(doc(db, "dailySales", id), {
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

  // Batch 40: إشعار Telegram
  notifyTelegramSaleUpdated({
    date, branchId, cash: cashN, mada: madaN, transfer: transferN, total,
  });

  // Batch 45: مسح cache
  _invalidateCachePrefix('sales');

  return result;
}

export async function deleteDailySales(id) {
  // Batch 40: نقرأ البيانات قبل الحذف لإرسالها في الإشعار
  let snapshot = null;
  try {
    const snap = await getDoc(doc(db, "dailySales", id));
    if (snap.exists()) snapshot = snap.data();
  } catch { /* ignore */ }

  const result = await deleteDoc(doc(db, "dailySales", id));

  if (snapshot) {
    notifyTelegramSaleDeleted({
      date: snapshot.date,
      branchId: snapshot.branchId,
      total: snapshot.total || 0,
    });
  }
  // Batch 45: مسح cache
  _invalidateCachePrefix('sales');
  return result;
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
  const amountN = Number(amount) || 0;
  const catName = categoryName || categoryId;

  const payload = {
    date,
    branchId,
    categoryId,
    categoryName: catName,
    expenseType: expenseType || classifyExpense(catName),
    amount: amountN,
    paymentMethodId,
    notes,
    updatedBy: auth.currentUser.uid,
    updatedAt: serverTimestamp(),
  };
  if (invoiceUrl !== undefined) payload.invoiceUrl = invoiceUrl;
  if (invoicePath !== undefined) payload.invoicePath = invoicePath;

  const result = await updateDoc(doc(db, "expenses", id), payload);

  // Batch 40: إشعار Telegram
  notifyTelegramExpenseUpdated({
    date, branchId, categoryName: catName, amount: amountN, paymentMethodId,
  });

  // Batch 45: مسح cache
  _invalidateCachePrefix('expenses');

  return result;
}

export async function deleteExpense(id) {
  // Batch 40: نقرأ البيانات قبل الحذف
  let snapshot = null;
  try {
    const snap = await getDoc(doc(db, "expenses", id));
    if (snap.exists()) snapshot = snap.data();
  } catch { /* ignore */ }

  const result = await deleteDoc(doc(db, "expenses", id));

  if (snapshot) {
    notifyTelegramExpenseDeleted({
      date: snapshot.date,
      branchId: snapshot.branchId,
      categoryName: snapshot.categoryName,
      amount: snapshot.amount || 0,
    });
  }
  // Batch 45: مسح cache
  _invalidateCachePrefix('expenses');
  return result;
}

// ========== قراءة البيانات (للوحة المدير) ==========

// المبيعات بين تاريخين (date محفوظ كنص YYYY-MM-DD)
export async function getSales(fromDate, toDate, branchId = null) {
  // Batch 39: اختيارياً يفلتر بفرع معين — مهم للموظف لأن Firestore Rules
  // تمنع قراءة سجلات فرع آخر، وبدون where(branchId) يرفض الاستعلام كاملاً.
  const constraints = [
    where("date", ">=", fromDate),
    where("date", "<=", toDate),
  ];
  if (branchId) {
    constraints.push(where("branchId", "==", branchId));
  }
  const q = query(collection(db, "dailySales"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getExpenses(fromDate, toDate, branchId = null) {
  // Batch 39: نفس المنطق
  const constraints = [
    where("date", ">=", fromDate),
    where("date", "<=", toDate),
  ];
  if (branchId) {
    constraints.push(where("branchId", "==", branchId));
  }
  const q = query(collection(db, "expenses"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// المصاريف الثابتة لشهر معيّن، مثال month = "2026-05" (القسم 9 من المنطق)
export async function getFixedExpenses(month) {
  const q = query(collection(db, "fixedExpenses"), where("month", "==", month));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Batch 43: المصاريف الثابتة لنطاق من الشهور (تستخدمه التقارير)
// fromMonth/toMonth بصيغة "YYYY-MM" (شامل الطرفين)
// branchId اختياري للفلترة
export async function getFixedExpensesRange(fromMonth, toMonth, branchId = null) {
  const constraints = [
    where("month", ">=", fromMonth),
    where("month", "<=", toMonth),
  ];
  if (branchId) constraints.push(where("branchId", "==", branchId));
  const q = query(collection(db, "fixedExpenses"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Batch 43: استخراج شهور فريدة من نطاق تواريخ (YYYY-MM-DD → YYYY-MM)
// مفيد لتحديد الـ from/to لـ getFixedExpensesRange بناءً على getSales/getExpenses range
export function dateRangeToMonthRange(fromDate, toDate) {
  return {
    fromMonth: fromDate.slice(0, 7),
    toMonth: toDate.slice(0, 7),
  };
}

// حفظ المصروف الثابت الشهري لفرع (معرّف المستند = month_branchId)
// Batch 15: دعم الفصل إلى إيجار + رواتب + تأمينات GOSI
// يحافظ على حقل amount (إجمالي) للتوافق مع الكود القديم
export async function setFixedExpense({ month, branchId, amount, rent, salaries, gosi }) {
  // إذا تم تمرير breakdown، نحسب amount منهم
  const rentN = Number(rent) || 0;
  const salariesN = Number(salaries) || 0;
  const gosiN = Number(gosi) || 0;
  const breakdownTotal = rentN + salariesN + gosiN;
  // إذا تم تمرير breakdown نستخدمه، وإلا نعتمد على amount القديم
  const finalAmount = (rent !== undefined || salaries !== undefined || gosi !== undefined)
    ? breakdownTotal
    : (Number(amount) || 0);

  await setDoc(doc(db, "fixedExpenses", `${month}_${branchId}`), {
    month,
    branchId,
    amount: finalAmount,
    rent: rentN,
    salaries: salariesN,
    gosi: gosiN,
    updatedAt: serverTimestamp(),
  });
  // Batch 45: مسح cache (التقارير تستخدم getFixedExpensesRange)
  _invalidateCachePrefix('fixedExpenses');
}

// ============================================================
// Batch 46: عملاء واتساب
// ============================================================
// مجموعة "whatsapp": سجل يومي لكل فرع (مثل dailySales)
// الحقول: date, branchId, customers, newCustomers, buyers
// مجموعة "whatsappBaseline": إجمالي تاريخي لكل فرع
// المعرف: branchId (مستند واحد لكل فرع)
// الحقول: branchId, totalCustomers, updatedAt

export async function addWhatsappEntry({ date, branchId, customers, newCustomers, buyers }) {
  if (!auth.currentUser) throw new Error("Not logged in");
  const customersN = Math.max(0, Math.floor(Number(customers) || 0));
  const newCustomersN = Math.max(0, Math.floor(Number(newCustomers) || 0));
  const buyersN = Math.max(0, Math.floor(Number(buyers) || 0));

  const ref = await addDoc(collection(db, "whatsapp"), {
    date,
    branchId,
    customers: customersN,
    newCustomers: newCustomersN,
    buyers: buyersN,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
  });

  // Batch 47: إشعار Telegram (fire-and-forget، لا يعطّل الحفظ)
  notifyTelegramWhatsappAdded({
    date,
    branchId,
    customers: customersN,
    newCustomers: newCustomersN,
    buyers: buyersN,
  });

  _invalidateCachePrefix('whatsapp');
  return ref;
}

export async function updateWhatsappEntry(id, { date, branchId, customers, newCustomers, buyers }) {
  if (!auth.currentUser) throw new Error("Not logged in");
  const customersN = Math.max(0, Math.floor(Number(customers) || 0));
  const newCustomersN = Math.max(0, Math.floor(Number(newCustomers) || 0));
  const buyersN = Math.max(0, Math.floor(Number(buyers) || 0));

  const result = await updateDoc(doc(db, "whatsapp", id), {
    date,
    branchId,
    customers: customersN,
    newCustomers: newCustomersN,
    buyers: buyersN,
    updatedAt: serverTimestamp(),
  });
  _invalidateCachePrefix('whatsapp');
  return result;
}

export async function deleteWhatsappEntry(id) {
  const result = await deleteDoc(doc(db, "whatsapp", id));
  _invalidateCachePrefix('whatsapp');
  return result;
}

// قراءة سجلات واتساب لنطاق تواريخ
export async function getWhatsappEntries(fromDate, toDate, branchId = null) {
  const constraints = [
    where("date", ">=", fromDate),
    where("date", "<=", toDate),
  ];
  if (branchId) constraints.push(where("branchId", "==", branchId));
  const q = query(collection(db, "whatsapp"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ========= Baseline (إجمالي تاريخي) =========
// رقم واحد لكل فرع: مجموع عملاء واتساب التاريخي قبل بدء التطبيق

export async function setWhatsappBaseline(branchId, totalCustomers) {
  if (!auth.currentUser) throw new Error("Not logged in");
  const total = Math.max(0, Math.floor(Number(totalCustomers) || 0));
  await setDoc(doc(db, "whatsappBaseline", branchId), {
    branchId,
    totalCustomers: total,
    updatedAt: serverTimestamp(),
  });
  _invalidateCachePrefix('whatsappBaseline');
}

export async function getWhatsappBaseline(branchId = null) {
  if (branchId) {
    const snap = await getDoc(doc(db, "whatsappBaseline", branchId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }
  const snap = await getDocs(collection(db, "whatsappBaseline"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
    .map((d) => {
      const data = { id: d.id, ...d.data() };
      // Batch 16: auto-heal — إذا expenseType مفقود أو غلط، استنتجه من name/id
      if (!data.expenseType || data.expenseType === 'general') {
        const inferred = classifyExpense(data.id) !== 'general'
          ? classifyExpense(data.id)
          : classifyExpense(data.name);
        if (inferred !== 'general') data.expenseType = inferred;
      }
      return data;
    })
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
 * يحفظ هدف فرع لشهر معين. الـ data: { budget, reviewsTarget, reviewsAchieved? }
 * Batch 16: يدعم تحديث reviewsAchieved (التقييمات المُحقّقة) باستقلال.
 */
export async function setMonthlyGoal(branchId, monthStr, data) {
  const goalId = `${branchId}_${monthStr}`;
  const ref = doc(db, "goals", goalId);
  const payload = {
    branchId,
    month: monthStr,
    updatedAt: serverTimestamp(),
  };
  if (data.budget !== undefined) payload.budget = Number(data.budget) || 0;
  if (data.reviewsTarget !== undefined) payload.reviewsTarget = Number(data.reviewsTarget) || 0;
  if (data.reviewsAchieved !== undefined) payload.reviewsAchieved = Number(data.reviewsAchieved) || 0;
  await setDoc(ref, payload, { merge: true });
  // Batch 45: مسح cache
  _invalidateCachePrefix('goals');
}

/**
 * Batch 16: تحديث عدد التقييمات المُحقّقة فقط (للنقر المزدوج على كرت التقييمات)
 */
export async function setReviewsAchieved(branchId, monthStr, achieved) {
  return setMonthlyGoal(branchId, monthStr, { reviewsAchieved: achieved });
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

// ========================================================
// Batch 15: إعادة تعيين كل البيانات (للمدير فقط)
// يحذف فقط: dailySales, expenses, goals — يحافظ على branches/users/categories/appSettings
// ========================================================
export async function resetAllData({ alsoFixed = false, alsoGoals = true } = {}) {
  const collectionsToWipe = ['dailySales', 'expenses'];
  if (alsoFixed) collectionsToWipe.push('fixedExpenses');
  if (alsoGoals) collectionsToWipe.push('goals');

  let totalDeleted = 0;
  for (const coll of collectionsToWipe) {
    const snap = await getDocs(collection(db, coll));
    // الحذف على دفعات من 400 (حد batch=500)
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const slice = docs.slice(i, i + 400);
      const batch = writeBatch(db);
      slice.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      totalDeleted += slice.length;
    }
  }
  return { totalDeleted };
}

// ====================================================================
// Batch 30: استيراد البيانات التاريخية من ملف JSON
// ====================================================================

/**
 * يفحص هل توجد بيانات سابقة مستوردة لفرع معين.
 * يستخدم قبل الاستيراد للتحذير من التكرار.
 */
export async function checkExistingImports(branchId) {
  const result = { sales: 0, expenses: 0, oldestDate: null, newestDate: null };
  
  const salesSnap = await getDocs(query(
    collection(db, "dailySales"),
    where("branchId", "==", branchId),
    where("imported", "==", true)
  ));
  result.sales = salesSnap.size;
  
  const expSnap = await getDocs(query(
    collection(db, "expenses"),
    where("branchId", "==", branchId),
    where("imported", "==", true)
  ));
  result.expenses = expSnap.size;
  
  // اجلب أقدم وأحدث تاريخ من البيانات المستوردة
  if (result.sales > 0) {
    const dates = salesSnap.docs.map(d => d.data().date).filter(Boolean).sort();
    if (dates.length) {
      result.oldestDate = dates[0];
      result.newestDate = dates[dates.length - 1];
    }
  }
  
  return result;
}

/**
 * يستورد دفعة من سجلات المبيعات أو المصاريف.
 * يقسمها إلى batches من 400 (الحد الأقصى لـ writeBatch).
 * onProgress: callback يستدعى بـ ({done, total, phase})
 */
export async function importHistoricalData({
  sales = [],
  expenses = [],
  onProgress = () => {},
}) {
  const BATCH_SIZE = 400;
  const total = sales.length + expenses.length;
  let done = 0;
  const result = { salesImported: 0, expensesImported: 0, errors: [] };
  
  // Batch 32: استخدم UID المستخدم الحالي ليتوافق مع Firestore Rules
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('يجب تسجيل الدخول قبل الاستيراد');
  }

  // ===== 1) استيراد المبيعات =====
  for (let i = 0; i < sales.length; i += BATCH_SIZE) {
    const slice = sales.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    
    slice.forEach((s) => {
      const ref = doc(collection(db, "dailySales"));
      batch.set(ref, {
        date: s.date,
        branchId: s.branchId,
        cash: Number(s.cash) || 0,
        mada: Number(s.mada) || 0,
        madaFees: Number(s.madaFees) || 0,
        madaNet: Number(s.madaNet) || 0,
        transfer: Number(s.transfer) || 0,
        total: Number(s.total) || 0,
        netTotal: Number(s.netTotal) || 0,
        imported: true, // علم يميّز السجلات المستوردة
        createdBy: uid, // ✅ UID المستخدم الفعلي (يتوافق مع Security Rules)
        createdAt: serverTimestamp(),
      });
    });
    
    try {
      await batch.commit();
      result.salesImported += slice.length;
      done += slice.length;
      onProgress({ done, total, phase: "sales" });
    } catch (err) {
      result.errors.push({
        type: "sales",
        batchStart: i,
        message: err?.message || "Unknown error",
      });
    }
  }

  // ===== 2) استيراد المصاريف =====
  for (let i = 0; i < expenses.length; i += BATCH_SIZE) {
    const slice = expenses.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    
    slice.forEach((e) => {
      const ref = doc(collection(db, "expenses"));
      batch.set(ref, {
        date: e.date,
        branchId: e.branchId,
        categoryId: e.categoryId,
        categoryName: e.categoryName,
        expenseType: e.expenseType || "general",
        amount: Number(e.amount) || 0,
        paymentMethodId: e.paymentMethodId || "", // فارغ للمستوردة
        notes: e.notes || "",
        invoiceUrl: e.invoiceUrl || null,
        imported: true,
        createdBy: uid, // ✅ UID المستخدم
        createdAt: serverTimestamp(),
      });
    });
    
    try {
      await batch.commit();
      result.expensesImported += slice.length;
      done += slice.length;
      onProgress({ done, total, phase: "expenses" });
    } catch (err) {
      result.errors.push({
        type: "expenses",
        batchStart: i,
        message: err?.message || "Unknown error",
      });
    }
  }

  return result;
}

/**
 * يحذف كل البيانات المستوردة لفرع معين (للتراجع).
 * يستخدم في حالة الاستيراد بالخطأ.
 */
export async function deleteImportedData(branchId) {
  const result = { salesDeleted: 0, expensesDeleted: 0 };
  
  // حذف المبيعات المستوردة
  const salesSnap = await getDocs(query(
    collection(db, "dailySales"),
    where("branchId", "==", branchId),
    where("imported", "==", true)
  ));
  const salesDocs = salesSnap.docs;
  for (let i = 0; i < salesDocs.length; i += 400) {
    const slice = salesDocs.slice(i, i + 400);
    const batch = writeBatch(db);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    result.salesDeleted += slice.length;
  }
  
  // حذف المصاريف المستوردة
  const expSnap = await getDocs(query(
    collection(db, "expenses"),
    where("branchId", "==", branchId),
    where("imported", "==", true)
  ));
  const expDocs = expSnap.docs;
  for (let i = 0; i < expDocs.length; i += 400) {
    const slice = expDocs.slice(i, i + 400);
    const batch = writeBatch(db);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    result.expensesDeleted += slice.length;
  }
  
  return result;
}

// ====================================================================
// Batch 40: إشعارات Telegram
// ====================================================================
//
// يرسل إشعارات لقناة Telegram خاصة عند:
//   - تسجيل/تعديل/حذف مبيعات
//   - تسجيل/تعديل/حذف مصاريف
//
// التهيئة: تخزين Token + Chat ID في Vercel Environment Variables:
//   VITE_TELEGRAM_BOT_TOKEN
//   VITE_TELEGRAM_CHAT_ID
//
// لو القيم غير موجودة، الدالة تتجاهل بصمت (التطبيق يعمل عادياً).
// الإشعار async ولا يعطّل الـ flow حتى لو فشل (نسجّل warning فقط).
// ====================================================================

const TELEGRAM_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

/**
 * يرسل رسالة لقناة Telegram. fire-and-forget.
 * في حالة الفشل: console.warn فقط، لا يكسر الـ flow.
 */
async function sendTelegram(message) {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
    // التهيئة غير مفعّلة — تجاهل بصمت
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.warn('Telegram send failed:', errText);
    }
  } catch (err) {
    console.warn('Telegram error:', err?.message || err);
  }
}

/**
 * Batch 40: cache يحفظ اسم المستخدم + دوره.
 * يقلل قراءات Firestore المتكررة عند كل إشعار.
 */
let _userCache = null; // { name, role }

async function getCurrentUserInfo() {
  if (_userCache) return _userCache;
  const uid = auth.currentUser?.uid;
  if (!uid) return { name: 'غير معروف', role: null };
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const data = snap.data();
      _userCache = {
        name: data.displayName || data.username || 'مستخدم',
        role: data.role || null, // 'admin' | 'employee'
      };
      return _userCache;
    }
  } catch {
    /* ignore */
  }
  return { name: 'مستخدم', role: null };
}

// Helper قديم للتوافق
async function getCurrentUserName() {
  const info = await getCurrentUserInfo();
  return info.name;
}

// Batch 40: فحص هل المستخدم الحالي موظف (لفلترة الإشعارات)
async function isCurrentUserEmployee() {
  const info = await getCurrentUserInfo();
  return info.role === 'employee';
}

// نمسح الـ cache عند تسجيل الخروج
export function clearUserNameCache() {
  _userCache = null;
}

/**
 * يرجع اسم الفرع بالعربي مع emoji.
 */
function branchLabel(branchId) {
  if (branchId === 'toia') return '🌸 تويا';
  if (branchId === 'wardana') return '🌹 وردانة';
  return `📍 ${branchId}`;
}

/**
 * يرجع نص طريقة الدفع.
 */
function payMethodLabel(id) {
  if (!id) return '—';
  const map = {
    'Cash': 'كاش 💵',
    'cash': 'كاش 💵',
    'Mada': 'مدى 💳',
    'mada': 'مدى 💳',
    'Transfer': 'تحويل 📱',
    'transfer': 'تحويل 📱',
    'Apple Pay': 'Apple Pay 🍎',
    'STC Pay': 'STC Pay 📱',
  };
  return map[id] || id;
}

/**
 * تنسيق رقم بفاصلة الآلاف.
 */
function fmt(num) {
  return Number(num || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * إشعار: مبيعات جديدة — يُرسل فقط لو المُسجِّل موظف
 */
export async function notifyTelegramSaleAdded({ date, branchId, cash, mada, transfer, total }) {
  // Batch 40: فلترة — للموظفين فقط (المدير لا يحتاج إشعار نفسه)
  const isEmp = await isCurrentUserEmployee();
  if (!isEmp) return;

  const user = await getCurrentUserName();
  const msg =
    `💵 <b>مبيعات جديدة</b>\n` +
    `${branchLabel(branchId)}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👤 المُسجِّل: ${user}\n` +
    `📅 التاريخ: ${date}\n\n` +
    `💵 كاش: <b>${fmt(cash)}</b> ﷼\n` +
    `💳 مدى: <b>${fmt(mada)}</b> ﷼\n` +
    `📱 تحويل: <b>${fmt(transfer)}</b> ﷼\n` +
    `━━━━━━━━━━━━━━━\n` +
    `💰 الإجمالي: <b>${fmt(total)} ﷼</b>`;
  return sendTelegram(msg);
}

/**
 * إشعار: مصروف جديد — يُرسل فقط لو المُسجِّل موظف
 */
export async function notifyTelegramExpenseAdded({ date, branchId, categoryName, amount, paymentMethodId, notes }) {
  // Batch 40: فلترة — للموظفين فقط
  const isEmp = await isCurrentUserEmployee();
  if (!isEmp) return;

  const user = await getCurrentUserName();
  let msg =
    `💸 <b>مصروف جديد</b>\n` +
    `${branchLabel(branchId)}\n` +
    `━━━━━━━━━━━━━━━\n` +
    `👤 المُسجِّل: ${user}\n` +
    `📅 التاريخ: ${date}\n\n` +
    `📂 التصنيف: <b>${categoryName || '—'}</b>\n` +
    `💸 المبلغ: <b>${fmt(amount)} ﷼</b>\n` +
    `💳 الدفع: ${payMethodLabel(paymentMethodId)}`;
  if (notes && notes.trim()) {
    msg += `\n📝 ملاحظات: ${notes.trim()}`;
  }
  return sendTelegram(msg);
}

// Batch 40: دوال التعديل/الحذف لم تعد تُستخدم (الإشعارات للموظفين عند الإضافة فقط)
// تركناها كـ no-op لتفادي كسر أي مكان يستدعيها.
export async function notifyTelegramSaleUpdated() { /* disabled */ }
export async function notifyTelegramSaleDeleted() { /* disabled */ }
export async function notifyTelegramExpenseUpdated() { /* disabled */ }
export async function notifyTelegramExpenseDeleted() { /* disabled */ }

// ====================================================================
// Batch 47: إشعار Telegram لـ عملاء واتساب
// يُرسل عند الإضافة فقط (مثل المبيعات والمصاريف)
// يعرض: عدد العملاء + الجدد + المشترين + النسبة + تحقق الهدف (20%)
// ====================================================================

/**
 * يحوّل YYYY-MM-DD إلى صيغة عربية مقروءة "25 مايو 2026"
 */
function formatDateArabic(dateStr) {
  if (!dateStr) return '—';
  try {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${d} ${months[m - 1]} ${y}`;
  } catch {
    return dateStr;
  }
}

/**
 * إشعار: تسجيل عملاء واتساب جديد — يُرسل فقط لو المُسجِّل موظف
 */
export async function notifyTelegramWhatsappAdded({ date, branchId, customers, newCustomers, buyers }) {
  // فلترة: للموظفين فقط (المدير لا يحتاج إشعار نفسه)
  const isEmp = await isCurrentUserEmployee();
  if (!isEmp) return;

  const customersN = Number(customers) || 0;
  const newCustomersN = Number(newCustomers) || 0;
  const buyersN = Number(buyers) || 0;
  // نسبة الشراء = مشترين / إجمالي العملاء × 100
  const buyersPct = customersN > 0 ? Math.round((buyersN / customersN) * 100) : 0;
  // الهدف: 20% من اللي يكلّمونا يشترون فعلياً
  const targetMet = buyersPct >= 20;
  const goalLine = targetMet
    ? `🎯 الهدف (20%): ✅ تحقق وتجاوز!`
    : `🎯 الهدف (20%): ❌ لم يتحقق`;

  const branchName = branchId === 'toia' ? 'تويا' : branchId === 'wardana' ? 'وردانة' : branchId;

  const msg =
    `💬 <b>عملاء واتساب - فرع ${branchName}</b>\n` +
    `━━━━━━━━━━━━━━━\n` +
    `📅 التاريخ: ${formatDateArabic(date)}\n\n` +
    `👥 إجمالي العملاء: <b>${fmt(customersN)}</b>\n` +
    `✨ عملاء جدد: <b>${fmt(newCustomersN)}</b>\n` +
    `🛒 عدد المشترين: <b>${fmt(buyersN)}</b>\n` +
    `📊 نسبة الشراء: <b>${buyersPct}%</b>\n\n` +
    goalLine;
  return sendTelegram(msg);
}

