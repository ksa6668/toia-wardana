// src/loyaltyMath.test.js
// ====================================================================
// اختبارات vitest لمنطق الولاء النقي (loyaltyMath.js) — بلا Firebase.
// النسخة 3.0: رصيد بالريال (هللات صحيحة) — الكسب بالنسبة والتقريب لأقرب
// ربع ريال، الفئة بعتبات المكتسب، الترحيبية المعلّقة، وانتهاء الرصيد.
// ====================================================================
import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  toEnglishDigits,
  toDateSafe,
  riyalsToHalalas,
  halalasToRiyalLabel,
  countedAmountHalalas,
  computeEarnedHalalas,
  deriveBalance,
  addMonths,
  addHours,
  computeExpiryAt,
  isBalanceExpired,
  earnedHalalasInWindow,
  tierForEarned,
  nextTierInfo,
  isManualTierActive,
  effectiveTier,
  tierName,
  availableBalanceHalalas,
  isWelcomeOnHold,
  welcomeAvailableAt,
  isValidRedeemAmount,
  invoiceDocId,
  randomMemberNo,
  randomCardToken,
  storeLetter,
} from './loyaltyMath';

// نفس افتراضيات النسخة 3.0
const SETTINGS = {
  amountBasis: 'gross',
  vatRate: 0.15,
  expiryMonths: 12,
  tierWindowMonths: 24,
  earnRoundingHalalas: 25,
  redeemStepHalalas: 25,
  welcomeBonusHalalas: 500,
  welcomeBonusDelayHours: 24,
  tiers: [
    { key: 'silver', name: { ar: 'فضية', en: 'Silver' }, minEarnedHalalas: 0, ratePercent: 2.5 },
    { key: 'gold', name: { ar: 'ذهبية', en: 'Gold' }, minEarnedHalalas: 5000, ratePercent: 2.75 },
    { key: 'platinum', name: { ar: 'بلاتينية', en: 'Platinum' }, minEarnedHalalas: 10000, ratePercent: 3 },
  ],
};

describe('توحيد رقم الجوال', () => {
  it('0501234567 و +966501234567 يتوحدان لنفس الصيغة (معيار قبول)', () => {
    expect(normalizePhone('0501234567')).toBe('+966501234567');
    expect(normalizePhone('+966501234567')).toBe('+966501234567');
    expect(normalizePhone('0501234567')).toBe(normalizePhone('+966501234567'));
  });

  it('يقبل كل الصيغ الشائعة', () => {
    expect(normalizePhone('501234567')).toBe('+966501234567');
    expect(normalizePhone('966501234567')).toBe('+966501234567');
    expect(normalizePhone('00966501234567')).toBe('+966501234567');
    expect(normalizePhone('050 123 4567')).toBe('+966501234567');
    expect(normalizePhone('050-123-4567')).toBe('+966501234567');
  });

  it('يحوّل الأرقام العربية', () => {
    expect(normalizePhone('٠٥٠١٢٣٤٥٦٧')).toBe('+966501234567');
    expect(toEnglishDigits('١٢٣٤٥')).toBe('12345');
  });

  it('يرفض الصيغ غير الصالحة', () => {
    expect(normalizePhone('')).toBe(null);
    expect(normalizePhone(null)).toBe(null);
    expect(normalizePhone('12345')).toBe(null);
    expect(normalizePhone('0601234567')).toBe(null);   // ليس 05
    expect(normalizePhone('05012345678')).toBe(null);  // رقم زائد
    expect(normalizePhone('050123456')).toBe(null);    // رقم ناقص
    expect(normalizePhone('abc0501234567')).toBe(null);
  });
});

