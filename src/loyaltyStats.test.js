// src/loyaltyStats.test.js
// ====================================================================
// اختبارات vitest لتجميعات الإحصائيات — النسخة 3.0 (هللات صحيحة):
//   • الالتزام القائم = مجموع الأرصدة الموجبة مباشرة (بلا معامل تحويل)
//   • استثناء حركات audit صراحةً من كل الحسابات (شرط إلزامي)
//   • استثناء المعطّلين ومخفيي الهوية مع خيار الإظهار
//   • المتوسطان المنفصلان (الفاتورة / إنفاق العضو) بالهللات
//   • «القريبون من الترقية» 80–99% من عتبة الفئة التالية
//   • الرصيد شهرياً (الترحيبية ضمن «ممنوح»)
//   • توزيع اللغة وعدد التسجيلات لكل موظف
//   • الفترات ودلتا الفترة السابقة
// ====================================================================
import { describe, it, expect } from 'vitest';
import {
  periodRange,
  countedMembers,
  outstandingLiability,
  returnRate,
  purchaseAverages,
  sourcesRanking,
  genderDistribution,
  languageDistribution,
  monthlyCredit,
  idleMembers,
  nearUpgradeMembers,
  topSpenders,
  creditByEmployee,
  registrationsByEmployee,
  toCsvString,
} from './loyaltyStats';

const NOW = new Date(2026, 7, 15); // 2026-08-15 (سبت)

const SETTINGS = {
  tierWindowMonths: 24,
  tiers: [
    { key: 'silver', name: { ar: 'فضية', en: 'Silver' }, minEarnedHalalas: 0, ratePercent: 2.5 },
    { key: 'gold', name: { ar: 'ذهبية', en: 'Gold' }, minEarnedHalalas: 5000, ratePercent: 2.75 },
    { key: 'platinum', name: { ar: 'بلاتينية', en: 'Platinum' }, minEarnedHalalas: 10000, ratePercent: 3 },
  ],
  sources: [
    { id: 'maps', label: 'قوقل ماب', active: true },
    { id: 'friend', label: 'توصية صديق', active: true },
  ],
};

const MEMBERS = [
  { id: 'm1', name: 'أ', balanceHalalas: 600, status: 'active', gender: 'male', language: 'ar',
    createdBy: 'u1', createdByName: 'موظف أول',
    joinedAt: new Date(2026, 7, 3), source: 'maps', lastPurchaseAt: new Date(2026, 7, 10) },
  { id: 'm2', name: 'ب', balanceHalalas: 700, status: 'active', gender: 'female', language: 'en',
    createdBy: 'u2', createdByName: 'موظف ثانٍ',
    // 20 يوليو: داخل «الفترة السابقة» لفلتر هذا الشهر (14 يوماً قبل 1 أغسطس)
    joinedAt: new Date(2026, 6, 20), source: 'friend', lastPurchaseAt: new Date(2026, 2, 1) },
  { id: 'm3', name: 'ج', balanceHalalas: -50, status: 'active',
    createdBy: 'u1', createdByName: 'موظف أول',
    joinedAt: new Date(2025, 0, 1), source: 'maps', lastPurchaseAt: null },
  { id: 'm4', name: 'معطّل', balanceHalalas: 900, status: 'disabled',
    joinedAt: new Date(2026, 7, 5), source: 'maps' },
  { id: 'm5', name: 'عضو محذوف', balanceHalalas: 400, status: 'active', anonymized: true,
    joinedAt: new Date(2026, 7, 6), source: 'friend' },
];

