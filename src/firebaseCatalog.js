// src/firebaseCatalog.js
// ========================================================
// الفروع + طرق الدفع + تصنيفات المصاريف (§S1) — مُستخرج من firebase.js (نقل فقط).
//
// يشمل:
//   - الفروع: getBranches / updateBranch / addBranch / deleteBranch
//             (+ الحالة الوحدوية _branchesCache وثوابتها — نسخة واحدة هنا فقط)
//   - طرق الدفع: getPaymentMethods
//   - التصنيفات: getCategories / setCategoryRequiresImage / addCategory /
//                deleteCategory / setCategoryOrder / reorderCategories
//
// db و classifyExpense يأتيان من firebase.js؛ يُستخدمان داخل أجسام الدوال
// فقط ⇒ لا مشكلة دورة وقت التحميل. (classifyExpense تبقى في firebase.js لأنها
// تخص مجال المصاريف — تستخدمها addExpense/updateExpense والمكوّن ExpenseFormV2.)
// ========================================================
import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebaseCore";
import { classifyExpense } from "./firebaseExpenses";

// ========== الفروع (§12 من المنطق) ==========

const DEFAULT_BRANCHES = [
  { id: "toia", name: "تويا", active: true, order: 1 },
  { id: "wardana", name: "وردانة", active: true, order: 2 },
];

// جلب الفروع النشطة، مرتبة، مع زرع افتراضي عند أول تشغيل
// Batch 50: cache للفروع (in-memory) - مدته دقيقة كاملة
// الفروع نادراً ما تتغير، لذا التخزين المؤقت آمن ويسرّع الشاشات التي تستدعيها
let _branchesCache = null;
let _branchesCacheTime = 0;
const BRANCHES_CACHE_TTL = 60 * 1000; // 60 ثانية

export async function getBranches() {
  // إعادة من الـ cache لو لا يزال صالح
  const now = Date.now();
  if (_branchesCache && (now - _branchesCacheTime) < BRANCHES_CACHE_TTL) {
    return _branchesCache;
  }

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
      _branchesCache = DEFAULT_BRANCHES;
      _branchesCacheTime = now;
      return DEFAULT_BRANCHES;
    }
    _branchesCache = DEFAULT_BRANCHES;
    _branchesCacheTime = now;
    return DEFAULT_BRANCHES;
  }
  const result = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  _branchesCache = result;
  _branchesCacheTime = now;
  return result;
}

// Batch 50: تنظيف cache الفروع عند أي تعديل
function _invalidateBranchesCache() {
  _branchesCache = null;
  _branchesCacheTime = 0;
}

// تحديث اسم فرع أو حالته
export async function updateBranch(id, data) {
  await updateDoc(doc(db, "branches", id), data);
  _invalidateBranchesCache();
}

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
