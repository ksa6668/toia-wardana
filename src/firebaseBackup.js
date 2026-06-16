// src/firebaseBackup.js
// ====================================================================
// النسخ الاحتياطي + الاستيراد التاريخي + إعادة التعيين (§S1 — المرحلة 10) — نقل فقط.
//
// يشمل: getAllDataForBackup, getDataStats, resetAllData,
//        checkExistingImports, importHistoricalData, deleteImportedData
//
// التبعيات: db/auth من firebaseCore (وقت-تشغيل فقط).
// ====================================================================
import {
  collection,
  getDocs,
  doc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebaseCore";

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