describe('تحويل العملة — هللات صحيحة، والعرض بالريال عند الرسم فقط', () => {
  it('riyalsToHalalas: ريال (نص/كسور/أرقام عربية) → هللات صحيحة', () => {
    expect(riyalsToHalalas('150')).toBe(15000);
    expect(riyalsToHalalas('3.75')).toBe(375);
    expect(riyalsToHalalas('0.25')).toBe(25);
    expect(riyalsToHalalas('١٥٠')).toBe(15000);
    expect(riyalsToHalalas('abc')).toBe(null);
    expect(riyalsToHalalas('')).toBe(0); // Number('') = 0 — الواجهة تتحقق من الفراغ قبلها
  });

  it('halalasToRiyalLabel: 375 → "3.75" و400 → "4" و-1050 → "-10.50"', () => {
    expect(halalasToRiyalLabel(375)).toBe('3.75');
    expect(halalasToRiyalLabel(400)).toBe('4');
    expect(halalasToRiyalLabel(450)).toBe('4.50');
    expect(halalasToRiyalLabel(-1050)).toBe('-10.50');
    expect(halalasToRiyalLabel(0)).toBe('0');
    expect(halalasToRiyalLabel(123456)).toBe('1,234.56');
  });
});

describe('الكسب والتقريب لأقرب ربع ريال (معايير قبول 3.0)', () => {
  const earn = (riyals, rate) => computeEarnedHalalas(riyals * 100, rate, SETTINGS);

  it('فاتورة 7 ريالات: كل النسب الثلاث → 25 هللة (ربع ريال)', () => {
    expect(earn(7, 2.5)).toBe(25);   // 17.5 → أقرب مضاعف 25
    expect(earn(7, 2.75)).toBe(25);  // 19.25
    expect(earn(7, 3)).toBe(25);     // 21
  });

  it('فاتورة 30 ريالاً: فضية 75 • ذهبية 75 • بلاتينية 100 هللة', () => {
    expect(earn(30, 2.5)).toBe(75);   // 75 بالضبط
    expect(earn(30, 2.75)).toBe(75);  // 82.5 → 75
    expect(earn(30, 3)).toBe(100);    // 90 → 100
  });

  it('فاتورة 87 ريالاً: فضية 225 • ذهبية 250 • بلاتينية 250 هللة', () => {
    expect(earn(87, 2.5)).toBe(225);  // 217.5 → 225
    expect(earn(87, 2.75)).toBe(250); // 239.25 → 250
    expect(earn(87, 3)).toBe(250);    // 261 → 250
  });

  it('فاتورة 150 ريالاً: فضية 3.75 • ذهبية 4.25 • بلاتينية 4.50 ريال (مثال الوثيقة)', () => {
    expect(earn(150, 2.5)).toBe(375);
    expect(earn(150, 2.75)).toBe(425); // 412.5 → 425
    expect(earn(150, 3)).toBe(450);
    expect(halalasToRiyalLabel(earn(150, 2.75))).toBe('4.25');
  });

  it('الأساس net: يقسم على (1 + vatRate) قبل النسبة', () => {
    const net = { ...SETTINGS, amountBasis: 'net' };
    expect(countedAmountHalalas(11500, net)).toBeCloseTo(10000);
    // 115 ريالاً شامل الضريبة → صافي 100 → 2.5% = 250 هللة
    expect(computeEarnedHalalas(11500, 2.5, net)).toBe(250);
  });

  it('الجزء المخصوم من الرصيد لا يكسب — الكسب على المدفوع نقداً فقط', () => {
    // فاتورة 100 ريال خُصم منها 30 من الرصيد → الكسب على 70 المدفوعة فقط
    const invoiceHalalas = 10000;
    const redeemedHalalas = 3000;
    const paid = invoiceHalalas - redeemedHalalas;
    expect(computeEarnedHalalas(paid, 2.5, SETTINGS)).toBe(175);       // 70 × 2.5% = 1.75 ريال
    expect(computeEarnedHalalas(invoiceHalalas, 2.5, SETTINGS)).toBe(250); // وليس 2.50 ريال
  });

  it('قيم صفرية/فاسدة → 0 هللة', () => {
    expect(computeEarnedHalalas(0, 2.5, SETTINGS)).toBe(0);
    expect(computeEarnedHalalas('abc', 2.5, SETTINGS)).toBe(0);
    expect(computeEarnedHalalas(10000, 0, SETTINGS)).toBe(0);
  });
});

