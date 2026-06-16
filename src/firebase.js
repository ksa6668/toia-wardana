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
  setPersistence,
  browserLocalPersistence,
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
  
  writeBatch,
} from "firebase/firestore";

// S1 (المرحلة 1): مُساعد إبطال الـ cache نُقل إلى firebaseCache.js (نقل فقط — نفس المنطق).
// نُبقي الاسم المحلي _invalidateCachePrefix عبر alias حتى تبقى كل مواضع الاستدعاء كما هي.
import { invalidateCachePrefix as _invalidateCachePrefix } from './firebaseCache';

// S1 (المرحلة 4): الفروع/طرق الدفع/التصنيفات نُقلت إلى firebaseCatalog.js (نقل فقط).
// نستوردها هنا للاستخدام الداخلي (getAllGoalsForMonth يستدعي getBranches)
// ونُعيد تصديرها أدناه حتى تبقى استيرادات المكوّنات `from '../firebase'` كما هي.
import {
  getBranches, updateBranch, addBranch, deleteBranch,
  getPaymentMethods,
  getCategories, setCategoryRequiresImage, addCategory, deleteCategory,
  setCategoryOrder, reorderCategories,
} from './firebaseCatalog';

// S1 (المرحلة 5): المصاريف المتغيرة + الثابتة نُقلت إلى firebaseExpenses.js (نقل فقط).
// لا مُستدعٍ داخلي لها في firebase.js ⇒ إعادة تصدير فقط حتى تبقى استيرادات المكوّنات كما هي.
// (firebaseExpenses يستورد classifyExpense و notifyTelegramExpenseAdded من هذا الملف.)
export {
  addExpense, updateExpense, deleteExpense, getExpenses,
  getFixedExpenses, getFixedExpensesRange, dateRangeToMonthRange, setFixedExpense,
} from './firebaseExpenses';

// S1 (المرحلة 6): دوال عملاء واتساب نُقلت إلى firebaseWhatsapp.js (نقل فقط).
// لا مُستدعٍ داخلي لها في firebase.js ⇒ إعادة تصدير فقط حتى تبقى استيرادات المكوّنات كما هي.
// (firebaseWhatsapp يستورد notifyTelegramWhatsappAdded من هذا الملف.)
export {
  addWhatsappEntry, updateWhatsappEntry, deleteWhatsappEntry, getWhatsappEntries,
  setWhatsappBaseline, getWhatsappBaseline,
} from './firebaseWhatsapp';

// S1 (المرحلة 7): الأهداف الشهرية نُقلت إلى firebaseGoals.js (نقل فقط).
// نستوردها هنا للاستخدام الداخلي (notifyTelegramWhatsappAdded يستدعي getMonthlyGoal)
// ونُعيد تصديرها حتى تبقى استيرادات المكوّنات `from '../firebase'` كما هي.
import {
  getMonthlyGoal, setMonthlyGoal, setReviewsAchieved, getAllGoalsForMonth,
} from './firebaseGoals';
export {
  getMonthlyGoal, setMonthlyGoal, setReviewsAchieved, getAllGoalsForMonth,
};

// S1 (المرحلة 8): إشعارات Telegram + helpers نُقلت إلى firebaseTelegram.js (نقل فقط).
// نستورد ما يُستخدم داخلياً (addDailySales → notifyTelegramSaleAdded، logout →
// clearUserNameCache) ونُعيد تصدير كل الدوال المُصدّرة حتى تبقى استيرادات بقية
// الوحدات/المكوّنات (`from '../firebase'`) كما هي.
import { notifyTelegramSaleAdded, clearUserNameCache } from './firebaseTelegram';
export {
  notifyTelegramSaleAdded, notifyTelegramExpenseAdded,
  notifyTelegramWhatsappAdded, clearUserNameCache,
} from './firebaseTelegram';

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

