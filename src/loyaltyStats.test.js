// src/loyaltyStats.test.js
// ====================================================================
// اختبارات vitest لتجميعات الإحصائيات (المرحلة 5):
//   • قيمة النقطة الديناميكية والالتزام القائم (لا رقم ثابت)
//   • استثناء حركات audit صراحةً من كل الحسابات (شرط إلزامي)
//   • استثناء المعطّلين ومخفيي الهوية مع خيار الإظهار
//   • المتوسطان المنفصلان (الفاتورة / إنفاق العضو)
//   • حدود «القريبون من مكافأة» 80–99%
//   • آخر byName للموظف (لا أول اسم)
//   • الفترات ودلتا الفترة السابقة
// ====================================================================
import { describe, it, expect } from 'vitest';
import {
  periodRange,
  countedMembers,
  pointValueSAR,
  outstandingLiabilitySAR,
  returnRate,
  purchaseAverages,
  sourcesRanking,
  genderDistribution,
  monthlyPoints,
  idleMembers,
  nearRewardMembers,
  topSpenders,
  pointsByEmployee,
  toCsvString,
} from './loyaltyStats';

const NOW = new Date(2026, 7, 15); // 2026-08-15 (سبت)

const SETTINGS = {
  tierWindowMonths: 24,
  tiers: [
    { key: 'silver', name: 'فضية', min: 1, max: 7500 },
    { key: 'gold', name: 'ذهبية', min: 7501, max: 20000 },
    { key: 'platinum', name: 'بلاتينية', min: 20001, max: null },
  ],
  rewards: [
    { id: 'r50', label: 'باقة 50', value: 50, points: 7500, active: true },
    { id: 'r75', label: 'باقة 75', value: 75, points: 11250, active: true },
  ],
  sources: [
    { id: 'maps', label: 'قوقل ماب', active: true },
    { id: 'friend', label: 'توصية صديق', active: true },
  ],
};

const MEMBERS = [
  { id: 'm1', name: 'أ', pointsBalance: 6000, status: 'active', gender: 'male',
    joinedAt: new Date(2026, 7, 3), source: 'maps', lastPurchaseAt: new Date(2026, 7, 10) },
  { id: 'm2', name: 'ب', pointsBalance: 7000, status: 'active', gender: 'female',
    // 20 يوليو: داخل «الفترة السابقة» لفلتر هذا الشهر (14 يوماً قبل 1 أغسطس)
    joinedAt: new Date(2026, 6, 20), source: 'friend', lastPurchaseAt: new Date(2026, 2, 1) },
  { id: 'm3', name: 'ج', pointsBalance: -500, status: 'active',
    joinedAt: new Date(2025, 0, 1), source: 'maps', lastPurchaseAt: null },
  { id: 'm4', name: 'معطّل', pointsBalance: 9000, status: 'disabled',
    joinedAt: new Date(2026, 7, 5), source: 'maps' },
  { id: 'm5', name: 'عضو محذوف', pointsBalance: 4000, status: 'active', anonymized: true,
    joinedAt: new Date(2026, 7, 6), source: 'friend' },
];