describe('الفئة عند الحدود بالضبط (4999 / 5000 / 9999 / 10000 هللة)', () => {
  const tiers = SETTINGS.tiers;
  it('عتبة الفضية 0 — كل عضو فضي على الأقل', () => {
    expect(tierForEarned(0, tiers)?.key).toBe('silver');
    expect(tierForEarned(1, tiers)?.key).toBe('silver');
  });
  it('4999 فضية و5000 ذهبية', () => {
    expect(tierForEarned(4999, tiers)?.key).toBe('silver');
    expect(tierForEarned(5000, tiers)?.key).toBe('gold');
  });
  it('9999 ذهبية و10000 بلاتينية، وأعلى فئة مفتوحة', () => {
    expect(tierForEarned(9999, tiers)?.key).toBe('gold');
    expect(tierForEarned(10000, tiers)?.key).toBe('platinum');
    expect(tierForEarned(9999999, tiers)?.key).toBe('platinum');
  });
  it('قائمة فئات فارغة → null', () => {
    expect(tierForEarned(5000, [])).toBe(null);
  });
});

describe('المتبقي للترقية التالية (بالهللات)', () => {
  const tiers = SETTINGS.tiers;
  it('مكتسب 3000 → التالية ذهبية والمتبقي 2000', () => {
    const info = nextTierInfo(3000, tiers);
    expect(info.nextTier.key).toBe('gold');
    expect(info.remainingHalalas).toBe(2000);
  });
  it('مكتسب 9999 → التالية بلاتينية والمتبقي 1', () => {
    const info = nextTierInfo(9999, tiers);
    expect(info.nextTier.key).toBe('platinum');
    expect(info.remainingHalalas).toBe(1);
  });
  it('في أعلى فئة → null', () => {
    expect(nextTierInfo(10000, tiers)).toBe(null);
    expect(nextTierInfo(50000, tiers)).toBe(null);
  });
});

describe('المكتسب في النافذة (24 شهراً) — deltaHalalas لحركات earn فقط', () => {
  const now = new Date(2026, 7, 5); // 2026-08-05
  const txs = [
    { id: 'a', type: 'earn', deltaHalalas: 3000, at: new Date(2026, 5, 1) },   // داخل النافذة
    { id: 'b', type: 'earn', deltaHalalas: 4000, at: new Date(2023, 0, 1) },   // خارج النافذة (قديمة)
    { id: 'c', type: 'earn', deltaHalalas: 2000, at: new Date(2026, 6, 1) },   // ستُعكس
    { id: 'r', type: 'reverse', deltaHalalas: -2000, at: new Date(2026, 6, 2), reversesTxId: 'c' },
    { id: 'd', type: 'redeem', deltaHalalas: -2500, at: new Date(2026, 6, 3) },  // لا يؤثر
    { id: 'e', type: 'expire', deltaHalalas: -1000, at: new Date(2026, 6, 4) },  // لا يؤثر
    { id: 'w', type: 'welcome', deltaHalalas: 500, at: new Date(2026, 5, 1) },   // لا تؤثر
  ];

  it('يجمع earn داخل النافذة فقط، ويستبعد المعكوس، ويتجاهل welcome/redeem/expire', () => {
    expect(earnedHalalasInWindow(txs, 24, now)).toBe(3000);
  });

  it('الترحيبية لا تدخل حساب الفئة إطلاقاً (معيار قبول)', () => {
    const without = txs.filter((t) => t.type !== 'welcome');
    expect(earnedHalalasInWindow(txs, 24, now)).toBe(earnedHalalasInWindow(without, 24, now));
  });

  it('الاستبدال لا يغيّر الفئة (معيار قبول)', () => {
    const before = earnedHalalasInWindow(txs.filter((t) => t.type !== 'redeem'), 24, now);
    expect(earnedHalalasInWindow(txs, 24, now)).toBe(before);
    // وحتى مع استبدال ضخم يبقى المكتسب — والفئة — كما هما
    const bigRedeem = [...txs, { id: 'd2', type: 'redeem', deltaHalalas: -999999, at: new Date(2026, 6, 5) }];
    expect(tierForEarned(earnedHalalasInWindow(bigRedeem, 24, now), SETTINGS.tiers)?.key)
      .toBe(tierForEarned(earnedHalalasInWindow(txs, 24, now), SETTINGS.tiers)?.key);
  });

  it('حركات audit مستثناة من المكتسب حتى لو حملت قيمة بالخطأ', () => {
    const withAudit = [
      ...txs,
      { id: 'x1', type: 'audit', deltaHalalas: 0, at: new Date(2026, 6, 10) },
      { id: 'x2', type: 'audit', deltaHalalas: 9999, at: new Date(2026, 6, 11) }, // قيمة خاطئة متعمدة
    ];
    expect(earnedHalalasInWindow(withAudit, 24, now)).toBe(earnedHalalasInWindow(txs, 24, now));
  });
});

