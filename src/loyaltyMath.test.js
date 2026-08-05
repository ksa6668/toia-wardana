// src/loyaltyMath.test.js
// ====================================================================
// اختبارات vitest لمنطق الولاء النقي (loyaltyMath.js) — بلا Firebase.
// تغطي معايير القبول: النقاط، الفئة عند الحدود، الانتهاء، تكرار الفاتورة،
// وتوحيد صيغة الجوال.
// ====================================================================
import { describe, it, expect } from 'vitest';
import {
  normalizePhone,
  toEnglishDigits,
  countedAmount,
  computeEarnPoints,
  addMonths,
  computeExpiryAt,
  isPointsExpired,
  tierPointsInWindow,
  tierForPoints,
  isManualTierActive,
  effectiveTier,
  invoiceDocId,
  randomMemberNo,
  randomCardToken,
  storeLetter,
} from './loyaltyMath';

// نفس افتراضيات المرحلة 1
const SETTINGS = {
  pointsPerRiyal: 5,
  pointsBasis: 'gross',
  vatRate: 0.15,
  expiryMonths: 18,
  tierWindowMonths: 24,
  tiers: [
    { key: 'silver', name: 'فضية', min: 1, max: 7500 },
    { key: 'gold', name: 'ذهبية', min: 7501, max: 20000 },
    { key: 'platinum', name: 'بلاتينية', min: 20001, max: null },
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

describe('حساب النقاط', () => {
  it('الأساس gross: النقاط = المبلغ × 5', () => {
    expect(computeEarnPoints(100, SETTINGS)).toBe(500);
    expect(computeEarnPoints(1500, SETTINGS)).toBe(7500);
  });

  it('الأساس net: يقسم على (1 + vatRate) قبل الضرب', () => {
    const net = { ...SETTINGS, pointsBasis: 'net' };
    expect(countedAmount(115, net)).toBeCloseTo(100);
    expect(computeEarnPoints(115, net)).toBe(500);
    // 100 ريال شامل الضريبة → 86.956× 5 = 434.78 → round = 435
    expect(computeEarnPoints(100, net)).toBe(435);
  });

  it('التقريب round وليس floor/ceil', () => {
    expect(computeEarnPoints(10.05, SETTINGS)).toBe(50);  // 50.25 → 50
    expect(computeEarnPoints(10.1, SETTINGS)).toBe(51);   // 50.5 → 51
  });

  it('قيم صفرية/فاسدة → 0 نقاط', () => {
    expect(computeEarnPoints(0, SETTINGS)).toBe(0);
    expect(computeEarnPoints('abc', SETTINGS)).toBe(0);
  });
});

describe('الفئة عند الحدود', () => {
  const tiers = SETTINGS.tiers;
  it('0 نقاط → بلا فئة، و1 → فضية', () => {
    expect(tierForPoints(0, tiers)).toBe(null);
    expect(tierForPoints(1, tiers)?.key).toBe('silver');
  });
  it('حدود فضية/ذهبية: 7500 فضية و7501 ذهبية', () => {
    expect(tierForPoints(7500, tiers)?.key).toBe('silver');
    expect(tierForPoints(7501, tiers)?.key).toBe('gold');
  });
  it('حدود ذهبية/بلاتينية: 20000 ذهبية و20001 بلاتينية، وmax:null مفتوح', () => {
    expect(tierForPoints(20000, tiers)?.key).toBe('gold');
    expect(tierForPoints(20001, tiers)?.key).toBe('platinum');
    expect(tierForPoints(9999999, tiers)?.key).toBe('platinum');
  });
});

describe('نقاط الفئة من سجل الحركات (نافذة 24 شهراً)', () => {
  const now = new Date(2026, 7, 5); // 2026-08-05
  const txs = [
    { id: 'a', type: 'earn', points: 5000, at: new Date(2026, 5, 1) },   // داخل النافذة
    { id: 'b', type: 'earn', points: 4000, at: new Date(2023, 0, 1) },   // خارج النافذة (قديمة)
    { id: 'c', type: 'earn', points: 3000, at: new Date(2026, 6, 1) },   // ستُعكس
    { id: 'r', type: 'reverse', points: -3000, at: new Date(2026, 6, 2), reversesTxId: 'c' },
    { id: 'd', type: 'redeem', points: -7500, at: new Date(2026, 6, 3) },  // لا يؤثر
    { id: 'e', type: 'expire', points: -1000, at: new Date(2026, 6, 4) },  // لا يؤثر
  ];

  it('يجمع earn داخل النافذة فقط، ويستبعد المعكوس، ويتجاهل redeem/expire', () => {
    expect(tierPointsInWindow(txs, 24, now)).toBe(5000);
  });

  it('الاستبدال لا يغيّر الفئة (معيار قبول)', () => {
    const before = tierPointsInWindow(txs.filter((t) => t.type !== 'redeem'), 24, now);
    expect(tierPointsInWindow(txs, 24, now)).toBe(before);
  });
});

describe('الترقية اليدوية والفئة الفعلية', () => {
  const now = new Date(2026, 7, 5);
  const txs = [{ id: 'a', type: 'earn', points: 100, at: new Date(2026, 6, 1) }]; // → فضية

  it('الترقية اليدوية السارية تتقدم على المحسوبة', () => {
    const member = { manualTier: { tier: 'platinum', until: new Date(2026, 11, 31) } };
    const res = effectiveTier(member, txs, SETTINGS, now);
    expect(res.tier?.key).toBe('platinum');
    expect(res.manual).toBe(true);
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
});

describe('انتهاء النقاط (الكسول)', () => {
  it('pointsExpireAt = lastPurchaseAt + expiryMonths', () => {
    const last = new Date(2026, 0, 15);
    const exp = computeExpiryAt(last, 18);
    expect(exp.getFullYear()).toBe(2027);
    expect(exp.getMonth()).toBe(6); // يوليو
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
    expect(isPointsExpired({ pointsExpireAt: past, pointsBalance: 500 }, now)).toBe(true);
    expect(isPointsExpired({ pointsExpireAt: future, pointsBalance: 500 }, now)).toBe(false);
    expect(isPointsExpired({ pointsExpireAt: past, pointsBalance: 0 }, now)).toBe(false);
    expect(isPointsExpired({ pointsExpireAt: past, pointsBalance: -100 }, now)).toBe(false);
    expect(isPointsExpired({ pointsBalance: 500 }, now)).toBe(false); // بلا تاريخ
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
