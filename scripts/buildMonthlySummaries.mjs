// scripts/buildMonthlySummaries.mjs
// ====================================================================
// Batch 76: بناء مستندات الملخصات الشهرية (monthlySummaries) — backfill.
//
// عملية إضافية بحتة: تقرأ dailySales/expenses/whatsapp التاريخية،
// تحسب ملخص كل (فرع، شهر) بنفس دوال حساب الشاشات
// (src/utils/summaryMath.js — المصدر المشترك مع التحديث الحي)،
// وتكتب مجموعة monthlySummaries فقط. لا تعديل ولا حذف لأي سجل قائم.
//
// idempotent: الكتابة set مطلق لكل مستند — إعادة التشغيل تعطي نفس
// النتيجة بلا مضاعفة (لا increments إطلاقاً).
//
// التشغيل:
//   الوضع الافتراضي dry-run (لا كتابة إطلاقاً):
//     TW_BACKFILL_USER=<admin> TW_BACKFILL_PIN=<pin> node scripts/buildMonthlySummaries.mjs
//   الكتابة الفعلية (بعد الموافقة على مخرجات الـ dry-run):
//     TW_BACKFILL_USER=<admin> TW_BACKFILL_PIN=<pin> node scripts/buildMonthlySummaries.mjs --commit
//
// الاعتماد: مستخدم مدير (username/PIN كما في التطبيق) — نفس اشتقاق
// البريد/كلمة المرور في firebaseAuth.js. لا يحتاج Admin SDK ولا مفاتيح
// خدمة؛ Firestore Rules للمدير تسمح بالقراءة الشاملة.
// ====================================================================
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { computeMonthlySummary, SUMMARY_SCHEMA_VERSION } from "../src/utils/summaryMath.js";
import { computePeriodTotals } from "../src/utils/profitHelpers.js";
import { salesNet, madaNetOf } from "../src/madaMath.js";

// نفس بداية التاريخ المعتمدة في الشاشات (ManagerMonthly HISTORY_FROM)
const HISTORY_FROM = "2024-01-01";

// نفس firebaseConfig العام في src/firebaseCore.js (ليس سراً بالتصميم)
const firebaseConfig = {
  apiKey: "AIzaSyCsNvbrQ_eIGPnU_dR8LJ8Z0w0f1Fp9VuQ",
  authDomain: "toia-wardana.firebaseapp.com",
  projectId: "toia-wardana",
  storageBucket: "toia-wardana.firebasestorage.app",
  messagingSenderId: "382308751925",
  appId: "1:382308751925:web:d340344a5dd7de83782f7c",
};

// نفس اشتقاق firebaseAuth.js (usernameToEmail/pinToPassword)
const EMAIL_DOMAIN = "toia-wardana.app";
const PIN_SUFFIX = "__twpin";

function todayLocalStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(n) {
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const dryRun = !commit || args.includes("--dry-run");
  if (commit && args.includes("--dry-run")) {
    console.error("❌ لا تمرر --commit و --dry-run معاً — اختر وضعاً واحداً.");
    process.exit(1);
  }

  const user = process.env.TW_BACKFILL_USER;
  const pin = process.env.TW_BACKFILL_PIN;
  if (!user || !pin) {
    console.error("❌ مطلوب: TW_BACKFILL_USER و TW_BACKFILL_PIN (مستخدم مدير).");
    console.error("   مثال: TW_BACKFILL_USER=admin TW_BACKFILL_PIN=1234 node scripts/buildMonthlySummaries.mjs");
    process.exit(1);
  }

  console.log(`\n=== بناء الملخصات الشهرية — الوضع: ${dryRun ? "DRY-RUN (لا كتابة إطلاقاً)" : "COMMIT (كتابة فعلية)"} ===\n`);

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const email = `${String(user).trim().toLowerCase().replace(/\s+/g, "")}@${EMAIL_DOMAIN}`;
  await signInWithEmailAndPassword(auth, email, `${String(pin).trim()}${PIN_SUFFIX}`);
  console.log(`✓ تسجيل الدخول: ${email}`);

  // ---- 1) قراءة كل السجلات التاريخية (قراءة فقط) ----
  const to = todayLocalStr();
  async function fetchAll(coll) {
    const q = query(
      collection(db, coll),
      where("date", ">=", HISTORY_FROM),
      where("date", "<=", to)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const [allSales, allExpenses, allWhatsapp, fixedSnap] = await Promise.all([
    fetchAll("dailySales"),
    fetchAll("expenses"),
    fetchAll("whatsapp"),
    getDocs(collection(db, "fixedExpenses")), // للتحقق (حساب الربح) فقط — لا تُكتب
  ]);
  const allFixed = fixedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`✓ قُرئ: ${allSales.length} مبيعات، ${allExpenses.length} مصاريف، ${allWhatsapp.length} واتساب، ${allFixed.length} ثابتة (نطاق ${HISTORY_FROM} → ${to})\n`);

  // ---- 2) التجميع حسب (فرع، شهر) ----
  const monthOf = (r) => (/^\d{4}-\d{2}-\d{2}/.test(r.date || "") ? r.date.slice(0, 7) : null);
  const groups = new Map(); // key: branchId_month
  const add = (kind, r) => {
    const month = monthOf(r);
    if (!month || !r.branchId) return; // سجل بلا تاريخ/فرع صالح لا يظهر في الشاشات أصلاً
    const key = `${r.branchId}_${month}`;
    if (!groups.has(key)) groups.set(key, { branchId: r.branchId, month, sales: [], expenses: [], whatsapp: [] });
    groups.get(key)[kind].push(r);
  };
  allSales.forEach((r) => add("sales", r));
  allExpenses.forEach((r) => add("expenses", r));
  allWhatsapp.forEach((r) => add("whatsapp", r));

  const summaries = [...groups.values()]
    .sort((a, b) => (a.month + a.branchId).localeCompare(b.month + b.branchId))
    .map((g) => computeMonthlySummary(g.branchId, g.month, g.sales, g.expenses, g.whatsapp));

  const months = new Set(summaries.map((s) => s.month));
  console.log(`=== التقرير ===`);
  console.log(`عدد الأشهر: ${months.size} | عدد مستندات الملخص التي ستُكتب: ${summaries.length} (schemaVersion=${SUMMARY_SCHEMA_VERSION})\n`);

  // ---- 3) عيّنة 5 أشهر (الأقدم، الأحدث، وما بينهما) ----
  const pick = new Set([0, Math.floor(summaries.length / 4), Math.floor(summaries.length / 2), Math.floor((3 * summaries.length) / 4), summaries.length - 1]);
  const sample = [...pick].filter((i) => i >= 0 && i < summaries.length).map((i) => summaries[i]);
  console.log(`--- عيّنة (${sample.length} مستندات) ---`);
  for (const s of sample) {
    console.log(`\n📄 monthlySummaries/${s.branchId}_${s.month}`);
    console.log(`   مبيعات: صافي=${fmt(s.sales.net)} نقد=${fmt(s.sales.cash)} مدى(صافي)=${fmt(s.sales.madaNet)} تحويل=${fmt(s.sales.transfer)} | ${s.sales.count} سجل، ${s.sales.dates.length} يوم`);
    console.log(`   مصاريف: إجمالي=${fmt(s.expenses.total)} (ورد=${fmt(s.expenses.flower)} توصيل=${fmt(s.expenses.delivery)} مستلزمات=${fmt(s.expenses.supplies)}) | ${s.expenses.count} سجل، ${s.expenses.dates.length} يوم`);
    console.log(`   واتساب: عملاء=${s.whatsapp.customers} جدد=${s.whatsapp.newCustomers} مشترون=${s.whatsapp.buyers} | ${s.whatsapp.count} سجل`);
  }

  // ---- 4) مطابقة تحقّق: الملخص = القراءة الخام بمنطق الشاشة نفسه ----
  console.log(`\n--- مطابقة تحقّق (منطق الشاشة الخام مقابل الملخص) ---`);
  let mismatches = 0;
  const EPS = 1e-6;
  for (const s of sample) {
    const g = groups.get(`${s.branchId}_${s.month}`);
    // منطق الشاشة حرفياً: computePeriodTotals + reduces (كما في ManagerMonthly/Kpis)
    const fixedOfBranch = allFixed.filter((f) => f.branchId === s.branchId && f.month === s.month);
    const screen = computePeriodTotals(g.sales, g.expenses, fixedOfBranch);
    const screenCash = g.sales.reduce((t, x) => t + (Number(x.cash) || 0), 0);
    const screenMada = g.sales.reduce((t, x) => t + madaNetOf(x), 0);
    const screenTransfer = g.sales.reduce((t, x) => t + (Number(x.transfer) || 0), 0);
    const screenNet = g.sales.reduce((t, x) => t + salesNet(x), 0);
    // مشتق من الملخص: نفس أرقام الشاشة يجب أن تُشتق من حقوله
    const loggedDaysFromSummary = new Set([...s.sales.dates, ...s.expenses.dates]).size;
    const checks = [
      ["صافي المبيعات", screenNet, s.sales.net],
      ["صافي المبيعات (computePeriodTotals)", screen.sales, s.sales.net],
      ["نقد", screenCash, s.sales.cash],
      ["مدى صافي", screenMada, s.sales.madaNet],
      ["تحويل", screenTransfer, s.sales.transfer],
      ["مصاريف متغيرة", screen.varExpenses, s.expenses.total],
      ["أيام مسجّلة (loggedDays)", screen.loggedDays.size, loggedDaysFromSummary],
      ["عملاء واتساب", g.whatsapp.reduce((t, w) => t + (w.customers || 0), 0), s.whatsapp.customers],
      ["عملاء جدد", g.whatsapp.reduce((t, w) => t + (w.newCustomers || 0), 0), s.whatsapp.newCustomers],
      ["مشترون", g.whatsapp.reduce((t, w) => t + (w.buyers || 0), 0), s.whatsapp.buyers],
    ];
    const bad = checks.filter(([, a, b]) => Math.abs(a - b) > EPS);
    if (bad.length) {
      mismatches += bad.length;
      console.log(`❌ ${s.branchId}_${s.month}: ${bad.map(([n, a, b]) => `${n}: شاشة=${a} ملخص=${b}`).join(" | ")}`);
    } else {
      console.log(`✓ ${s.branchId}_${s.month}: ${checks.length}/${checks.length} حقول مطابقة 100% (صافي=${fmt(s.sales.net)}، ربح الشاشة=${fmt(screen.profit)})`);
    }
  }
  if (mismatches > 0) {
    console.error(`\n❌ ${mismatches} فروقات — لا تكمل إلى --commit قبل معالجتها.`);
    await signOut(auth);
    process.exit(1);
  }

  // ---- 5) الكتابة (فقط في --commit) ----
  if (dryRun) {
    console.log(`\n=== DRY-RUN اكتمل: لم تُكتب أي بيانات إطلاقاً. ===`);
    console.log(`للكتابة الفعلية (بعد الموافقة): أعد التشغيل مع --commit`);
  } else {
    console.log(`\n--- كتابة ${summaries.length} مستنداً (batch كل 400) ---`);
    let written = 0;
    for (let i = 0; i < summaries.length; i += 400) {
      const batch = writeBatch(db);
      for (const s of summaries.slice(i, i + 400)) {
        batch.set(doc(db, "monthlySummaries", `${s.branchId}_${s.month}`), {
          ...s,
          source: "backfill",
          lastComputedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      written += Math.min(400, summaries.length - i);
      console.log(`  ✓ ${written}/${summaries.length}`);
    }
    console.log(`\n=== اكتملت الكتابة. إعادة التشغيل بـ --commit تعطي نفس النتيجة (set مطلق). ===`);
  }

  await signOut(auth);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ فشل:", err?.message || err);
  process.exit(1);
});