describe('إعادة اشتقاق الرصيد من السجل — audit مستثناة دائماً', () => {
  const ledger = [
    { type: 'welcome', deltaHalalas: 500 },
    { type: 'earn', deltaHalalas: 375 },
    { type: 'earn', deltaHalalas: 250 },
    { type: 'reverse', deltaHalalas: -250, reversesTxId: 'b' },
    { type: 'redeem', deltaHalalas: -100 },
    { type: 'adjust', deltaHalalas: 25 },
  ];

  it('الرصيد = مجموع الأنواع الرصيدية الستة (الترحيبية ضمن الرصيد)', () => {
    expect(deriveBalance(ledger)).toBe(800);
  });

  it('الانتهاء يصفّر الرصيد بحركة expire (معيار قبول)', () => {
    const withExpire = [...ledger, { type: 'expire', deltaHalalas: -800 }];
    expect(deriveBalance(withExpire)).toBe(0);
  });

  it('حركات audit لا تدخل في الرصيد إطلاقاً حتى لو حملت قيمة بالخطأ', () => {
    const withAudit = [
      ...ledger,
      { type: 'audit', deltaHalalas: 0, action: 'disable' },
      { type: 'audit', deltaHalalas: -9999, action: 'editPhone' }, // قيمة خاطئة متعمدة
      { type: 'audit', deltaHalalas: 5000, action: 'enable' },     // قيمة خاطئة متعمدة
    ];
    expect(deriveBalance(withAudit)).toBe(deriveBalance(ledger));
    expect(deriveBalance(withAudit)).toBe(800);
  });

  it('سجل فارغ → 0', () => {
    expect(deriveBalance([])).toBe(0);
    expect(deriveBalance(null)).toBe(0);
  });
});

describe('المكافأة الترحيبية المعلّقة (24 ساعة) والرصيد المتاح', () => {
  const grantedAt = new Date(2026, 7, 5, 10, 0); // 2026-08-05 10:00
  const member = { balanceHalalas: 875, welcomeBonusAt: grantedAt };

  it('قبل مرور 24 ساعة: الترحيبية معلّقة والمتاح = الرصيد ناقص الترحيبية', () => {
    const now = new Date(2026, 7, 5, 20, 0); // بعد 10 ساعات
    expect(isWelcomeOnHold(member, SETTINGS, now)).toBe(true);
    expect(availableBalanceHalalas(member, SETTINGS, now)).toBe(375);
  });

  it('بعد مرور 24 ساعة: الرصيد كله متاح', () => {
    const now = new Date(2026, 7, 6, 10, 1); // بعد 24 ساعة ودقيقة
    expect(isWelcomeOnHold(member, SETTINGS, now)).toBe(false);
    expect(availableBalanceHalalas(member, SETTINGS, now)).toBe(875);
  });

  it('المتاح مثبّت عند صفر — لا رصيد متاح سالب في أي حالة', () => {
    const now = new Date(2026, 7, 5, 12, 0);
    // رصيد أقل من الترحيبية (بعد خصم إداري مثلاً) → 0 لا -200
    expect(availableBalanceHalalas({ balanceHalalas: 300, welcomeBonusAt: grantedAt }, SETTINGS, now)).toBe(0);
    expect(availableBalanceHalalas({ balanceHalalas: -100, welcomeBonusAt: grantedAt }, SETTINGS, now)).toBe(0);
  });

  it('بلا welcomeBonusAt → لا تعليق والرصيد كله متاح', () => {
    expect(availableBalanceHalalas({ balanceHalalas: 875 }, SETTINGS, new Date())).toBe(875);
  });

  it('welcomeAvailableAt = welcomeBonusAt + delayHours', () => {
    const at = welcomeAvailableAt(member, SETTINGS);
    expect(at.getTime()).toBe(addHours(grantedAt, 24).getTime());
  });
});