// ========== Batch 56: ثبات الجلسة + خمول 30 يوم ==========
// نثبّت الجلسة محلياً → عند فتح التطبيق يدخل مباشرة بدون طلب الاسم/الرمز.
// نطبّق خروجاً تلقائياً فقط بعد 30 يوماً من عدم الاستخدام.
setPersistence(auth, browserLocalPersistence).catch(() => { /* fallback للافتراضي */ });

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
export function pinToPassword(pin) {
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

// D5: مصدر واحد لـ "صافي مدى لكل سجل" (مكوّن مدى فقط، بعد الرسوم).
// كان مكرّراً حرفياً في ManagerKpis / ManagerMonthly / MonthlyBreakdownSheet.
// السلوك مطابق تماماً للكود السابق: لو madaNet مخزّن نستخدمه، وإلا نحسبه
// من mada بنفس المعادلة والتقريب (MADA_FEE_RATE = 0.0092 = نفس الـ literal السابق).
export function madaNetOf(sale) {
  if (typeof sale?.madaNet === 'number') return sale.madaNet;
  const m = Number(sale?.mada) || 0;
  return +(m * (1 - MADA_FEE_RATE)).toFixed(2);
}


// تسجيل مبيعات يومية (القسم 6 من المنطق)
// ملاحظة: المبلغ المدخل لـ mada هو الإجمالي قبل الرسوم.
// نحفظ كذلك madaFees و madaNet لأغراض التقارير.
export async function addDailySales({ date, branchId, cash, mada, transfer }) {
  // Batch 58: قصّ القيم السالبة (حماية من إدخال خاطئ يفسد التقارير)
  const cashN = Math.max(0, Number(cash) || 0);
  const madaN = Math.max(0, Number(mada) || 0);
  const transferN = Math.max(0, Number(transfer) || 0);
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

// تسجيل مصروف متغير (§S1): نُقل addExpense إلى firebaseExpenses.js (re-export أدناه).

// ========== Batch 12: تعديل/حذف المبيعات والمصاريف (للمدير فقط) ==========
// التحقق من صلاحيات المدير يتم على مستوى الـ UI + Firestore Security Rules.

// تحديث مبيعة يومية — يعيد حساب total/madaFees/madaNet/netTotal تلقائياً
// Batch 58: قصّ القيم السالبة
export async function updateDailySales(id, { date, branchId, cash, mada, transfer }) {
  const cashN = Math.max(0, Number(cash) || 0);
  const madaN = Math.max(0, Number(mada) || 0);
  const transferN = Math.max(0, Number(transfer) || 0);
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

  // Batch 45: مسح cache
  _invalidateCachePrefix('sales');

  return result;
}

export async function deleteDailySales(id) {
  const result = await deleteDoc(doc(db, "dailySales", id));

  // Batch 45: مسح cache
  _invalidateCachePrefix('sales');
  return result;
}

// §S1: نُقل updateExpense و deleteExpense إلى firebaseExpenses.js (re-export أدناه).

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

// §S1: نُقل getExpenses + المصاريف الثابتة (getFixedExpenses/getFixedExpensesRange/
// dateRangeToMonthRange/setFixedExpense) إلى firebaseExpenses.js (re-export أدناه).

// ============================================================
// Batch 46: عملاء واتساب
// ============================================================
// مجموعة "whatsapp": سجل يومي لكل فرع (مثل dailySales)
// الحقول: date, branchId, customers, newCustomers, buyers
// مجموعة "whatsappBaseline": إجمالي تاريخي لكل فرع
// المعرف: branchId (مستند واحد لكل فرع)
// الحقول: branchId, totalCustomers, updatedAt

// S1 (المرحلة 6): دوال واتساب نُقلت إلى firebaseWhatsapp.js (re-export أعلى الملف).
// لا مُستدعٍ داخلي لها في firebase.js. (firebaseWhatsapp يستورد
// notifyTelegramWhatsappAdded من هذا الملف — تُستدعى وقت-تشغيل فقط.)


// S1: getUsers وبقية دوال المستخدمين نُقلت إلى firebaseUsers.js (re-export أدناه).

// ========== الفروع + طرق الدفع + التصنيفات (§S1) ==========
// نُقلت إلى firebaseCatalog.js (نقل فقط، مع حالة _branchesCache كنسخة واحدة هناك).
// مُستوردة أعلى الملف للاستخدام الداخلي، ونُعيد تصديرها هنا للمكوّنات.
export {
  getBranches, updateBranch, addBranch, deleteBranch,
  getPaymentMethods,
  getCategories, setCategoryRequiresImage, addCategory, deleteCategory,
  setCategoryOrder, reorderCategories,
};

// ========== إدارة المستخدمين (§S1) ==========
// نُقلت كل دوال المستخدمين إلى firebaseUsers.js (نقل فقط).
// نُعيد تصديرها هنا حتى تبقى استيرادات المكوّنات `from '../firebase'` كما هي.
export {
  getUsers,
  saveUserLanguage,
  changeMyPin,
  setUserActive,
  adminUpdateUserProfile,
  adminChangeUserPin,
  adminDeleteUser,
} from './firebaseUsers';

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

// S1 (المرحلة 7): دوال الأهداف نُقلت إلى firebaseGoals.js (نقل فقط).
// مُستوردة أعلى الملف (notifyTelegramWhatsappAdded يستدعي getMonthlyGoal داخلياً)
// ونُعيد تصديرها أعلى الملف أيضاً حتى تبقى استيرادات المكوّنات كما هي.

// ملاحظة (§S1): addBranch و deleteBranch نُقلتا إلى firebaseCatalog.js
// (مُعاد تصديرهما مع بقية دوال الفروع أعلاه).

// ========================================================
// App Settings (§Batch 3) — نُقلت إلى firebaseSettings.js (نقل فقط).
// نُعيد تصديرها هنا حتى تبقى استيرادات المكوّنات `from '../firebase'` كما هي.
// ========================================================
export { getAppSettings, setAppSettings } from './firebaseSettings';

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

