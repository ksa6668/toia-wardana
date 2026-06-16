// src/firebaseExpenses.js
// ========================================================
// المصاريف المتغيرة + المصاريف الثابتة (§S1) — مُستخرج من firebase.js (نقل فقط).
//
// يشمل: addExpense / updateExpense / deleteExpense / getExpenses
//        getFixedExpenses / getFixedExpensesRange / dateRangeToMonthRange / setFixedExpense
//
// التبعيات (§S1 المرحلة 10 — barrel نظيف): مصادر حقيقية لا الـ barrel.
//   - _invalidateCachePrefix من firebaseCache.js
//   - db / auth من firebaseCore.js (الورقة)
//   - notifyTelegramExpenseAdded من firebaseTelegram.js
//   كلها استخدام وقت-تشغيل داخل الأجسام ⇒ لا مشكلة دورة وقت التحميل.
//
// classifyExpense تخص مجال المصاريف فنُعرّفها هنا (مصدرها الحقيقي).
// يستوردها firebaseCatalog.getCategories من هنا، والمكوّنات عبر barrel firebase.js.
// ========================================================
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { invalidateCachePrefix as _invalidateCachePrefix } from "./firebaseCache";
import { db, auth } from "./firebaseCore";
import { notifyTelegramExpenseAdded } from "./firebaseTelegram";

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
  const amountN = Math.max(0, Number(amount) || 0); // Batch 58: قصّ السالب
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
  const amountN = Math.max(0, Number(amount) || 0); // Batch 58: قصّ السالب
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

  // Batch 45: مسح cache
  _invalidateCachePrefix('expenses');

  return result;
}

export async function deleteExpense(id) {
  const result = await deleteDoc(doc(db, "expenses", id));

  // Batch 45: مسح cache
  _invalidateCachePrefix('expenses');
  return result;
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