describe('استثناء المعطّلين ومخفيي الهوية', () => {
  it('العد الأساسي يستبعدهما، وincludeHidden يظهرهما', () => {
    expect(countedMembers(MEMBERS).map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(countedMembers(MEMBERS, { includeHidden: true })).toHaveLength(5);
  });
});

describe('الالتزام القائم — مجموع الأرصدة الموجبة مباشرة (بلا معامل تحويل)', () => {
  it('أرصدة موجبة فقط، بلا المعطّل ومخفي الهوية', () => {
    const { halalas } = outstandingLiability(MEMBERS);
    expect(halalas).toBe(1300); // 600 + 700، السالب والمعطّل والمخفي خارجها
  });

  it('includeHidden يضيف أرصدتهم الموجبة', () => {
    const { halalas } = outstandingLiability(MEMBERS, { includeHidden: true });
    expect(halalas).toBe(1300 + 900 + 400);
  });
});

describe('استثناء حركات audit من كل الحسابات (شرط إلزامي)', () => {
  const range = periodRange('all', NOW);
  const base = [
    { id: 'e1', type: 'earn', memberId: 'm1', deltaHalalas: 250, amountHalalas: 10000, byUid: 'u1', byName: 'موظف', at: new Date(2026, 7, 1) },
    { id: 'e2', type: 'earn', memberId: 'm1', deltaHalalas: 125, amountHalalas: 5000, byUid: 'u1', byName: 'موظف', at: new Date(2026, 7, 2) },
  ];
  // حركات audit بقيم/مبالغ خاطئة متعمدة — يجب ألا تؤثر على أي رقم
  const withAudit = [
    ...base,
    { id: 'a1', type: 'audit', memberId: 'm1', deltaHalalas: 99999, amountHalalas: 99999, byUid: 'u1', byName: 'موظف', at: new Date(2026, 7, 3) },
    { id: 'a2', type: 'audit', memberId: 'm9', deltaHalalas: -5000, amountHalalas: 777, byUid: 'u2', byName: 'آخر', at: new Date(2026, 7, 4) },
  ];

  it('المتوسطات والعدادات لا تتغير بوجود audit', () => {
    expect(purchaseAverages(withAudit, range)).toEqual(purchaseAverages(base, range));
    expect(purchaseAverages(withAudit, range).invoices).toBe(2);
  });

  it('نسبة العودة والرصيد الشهري والموظفون لا يتأثرون بها', () => {
    expect(returnRate(withAudit, range)).toEqual(returnRate(base, range));
    expect(monthlyCredit(withAudit, range)).toEqual(monthlyCredit(base, range));
    expect(creditByEmployee(withAudit, range)).toEqual(creditByEmployee(base, range));
  });
});

describe('المتوسطان المنفصلان — بالهللات', () => {
  const range = periodRange('all', NOW);
  const txs = [
    { id: 't1', type: 'earn', memberId: 'm1', amountHalalas: 10000, deltaHalalas: 250, at: new Date(2026, 7, 1) },
    { id: 't2', type: 'earn', memberId: 'm1', amountHalalas: 20000, deltaHalalas: 500, at: new Date(2026, 7, 2) },
    { id: 't3', type: 'earn', memberId: 'm2', amountHalalas: 30000, deltaHalalas: 750, at: new Date(2026, 7, 3) },
  ];

  it('متوسط الفاتورة ÷ الحركات، ومتوسط إنفاق العضو ÷ المشترين', () => {
    const a = purchaseAverages(txs, range);
    expect(a.avgInvoiceHalalas).toBeCloseTo(60000 / 3);   // 20000 هللة = 200 ريال
    expect(a.avgMemberSpendHalalas).toBeCloseTo(60000 / 2); // 30000 — عضوان فقط اشتريا
    expect(a.buyers).toBe(2);
  });

  it('الحركة المعكوسة تخرج من المؤشرين', () => {
    const withReverse = [...txs,
      { id: 'r1', type: 'reverse', memberId: 'm2', reversesTxId: 't3', deltaHalalas: -750, at: new Date(2026, 7, 4) }];
    const a = purchaseAverages(withReverse, range);
    expect(a.totalHalalas).toBe(30000);
    expect(a.buyers).toBe(1); // m2 خرج بالكامل
    expect(a.avgMemberSpendHalalas).toBeCloseTo(30000);
  });
});

describe('الرصيد شهرياً: ممنوح / مستبدل / منتهٍ — الترحيبية ضمن «ممنوح»', () => {
  const range = periodRange('all', NOW);
  const txs = [
    { id: 'w1', type: 'welcome', memberId: 'm1', deltaHalalas: 500, at: new Date(2026, 6, 10) },
    { id: 'e1', type: 'earn', memberId: 'm1', deltaHalalas: 375, at: new Date(2026, 6, 15) },
    { id: 'd1', type: 'redeem', memberId: 'm1', deltaHalalas: -200, at: new Date(2026, 7, 1) },
    { id: 'x1', type: 'expire', memberId: 'm2', deltaHalalas: -675, at: new Date(2026, 7, 2) },
    { id: 'j1', type: 'adjust', memberId: 'm1', deltaHalalas: 50, at: new Date(2026, 7, 3) }, // خارج الأعمدة الثلاثة
  ];

  it('الترحيبية تُحتسب ضمن الممنوح، والأعمدة الثلاثة بالهللات', () => {
    const rows = monthlyCredit(txs, range);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ month: '2026-07', grantedHalalas: 875, redeemedHalalas: 0, expiredHalalas: 0 });
    expect(rows[1]).toEqual({ month: '2026-08', grantedHalalas: 0, redeemedHalalas: 200, expiredHalalas: 675 });
  });

  it('earn المعكوسة تخرج من الممنوح', () => {
    const withReverse = [...txs,
      { id: 'r1', type: 'reverse', memberId: 'm1', reversesTxId: 'e1', deltaHalalas: -375, at: new Date(2026, 7, 4) }];
    const rows = monthlyCredit(withReverse, range);
    expect(rows[0].grantedHalalas).toBe(500); // الترحيبية فقط
  });
});