describe('استثناء المعطّلين ومخفيي الهوية', () => {
  it('العد الأساسي يستبعدهما، وincludeHidden يظهرهما', () => {
    expect(countedMembers(MEMBERS).map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(countedMembers(MEMBERS, { includeHidden: true })).toHaveLength(5);
  });
});

describe('قيمة النقطة والالتزام القائم — ديناميكيان', () => {
  it('قيمة النقطة = value ÷ points لأصغر مكافأة نشطة', () => {
    expect(pointValueSAR(SETTINGS)).toBeCloseTo(50 / 7500);
    // تعطيل الأصغر → تُحسب من التالية (لا رقم ثابت في أي مكان)
    const s2 = { ...SETTINGS, rewards: [{ ...SETTINGS.rewards[0], active: false }, SETTINGS.rewards[1]] };
    expect(pointValueSAR(s2)).toBeCloseTo(75 / 11250);
    expect(pointValueSAR({ rewards: [] })).toBe(0);
  });

  it('الالتزام: أرصدة موجبة فقط، بلا المعطّل ومخفي الهوية', () => {
    const { points, sar } = outstandingLiabilitySAR(MEMBERS, SETTINGS);
    expect(points).toBe(13000); // 6000 + 7000، السالب والمعطّل والمخفي خارجها
    expect(sar).toBeCloseTo(13000 * (50 / 7500));
  });
});

describe('استثناء حركات audit من كل الحسابات (شرط إلزامي)', () => {
  const range = periodRange('all', NOW);
  const base = [
    { id: 'e1', type: 'earn', memberId: 'm1', points: 500, amount: 100, byUid: 'u1', byName: 'موظف', at: new Date(2026, 7, 1) },
    { id: 'e2', type: 'earn', memberId: 'm1', points: 250, amount: 50, byUid: 'u1', byName: 'موظف', at: new Date(2026, 7, 2) },
  ];
  // حركات audit بقيم نقاط/مبالغ خاطئة متعمدة — يجب ألا تؤثر على أي رقم
  const withAudit = [
    ...base,
    { id: 'a1', type: 'audit', memberId: 'm1', points: 99999, amount: 99999, byUid: 'u1', byName: 'موظف', at: new Date(2026, 7, 3) },
    { id: 'a2', type: 'audit', memberId: 'm9', points: -5000, amount: 777, byUid: 'u2', byName: 'آخر', at: new Date(2026, 7, 4) },
  ];

  it('المتوسطات والعدادات لا تتغير بوجود audit', () => {
    expect(purchaseAverages(withAudit, range)).toEqual(purchaseAverages(base, range));
    expect(purchaseAverages(withAudit, range).invoices).toBe(2);
  });

  it('نسبة العودة والنقاط الشهرية والموظفون لا يتأثرون بها', () => {
    expect(returnRate(withAudit, range)).toEqual(returnRate(base, range));
    expect(monthlyPoints(withAudit, range)).toEqual(monthlyPoints(base, range));
    expect(pointsByEmployee(withAudit, range)).toEqual(pointsByEmployee(base, range));
  });
});

describe('المتوسطان المنفصلان (قرار المرحلة 5)', () => {
  const range = periodRange('all', NOW);
  const txs = [
    { id: 't1', type: 'earn', memberId: 'm1', amount: 100, points: 500, at: new Date(2026, 7, 1) },
    { id: 't2', type: 'earn', memberId: 'm1', amount: 200, points: 1000, at: new Date(2026, 7, 2) },
    { id: 't3', type: 'earn', memberId: 'm2', amount: 300, points: 1500, at: new Date(2026, 7, 3) },
  ];

  it('متوسط الفاتورة ÷ الحركات، ومتوسط إنفاق العضو ÷ المشترين', () => {
    const a = purchaseAverages(txs, range);
    expect(a.avgInvoice).toBeCloseTo(600 / 3);   // 200
    expect(a.avgMemberSpend).toBeCloseTo(600 / 2); // 300 — عضوان فقط اشتريا
    expect(a.buyers).toBe(2);
  });

  it('الحركة المعكوسة تخرج من المؤشرين', () => {
    const withReverse = [...txs,
      { id: 'r1', type: 'reverse', memberId: 'm2', reversesTxId: 't3', points: -1500, at: new Date(2026, 7, 4) }];
    const a = purchaseAverages(withReverse, range);
    expect(a.totalAmount).toBe(300);
    expect(a.buyers).toBe(1); // m2 خرج بالكامل
    expect(a.avgMemberSpend).toBeCloseTo(300);
  });
});

describe('القريبون من مكافأة — حدود 80–99%', () => {
  const mk = (id, balance) => ({ id, name: id, pointsBalance: balance, status: 'active' });
  const pct = (balance) =>
    nearRewardMembers([mk('x', balance)], SETTINGS).length;

  it('العتبة الأولى 7500: تحت 80% خارج، 80–99% داخل، 100% خارج (فتحها)', () => {
    expect(pct(5999)).toBe(0);  // 79.99%
    expect(pct(6000)).toBe(1);  // 80%
    expect(pct(7424)).toBe(1);  // 98.99%
    expect(pct(7425)).toBe(1);  // 99%
    expect(pct(7500)).toBe(0);  // بلغها — العتبة التالية 11250 ونسبته 66%
  });

  it('من فتح الأولى يُقاس على العتبة التالية', () => {
    // 9500/11250 = 84.4% من العتبة الثانية → داخل النطاق
    const rows = nearRewardMembers([mk('x', 9500)], SETTINGS);
    expect(rows).toHaveLength(1);
    expect(rows[0].nextRewardPoints).toBe(11250);
    expect(rows[0].progressPct).toBe(84);
    // 8000/11250 = 71% → خارج
    expect(nearRewardMembers([mk('y', 8000)], SETTINGS)).toHaveLength(0);
  });
});

describe('آخر byName للموظف لا أوله (قرار المرحلة 5)', () => {
  const range = periodRange('all', NOW);
  const txs = [
    { id: 't1', type: 'earn', memberId: 'm1', points: 100, amount: 20, byUid: 'u1', byName: 'الاسم القديم', at: new Date(2026, 5, 1) },
    { id: 't2', type: 'earn', memberId: 'm2', points: 200, amount: 40, byUid: 'u1', byName: 'الاسم الجديد', at: new Date(2026, 7, 1) },
  ];
  it('يجمع على uid ويعرض الاسم الأحدث', () => {
    const rows = pointsByEmployee(txs, range);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('الاسم الجديد');
    expect(rows[0].points).toBe(300);
    expect(rows[0].invoices).toBe(2);
  });
});

describe('الفترات ودلتا المصادر', () => {
  it('week تبدأ الأحد، والفترة السابقة مساوية مباشرة', () => {
    const r = periodRange('week', NOW); // NOW سبت 2026-08-15
    expect(r.start.getDay()).toBe(0);   // الأحد
    expect(r.start.getDate()).toBe(9);  // الأحد 2026-08-09
    expect(r.prevEnd.getTime()).toBe(r.start.getTime());
    expect(r.end.getTime() - r.start.getTime()).toBe(r.prevEnd.getTime() - r.prevStart.getTime());
    expect(periodRange('all', NOW).start).toBe(null);
  });

  it('ترتيب المصادر مع دلتا الفترة السابقة', () => {
    const range = periodRange('month', NOW); // أغسطس (السابقة: مدة مساوية من يوليو)
    const rows = sourcesRanking(MEMBERS, SETTINGS, range);
    const maps = rows.find((r) => r.id === 'maps');
    const friend = rows.find((r) => r.id === 'friend');
    expect(maps.count).toBe(1);      // m1 فقط (المعطّل والمخفي خارج العد)
    expect(friend.count).toBe(0);
    expect(friend.prevCount).toBe(1); // m2 انضم 10 يوليو ضمن الفترة السابقة
    expect(friend.delta).toBe(-1);
  });
});

describe('توزيع الجنس والخاملون', () => {
  it('غير المسجّل شريحة مستقلة', () => {
    expect(genderDistribution(MEMBERS)).toEqual({ male: 1, female: 1, unregistered: 1 });
  });

  it('الخاملون: بلا شراء منذ 90 يوماً أو إطلاقاً، الأقدم أولاً', () => {
    const idle = idleMembers(MEMBERS, 90, NOW);
    expect(idle.map((m) => m.id)).toEqual(['m3', 'm2']); // m3 بلا شراء، m2 من مارس
    expect(idleMembers(MEMBERS, 400, NOW).map((m) => m.id)).toEqual(['m3']);
  });
});

describe('أعلى المنفقين وCSV', () => {
  const range = periodRange('all', NOW);
  it('يجمع مبالغ earn غير المعكوسة ويستبعد غير المحسوبين', () => {
    const txs = [
      { id: 't1', type: 'earn', memberId: 'm1', amount: 500, points: 1, at: new Date(2026, 7, 1) },
      { id: 't2', type: 'earn', memberId: 'm2', amount: 900, points: 1, at: new Date(2026, 7, 2) },
      { id: 't3', type: 'earn', memberId: 'm5', amount: 5000, points: 1, at: new Date(2026, 7, 3) }, // مخفي الهوية
    ];
    const top = topSpenders(MEMBERS, txs, range, 20);
    expect(top.map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(top[0].spendAmount).toBe(900);
  });

  it('CSV: ترويسة BOM وحماية الفواصل والاقتباسات', () => {
    const csv = toCsvString([[ 'الاسم', 'ملاحظة' ], ['أحمد', 'قال "مرحبا"، وذهب']]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('"قال ""مرحبا""، وذهب"');
  });
});
