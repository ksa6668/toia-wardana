// src/loyaltyStats.js
// ====================================================================
// برنامج الولاء — تجميعات صفحة الإحصائيات (المرحلة 5).
// وحدة نقية بلا Firebase وبلا DOM — كل الدوال قابلة للاختبار بـ vitest.
//
// مبادئ إلزامية:
//   • حركات type:"audit" مستثناة من كل الحسابات (رصيد/فئة/متوسطات/عدادات)
//     — عبر BALANCE_TX_TYPES من loyaltyMath.
//   • الأعضاء المعطّلون (status=disabled) ومخفيو الهوية (anonymized)
//     خارج العد الأساسي، مع خيار includeHidden لإظهارهم.
//   • حركات earn المعكوسة (لها reverse بـ reversesTxId) مستثناة من
//     المبالغ والمتوسطات والعدادات.
//   • قيمة النقطة ديناميكية من الإعدادات — لا رقم ثابت.
// ====================================================================
import { BALANCE_TX_TYPES, addMonths, toDateSafe, effectiveTier } from "./loyaltyMath.js";

// ---------- الفترات ----------
// المفاتيح: week | month | 3m | 12m | all
// «الفترة السابقة» = فترة مساوية الطول سابقة مباشرة (للدلتا).
export function periodRange(key, now = new Date()) {
  const end = now;
  let start;
  if (key === "week") {
    // الأسبوع السعودي يبدأ الأحد (getDay: 0 = الأحد)
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  } else if (key === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (key === "3m") {
    start = addMonths(now, -3);
  } else if (key === "12m") {
    start = addMonths(now, -12);
  } else {
    return { start: null, end, prevStart: null, prevEnd: null }; // all
  }
  const len = end.getTime() - start.getTime();
  return { start, end, prevStart: new Date(start.getTime() - len), prevEnd: start };
}

function inWindow(at, start, end) {
  const t = toDateSafe(at)?.getTime();
  if (t == null) return false;
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}

export function inRange(at, range) {
  if (!range || !range.start) return true; // all
  return inWindow(at, range.start, range.end);
}

// ---------- الاستثناءات الأساسية ----------
/** الأعضاء المحسوبون: يستبعد المعطّل ومخفي الهوية ما لم يُطلب إظهارهم */
export function countedMembers(members, { includeHidden = false } = {}) {
  const list = Array.isArray(members) ? members : [];
  if (includeHidden) return list;
  return list.filter((m) => m.status !== "disabled" && !m.anonymized);
}

/** الحركات الرصيدية فقط — audit مستثناة دائماً مهما حملت من نقاط */
export function balanceTxs(transactions) {
  return (Array.isArray(transactions) ? transactions : []).filter((t) =>
    BALANCE_TX_TYPES.has(t.type)
  );
}

/** معرّفات الحركات المعكوسة (تُشتق من حركات reverse) */
export function reversedIds(transactions) {
  return new Set(
    (transactions || [])
      .filter((t) => t.type === "reverse" && t.reversesTxId)
      .map((t) => t.reversesTxId)
  );
}

/** حركات earn غير المعكوسة (أساس المبالغ والمتوسطات والعدادات) */
export function nonReversedEarns(transactions, range = null) {
  const rev = reversedIds(transactions);
  return balanceTxs(transactions).filter(
    (t) => t.type === "earn" && !(t.id && rev.has(t.id)) && (!range || inRange(t.at, range))
  );
}

// ---------- قيمة النقطة والالتزام القائم ----------
/**
 * قيمة النقطة بالريال — ديناميكية من الإعدادات:
 * value ÷ points لأصغر مكافأة نشطة (بالنقاط). 0 إن لا مكافآت نشطة.
 */
export function pointValueSAR(settings) {
  const active = (settings?.rewards || []).filter(
    (r) => r.active !== false && Number(r.points) > 0
  );
  if (!active.length) return 0;
  const smallest = active.reduce((a, b) => (Number(a.points) <= Number(b.points) ? a : b));
  return (Number(smallest.value) || 0) / Number(smallest.points);
}

/** الالتزام القائم بالريال = مجموع الأرصدة الموجبة للأعضاء المحسوبين × قيمة النقطة */
export function outstandingLiabilitySAR(members, settings, opts = {}) {
  const pv = pointValueSAR(settings);
  const totalPoints = countedMembers(members, opts).reduce(
    (sum, m) => sum + Math.max(0, Number(m.pointsBalance) || 0),
    0
  );
  return { points: totalPoints, sar: totalPoints * pv, pointValue: pv };
}

// ---------- بطاقات المؤشرات ----------
export function newMembersCount(members, range, opts = {}) {
  return countedMembers(members, opts).filter((m) => inRange(m.joinedAt, range)).length;
}

/**
 * نسبة العودة داخل الفترة: من له حركتا شراء (earn غير معكوسة) فأكثر،
 * منسوباً إلى من له حركة واحدة على الأقل.
 */
export function returnRate(transactions, range) {
  const counts = new Map();
  for (const t of nonReversedEarns(transactions, range)) {
    counts.set(t.memberId, (counts.get(t.memberId) || 0) + 1);
  }
  const buyers = counts.size;
  if (!buyers) return { buyers: 0, returners: 0, pct: 0 };
  let returners = 0;
  counts.forEach((c) => { if (c >= 2) returners++; });
  return { buyers, returners, pct: Math.round((returners / buyers) * 100) };
}

/**
 * المؤشران معتمدان كبطاقتين منفصلتين (قرار المرحلة 5):
 *   avgInvoice     = «متوسط الفاتورة»: مجموع مبالغ earn غير المعكوسة ÷ عدد الحركات
 *   avgMemberSpend = «متوسط إنفاق العضو»: المجموع ÷ عدد الأعضاء الذين
 *                    لهم حركة شراء واحدة على الأقل في الفترة
 */
export function purchaseAverages(transactions, range) {
  const earns = nonReversedEarns(transactions, range);
  const total = earns.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const buyers = new Set(earns.map((t) => t.memberId)).size;
  return {
    totalAmount: total,
    invoices: earns.length,
    buyers,
    avgInvoice: earns.length ? total / earns.length : 0,
    avgMemberSpend: buyers ? total / buyers : 0,
  };
}

// ---------- المصادر مع دلتا الفترة السابقة ----------
export function sourcesRanking(members, settings, range, opts = {}) {
  const labelOf = (id) =>
    (settings?.sources || []).find((s) => s.id === id)?.label || id || "غير محدد";
  const counted = countedMembers(members, opts);
  const countIn = (start, end) => {
    const map = new Map();
    for (const m of counted) {
      if (start === undefined ? !inRange(m.joinedAt, range) : !inWindow(m.joinedAt, start, end)) continue;
      const key = m.source || "unknown";
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  };
  const current = countIn();
  const hasPrev = !!(range && range.prevStart);
  const prev = hasPrev ? countIn(range.prevStart, range.prevEnd) : new Map();
  const keys = new Set([...current.keys(), ...prev.keys()]);
  return [...keys]
    .map((k) => ({
      id: k,
      label: k === "unknown" ? "غير محدد" : labelOf(k),
      count: current.get(k) || 0,
      prevCount: prev.get(k) || 0,
      delta: hasPrev ? (current.get(k) || 0) - (prev.get(k) || 0) : null,
    }))
    .sort((a, b) => b.count - a.count);
}

// ---------- التوزيعات ----------
/** توزيع الفئات — الفئة تُحسب لكل عضو من حركاته (نافذة الفئة من الإعدادات) */
export function tierDistribution(members, transactions, settings, now = new Date(), opts = {}) {
  const byMember = new Map();
  for (const t of balanceTxs(transactions)) {
    if (!byMember.has(t.memberId)) byMember.set(t.memberId, []);
    byMember.get(t.memberId).push(t);
  }
  // reverse تُقرأ من نفس قائمة العضو — أضفها (ليست ضمن balanceTxs؟ بلى ضمنها)
  const result = { none: 0 };
  for (const tr of settings?.tiers || []) result[tr.key] = 0;
  for (const m of countedMembers(members, opts)) {
    const { tier } = effectiveTier(m, byMember.get(m.id) || [], settings || {}, now);
    if (tier && result[tier.key] !== undefined) result[tier.key]++;
    else result.none++;
  }
  return result;
}

/** توزيع الجنس — الأعضاء القدامى بلا حقل يظهرون شريحة «غير مسجّل» */
export function genderDistribution(members, opts = {}) {
  const out = { male: 0, female: 0, unregistered: 0 };
  for (const m of countedMembers(members, opts)) {
    if (m.gender === "male") out.male++;
    else if (m.gender === "female") out.female++;
    else out.unregistered++;
  }
  return out;
}

// ---------- النقاط شهرياً: ممنوحة / مستبدلة / منتهية ----------
export function monthlyPoints(transactions, range) {
  const rev = reversedIds(transactions);
  const buckets = new Map(); // 'YYYY-MM' → {granted, redeemed, expired}
  for (const t of balanceTxs(transactions)) {
    if (t.id && rev.has(t.id)) continue;          // المعكوسة خارج الحساب
    if (t.type === "reverse") continue;            // حركة التصحيح نفسها ليست منحاً ولا استبدالاً
    if (range && !inRange(t.at, range)) continue;
    const d = toDateSafe(t.at);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets.has(key)) buckets.set(key, { month: key, granted: 0, redeemed: 0, expired: 0 });
    const b = buckets.get(key);
    const p = Number(t.points) || 0;
    if (t.type === "earn") b.granted += p;
    else if (t.type === "redeem") b.redeemed += -p;
    else if (t.type === "expire") b.expired += -p;
    // adjust: تسوية إدارية — خارج الأعمدة الثلاثة عمداً
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// ---------- القوائم ----------
/** الخاملون: بلا شراء منذ idleDays (افتراضي 90) — أو بلا شراء إطلاقاً */
export function idleMembers(members, idleDays = 90, now = new Date(), opts = {}) {
  const cutoff = now.getTime() - idleDays * 24 * 60 * 60 * 1000;
  return countedMembers(members, opts)
    .filter((m) => {
      const last = toDateSafe(m.lastPurchaseAt)?.getTime();
      return last == null || last < cutoff;
    })
    .sort((a, b) => {
      const ta = toDateSafe(a.lastPurchaseAt)?.getTime() ?? 0;
      const tb = toDateSafe(b.lastPurchaseAt)?.getTime() ?? 0;
      return ta - tb; // الأقدم أولاً
    });
}

/**
 * القريبون من مكافأة: رصيدهم 80–99% من عتبة المكافأة التالية
 * (أصغر مكافأة نشطة لم يبلغها الرصيد بعد).
 */
export function nearRewardMembers(members, settings, opts = {}) {
  const active = (settings?.rewards || [])
    .filter((r) => r.active !== false && Number(r.points) > 0)
    .sort((a, b) => Number(a.points) - Number(b.points));
  if (!active.length) return [];
  const out = [];
  for (const m of countedMembers(members, opts)) {
    const balance = Number(m.pointsBalance) || 0;
    if (balance <= 0) continue;
    const next = active.find((r) => Number(r.points) > balance);
    if (!next) continue; // بلغ كل العتبات
    const ratio = balance / Number(next.points);
    if (ratio >= 0.8 && ratio < 1) {
      out.push({ ...m, nextRewardLabel: next.label, nextRewardPoints: Number(next.points), progressPct: Math.round(ratio * 100) });
    }
  }
  return out.sort((a, b) => b.progressPct - a.progressPct);
}

/** أعلى المنفقين (earn غير معكوسة داخل الفترة) */
export function topSpenders(members, transactions, range, limit = 20, opts = {}) {
  const counted = new Map(countedMembers(members, opts).map((m) => [m.id, m]));
  const agg = new Map(); // memberId → {amount, invoices}
  for (const t of nonReversedEarns(transactions, range)) {
    if (!counted.has(t.memberId)) continue;
    if (!agg.has(t.memberId)) agg.set(t.memberId, { amount: 0, invoices: 0 });
    const a = agg.get(t.memberId);
    a.amount += Number(t.amount) || 0;
    a.invoices += 1;
  }
  return [...agg.entries()]
    .map(([id, a]) => ({ ...counted.get(id), spendAmount: a.amount, spendInvoices: a.invoices }))
    .sort((a, b) => b.spendAmount - a.spendAmount)
    .slice(0, limit);
}

/**
 * النقاط الممنوحة لكل موظف — التجميع على byUid، والاسم المعروض هو
 * آخر byName مسجَّل لذلك الـ uid (الأحدث بتاريخ الحركة) حتى لا يظهر
 * الموظف باسم قديم بعد تغيير مسمّاه (قرار المرحلة 5).
 */
export function pointsByEmployee(transactions, range) {
  const agg = new Map(); // uid → {points, invoices, amount, name, lastAt}
  for (const t of nonReversedEarns(transactions, range)) {
    const uid = t.byUid || "unknown";
    if (!agg.has(uid)) agg.set(uid, { uid, points: 0, invoices: 0, amount: 0, name: "", lastAt: -1 });
    const a = agg.get(uid);
    a.points += Number(t.points) || 0;
    a.invoices += 1;
    a.amount += Number(t.amount) || 0;
    const at = toDateSafe(t.at)?.getTime() ?? 0;
    if (at >= a.lastAt) { a.lastAt = at; a.name = t.byName || a.name; }
  }
  return [...agg.values()]
    .map((r) => ({ uid: r.uid, points: r.points, invoices: r.invoices, amount: r.amount, name: r.name }))
    .sort((a, b) => b.points - a.points);
}

// ---------- CSV ----------
/** سلسلة CSV بترويسة UTF-8 BOM (لعرض العربية سليمة في Excel) */
export function toCsvString(rows) {
  const escapeCell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + (rows || []).map((r) => r.map(escapeCell).join(",")).join("\n");
}