describe('القريبون من الترقية — 80–99% من عتبة الفئة التالية', () => {
  const mk = (id, earned) => ({
    member: { id, name: id, balanceHalalas: earned, status: 'active' },
    tx: { id: `e-${id}`, type: 'earn', memberId: id, deltaHalalas: earned, at: new Date(2026, 7, 1) },
  });
  const run = (earned) => {
    const { member, tx } = mk('x', earned);
    return nearUpgradeMembers([member], earned > 0 ? [tx] : [], SETTINGS, NOW);
  };

  it('عتبة الذهبية 5000: تحت 80% خارج، 80–99% داخل، 100% خارج (بلغها)', () => {
    expect(run(3999)).toHaveLength(0);  // 79.98%
    expect(run(4000)).toHaveLength(1);  // 80%
    expect(run(4999)).toHaveLength(1);  // 99.98%
    expect(run(5000)).toHaveLength(0);  // بلغها — يُقاس الآن على البلاتينية 10000 ونسبته 50%
  });

  it('من بلغ الذهبية يُقاس على عتبة البلاتينية', () => {
    // 8000/10000 = 80% من عتبة البلاتينية → داخل النطاق
    const rows = run(8000);
    expect(rows).toHaveLength(1);
    expect(rows[0].nextTierKey).toBe('platinum');
    expect(rows[0].nextTierMinHalalas).toBe(10000);
    expect(rows[0].remainingHalalas).toBe(2000);
    expect(rows[0].progressPct).toBe(80);
    // 7000/10000 = 70% → خارج
    expect(run(7000)).toHaveLength(0);
  });

  it('في أعلى فئة → لا يظهر', () => {
    expect(run(10000)).toHaveLength(0);
    expect(run(15000)).toHaveLength(0);
  });

  it('الترحيبية والاستبدال لا يؤثران على القياس (المكتسب من earn فقط)', () => {
    const { member, tx } = mk('x', 4000);
    const txs = [tx,
      { id: 'w', type: 'welcome', memberId: 'x', deltaHalalas: 5000, at: new Date(2026, 7, 1) },
      { id: 'd', type: 'redeem', memberId: 'x', deltaHalalas: -3000, at: new Date(2026, 7, 2) }];
    const rows = nearUpgradeMembers([member], txs, SETTINGS, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].earnedHalalas).toBe(4000);
  });
});

describe('آخر byName للموظف لا أوله (قرار المرحلة 5)', () => {
  const range = periodRange('all', NOW);
  const txs = [
    { id: 't1', type: 'earn', memberId: 'm1', deltaHalalas: 100, amountHalalas: 2000, byUid: 'u1', byName: 'الاسم القديم', at: new Date(2026, 5, 1) },
    { id: 't2', type: 'earn', memberId: 'm2', deltaHalalas: 200, amountHalalas: 4000, byUid: 'u1', byName: 'الاسم الجديد', at: new Date(2026, 7, 1) },
  ];
  it('يجمع على uid ويعرض الاسم الأحدث', () => {
    const rows = creditByEmployee(txs, range);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('الاسم الجديد');
    expect(rows[0].earnedHalalas).toBe(300);
    expect(rows[0].invoices).toBe(2);
    expect(rows[0].amountHalalas).toBe(6000);
  });
});