describe('صلاحية مبلغ الخصم — مضاعفات ربع ريال', () => {
  it('يقبل المضاعفات الصحيحة الموجبة فقط', () => {
    expect(isValidRedeemAmount(25, 25)).toBe(true);
    expect(isValidRedeemAmount(1000, 25)).toBe(true);
    expect(isValidRedeemAmount(0, 25)).toBe(false);
    expect(isValidRedeemAmount(-25, 25)).toBe(false);
    expect(isValidRedeemAmount(30, 25)).toBe(false);
    expect(isValidRedeemAmount(12.5, 25)).toBe(false);
  });
});

describe('الترقية اليدوية والفئة الفعلية', () => {
  const now = new Date(2026, 7, 5);
  const txs = [{ id: 'a', type: 'earn', deltaHalalas: 100, at: new Date(2026, 6, 1) }]; // → فضية

  it('الترقية اليدوية السارية تتقدم على المحسوبة', () => {
    const member = { manualTier: { tier: 'platinum', until: new Date(2026, 11, 31) } };
    const res = effectiveTier(member, txs, SETTINGS, now);
    expect(res.tier?.key).toBe('platinum');
    expect(res.manual).toBe(true);
    // المتبقي للترقية يُحسب من المكتسب المحسوب لا من اليدوية
    expect(res.remainingToNextHalalas).toBe(4900);
  });

  it('الترقية المنتهية المدة تُهمل ويُعتمد المحسوب', () => {
    const member = { manualTier: { tier: 'platinum', until: new Date(2026, 0, 1) } };
    const res = effectiveTier(member, txs, SETTINGS, now);
    expect(res.tier?.key).toBe('silver');
    expect(res.manual).toBe(false);
  });

  it('بلا until → سارية دائماً حتى الإلغاء', () => {
    expect(isManualTierActive({ tier: 'gold', until: null }, now)).toBe(true);
    expect(isManualTierActive(null, now)).toBe(false);
  });

  it('effectiveTier يرجع المكتسب والفئة التالية والمتبقي', () => {
    const res = effectiveTier({}, txs, SETTINGS, now);
    expect(res.earnedHalalas).toBe(100);
    expect(res.nextTier?.key).toBe('gold');
    expect(res.remainingToNextHalalas).toBe(4900);
  });

  it('tierName يعرض الاسم بلغة الواجهة', () => {
    expect(tierName(SETTINGS.tiers[0], 'ar')).toBe('فضية');
    expect(tierName(SETTINGS.tiers[0], 'en')).toBe('Silver');
    expect(tierName(null)).toBe('');
  });
});

describe('toDateSafe — نجاة التواريخ من كاش sessionStorage (Batch 91.3)', () => {
  const when = new Date(2026, 7, 3, 10, 30);
  // Firestore Timestamp حي (كما يصل من الشبكة)
  const liveTs = {
    seconds: Math.floor(when.getTime() / 1000),
    nanoseconds: 0,
    toDate() { return new Date(this.seconds * 1000); },
  };

  it('Timestamp حي → toDate()', () => {
    expect(toDateSafe(liveTs).getTime()).toBe(liveTs.toDate().getTime());
  });

  it('Timestamp مُحيا من JSON (شكل client SDK: seconds/nanoseconds) → Date صحيح لا null', () => {
    const revived = JSON.parse(JSON.stringify(liveTs)); // ما يخزّنه ويعيده الكاش فعلاً
    expect(typeof revived.toDate).toBe('undefined');
    const d = toDateSafe(revived);
    expect(d).not.toBe(null);
    expect(d.getTime()).toBe(liveTs.toDate().getTime());
  });

  it('شكل Admin SDK المتسلسل (_seconds/_nanoseconds) → Date صحيح', () => {
    const d = toDateSafe({ _seconds: Math.floor(when.getTime() / 1000), _nanoseconds: 500000000 });
    expect(d).not.toBe(null);
    expect(Math.abs(d.getTime() - (when.getTime() - when.getMilliseconds()))).toBeLessThanOrEqual(500);
  });

  it('القيم غير الصالحة تبقى null', () => {
    expect(toDateSafe(null)).toBe(null);
    expect(toDateSafe({ foo: 1 })).toBe(null);
    expect(toDateSafe('ليس تاريخاً')).toBe(null);
  });
});