describe('عدد التسجيلات لكل موظف (حماية من التلاعب)', () => {
  it('يجمع المنضمين في الفترة على createdBy', () => {
    const range = periodRange('all', NOW);
    const rows = registrationsByEmployee(MEMBERS, range);
    // m1+m3 لموظف u1، وm2 لموظف u2 (المعطّل والمخفي خارج العد)
    expect(rows[0]).toMatchObject({ uid: 'u1', count: 2, name: 'موظف أول' });
    expect(rows[1]).toMatchObject({ uid: 'u2', count: 1, name: 'موظف ثانٍ' });
  });

  it('يحترم الفترة المحددة', () => {
    const range = periodRange('month', NOW); // أغسطس فقط
    const rows = registrationsByEmployee(MEMBERS, range);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ uid: 'u1', count: 1 }); // m1 فقط
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
    expect(friend.prevCount).toBe(1); // m2 انضم 20 يوليو ضمن الفترة السابقة
    expect(friend.delta).toBe(-1);
  });
});

describe('توزيع الجنس واللغة والخاملون', () => {
  it('غير المسجّل شريحة مستقلة في الجنس', () => {
    expect(genderDistribution(MEMBERS)).toEqual({ male: 1, female: 1, unregistered: 1 });
  });

  it('توزيع اللغة: ar / en / غير مسجّل', () => {
    expect(languageDistribution(MEMBERS)).toEqual({ ar: 1, en: 1, unregistered: 1 });
  });

  it('الخاملون: بلا شراء منذ 90 يوماً أو إطلاقاً، الأقدم أولاً', () => {
    const idle = idleMembers(MEMBERS, 90, NOW);
    expect(idle.map((m) => m.id)).toEqual(['m3', 'm2']); // m3 بلا شراء، m2 من مارس
    expect(idleMembers(MEMBERS, 400, NOW).map((m) => m.id)).toEqual(['m3']);
  });
});

describe('التكامل مع الكاش — بيانات مرّت بـ JSON round-trip (خلل الأصفار Batch 91.3)', () => {
  it('نفس النتائج للبيانات الحية والمُحياة من الكاش (متوسطات ورصيد شهري)', () => {
    const liveTs = {
      seconds: Math.floor(new Date(2026, 7, 3).getTime() / 1000),
      nanoseconds: 0,
      toDate() { return new Date(this.seconds * 1000); },
    };
    const liveTxs = [{ id: 't1', type: 'earn', memberId: 'm1', amountHalalas: 10000, deltaHalalas: 250, at: liveTs }];
    const revivedTxs = JSON.parse(JSON.stringify(liveTxs)); // ما يعيده كاش sessionStorage فعلاً
    const range = periodRange('month', new Date(2026, 7, 15));

    const live = purchaseAverages(liveTxs, range);
    const revived = purchaseAverages(revivedTxs, range);
    expect(revived.avgInvoiceHalalas).toBe(live.avgInvoiceHalalas);
    expect(revived.avgInvoiceHalalas).toBe(10000);
    expect(revived.buyers).toBe(1);
    expect(monthlyCredit(revivedTxs, range)).toEqual(monthlyCredit(liveTxs, range));
  });
});

describe('أعلى المنفقين وCSV', () => {
  const range = periodRange('all', NOW);
  it('يجمع مبالغ earn غير المعكوسة ويستبعد غير المحسوبين', () => {
    const txs = [
      { id: 't1', type: 'earn', memberId: 'm1', amountHalalas: 50000, deltaHalalas: 1, at: new Date(2026, 7, 1) },
      { id: 't2', type: 'earn', memberId: 'm2', amountHalalas: 90000, deltaHalalas: 1, at: new Date(2026, 7, 2) },
      { id: 't3', type: 'earn', memberId: 'm5', amountHalalas: 500000, deltaHalalas: 1, at: new Date(2026, 7, 3) }, // مخفي الهوية
    ];
    const top = topSpenders(MEMBERS, txs, range, 20);
    expect(top.map((m) => m.id)).toEqual(['m2', 'm1']);
    expect(top[0].spendHalalas).toBe(90000);
  });

  it('CSV: ترويسة BOM وحماية الفواصل والاقتباسات', () => {
    const csv = toCsvString([[ 'الاسم', 'ملاحظة' ], ['أحمد', 'قال "مرحبا"، وذهب']]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('"قال ""مرحبا""، وذهب"');
  });
});