describe('انتهاء الرصيد (الكسول)', () => {
  it('balanceExpiresAt = lastPurchaseAt + expiryMonths (افتراضي 12 شهراً)', () => {
    const last = new Date(2026, 0, 15);
    const exp = computeExpiryAt(last, 12);
    expect(exp.getFullYear()).toBe(2027);
    expect(exp.getMonth()).toBe(0); // يناير
    expect(exp.getDate()).toBe(15);
  });

  it('نهاية الشهر لا تتدحرج: 31 يناير + شهر = آخر يوم في فبراير', () => {
    const exp = addMonths(new Date(2026, 0, 31), 1);
    expect(exp.getMonth()).toBe(1);
    expect(exp.getDate()).toBe(28);
  });

  it('يُصفّى فقط عند تجاوز التاريخ ورصيد موجب', () => {
    const past = new Date(2026, 0, 1);
    const future = new Date(2027, 0, 1);
    const now = new Date(2026, 7, 5);
    expect(isBalanceExpired({ balanceExpiresAt: past, balanceHalalas: 500 }, now)).toBe(true);
    expect(isBalanceExpired({ balanceExpiresAt: future, balanceHalalas: 500 }, now)).toBe(false);
    expect(isBalanceExpired({ balanceExpiresAt: past, balanceHalalas: 0 }, now)).toBe(false);
    expect(isBalanceExpired({ balanceExpiresAt: past, balanceHalalas: -100 }, now)).toBe(false);
    expect(isBalanceExpired({ balanceHalalas: 500 }, now)).toBe(false); // بلا تاريخ
  });
});

describe('تكرار الفاتورة — معرّف المستند', () => {
  it('نفس الرقم بصيغ مختلفة → نفس المعرّف (الأرقام العربية والمسافات تُوحَّد)', () => {
    expect(invoiceDocId('toia', '1234')).toBe('toia_1234');
    expect(invoiceDocId('toia', ' 1234 ')).toBe('toia_1234');
    expect(invoiceDocId('toia', '١٢٣٤')).toBe('toia_1234');
  });

  it('نفس الرقم في متجرين → معرّفان مختلفان (عضويتان مستقلتان)', () => {
    expect(invoiceDocId('toia', '1234')).not.toBe(invoiceDocId('wardana', '1234'));
  });

  it('فارغ أو بلا متجر → null، و/ تُستبدل (صلاحية معرّف المستند)', () => {
    expect(invoiceDocId('toia', '')).toBe(null);
    expect(invoiceDocId('toia', '   ')).toBe(null);
    expect(invoiceDocId(null, '123')).toBe(null);
    expect(invoiceDocId('toia', 'INV/22')).toBe('toia_INV-22');
  });
});

describe('توليد رقم العضوية والتوكن', () => {
  it('رقم العضوية: حرف المتجر + 5 أرقام', () => {
    expect(storeLetter('toia')).toBe('T');
    expect(storeLetter('wardana')).toBe('W');
    expect(randomMemberNo('toia')).toMatch(/^T-\d{5}$/);
    expect(randomMemberNo('wardana')).toMatch(/^W-\d{5}$/);
    // مولّد محقون للثبات
    expect(randomMemberNo('toia', () => 48271)).toBe('T-48271');
    expect(randomMemberNo('toia', () => 7)).toBe('T-00007'); // padding
  });

  it('التوكن ≥22 حرفاً ومن أبجدية آمنة', () => {
    const tk = randomCardToken();
    expect(tk.length).toBeGreaterThanOrEqual(22);
    expect(tk).toMatch(/^[A-Za-z2-9]+$/);
    expect(randomCardToken()).not.toBe(randomCardToken()); // عشوائية فعلية
  });
});
