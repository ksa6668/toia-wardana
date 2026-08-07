// src/loyaltyShare.test.js
// ====================================================================
// اختبارات vitest للمرحلة 2 (loyaltyShare.js):
//   • payload البطاقة: عدم تسريب أي حقل خارج القائمة البيضاء
//     (memberId / cardToken / الجوال الكامل / السجلات) — يفشل إن ظهر حقل غريب
//   • تقنيع الجوال
//   • نص واتساب الترحيبي واستبدال المتغيرات
//   • رابط wa.me: الرقم بلا + وبلا أصفار بادئة (966501234567)
// ====================================================================
import { describe, it, expect } from 'vitest';
import {
  LOYALTY_DEFAULT_SETTINGS,
  CARD_PAYLOAD_ALLOWED_KEYS,
  buildCardPayload,
  maskPhone,
  renderWelcomeMessage,
  buildWhatsappUrl,
  cardUrlFor,
  isLocalOrigin,
  STORE_NAMES,
} from './loyaltyShare';

// عضو كامل كما في Firestore — يحمل عمداً كل الحقول الحساسة
const FULL_MEMBER = {
  id: 'abc123docid',
  store: 'toia',
  memberNo: 'T-48271',
  cardToken: 'XyZ9AbCdEfGhJkMnPqRsTuVw',
  phone: '+966501234567',
  name: 'أحمد الحربي',
  source: 'maps',
  sourceOther: '',
  marketingConsent: true,
  gender: 'male', // المرحلة 5 — يجب ألا يتسرب إلى البطاقة العامة إطلاقاً
  joinedAt: new Date(2026, 0, 15),
  pointsBalance: 6250,
  redemptionsCount: 3,
  lastPurchaseAt: new Date(2026, 6, 1),
  pointsExpireAt: new Date(2028, 0, 1),
  manualTier: null,
  status: 'active',
  createdBy: 'uid-employee-1',
  createdByName: 'موظف تويا',
  updatedAt: new Date(),
  statusReason: 'سبب إداري',
};

const TXS = [
  { id: 't1', type: 'earn', points: 6250, amount: 1250, invoiceNo: 'INV-77', at: new Date(2026, 6, 1) },
];

const NOW = new Date(2026, 7, 5);

describe('payload البطاقة — القائمة البيضاء (معيار قبول)', () => {
  const payload = buildCardPayload(FULL_MEMBER, TXS, LOYALTY_DEFAULT_SETTINGS, NOW);

  it('يفشل إن ظهر أي حقل خارج القائمة البيضاء', () => {
    const allowed = new Set(CARD_PAYLOAD_ALLOWED_KEYS);
    for (const key of Object.keys(payload)) {
      expect(allowed.has(key), `حقل مسرّب خارج القائمة البيضاء: ${key}`).toBe(true);
    }
  });

  it('لا يعيد إطلاقاً memberId ولا cardToken ولا الجوال الكامل ولا الحقول الإدارية', () => {
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('memberId');
    expect(payload).not.toHaveProperty('cardToken');
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('createdBy');
    expect(payload).not.toHaveProperty('statusReason');
    expect(payload).not.toHaveProperty('marketingConsent');
    expect(payload).not.toHaveProperty('gender'); // المرحلة 5: الجنس لا يظهر إطلاقاً
    expect(CARD_PAYLOAD_ALLOWED_KEYS).not.toContain('gender');
    expect(JSON.stringify(payload)).not.toContain('gender');
    // ولا تتسرب القيم نفسها في أي مكان بالمحتوى المتسلسل
    const json = JSON.stringify(payload);
    expect(json).not.toContain('abc123docid');
    expect(json).not.toContain('XyZ9AbCdEfGhJkMnPqRsTuVw');
    expect(json).not.toContain('+966501234567');
    expect(json).not.toContain('501234567');
    expect(json).not.toContain('INV-77'); // لا أرقام فواتير ولا سجلات
  });

  it('يعيد الحقول المسموحة بالقيم الصحيحة', () => {
    expect(payload.store).toBe('toia');
    expect(payload.storeName).toBe(STORE_NAMES.toia);
    expect(payload.name).toBe('أحمد الحربي');
    expect(payload.memberNo).toBe('T-48271');
    expect(payload.pointsBalance).toBe(6250);
    expect(payload.redemptionsCount).toBe(3);
    expect(payload.joinedAt).toBe('2026-01-15');
    expect(payload.tier?.key).toBe('silver'); // 6250 نقطة فئة
    expect(payload.phoneMasked).toBe('05******67');
  });

  it('expiryMonths ضمن القائمة البيضاء ويُقرأ من إعدادات المتجر (لنص الشروط)', () => {
    expect(CARD_PAYLOAD_ALLOWED_KEYS).toContain('expiryMonths');
    expect(payload.expiryMonths).toBe(18); // الافتراضي
    const custom = buildCardPayload(FULL_MEMBER, TXS, { ...LOYALTY_DEFAULT_SETTINGS, expiryMonths: 12 }, NOW);
    expect(custom.expiryMonths).toBe(12); // تغيير الإعداد ينعكس مباشرة
  });

  it('المكافآت: 6250 لا تفتح r50 (7500) — والمكافأة التالية هي r50', () => {
    expect(payload.rewards).toHaveLength(6);
    expect(payload.rewards.every((r) => r.unlocked === false)).toBe(true);
    expect(payload.nextReward).toEqual({ label: 'باقة 50 ريال', points: 7500 });
    // كل عنصر مكافأة يحمل الحقول الأربعة فقط
    for (const r of payload.rewards) {
      expect(Object.keys(r).sort()).toEqual(['id', 'label', 'points', 'unlocked']);
    }
  });

  it('رصيد يفتح بعض المكافآت: unlocked صحيحة وnextReward هي الأولى غير المبلوغة', () => {
    const rich = buildCardPayload({ ...FULL_MEMBER, pointsBalance: 12000 }, TXS, LOYALTY_DEFAULT_SETTINGS, NOW);
    expect(rich.rewards.find((r) => r.id === 'r50').unlocked).toBe(true);
    expect(rich.rewards.find((r) => r.id === 'r75').unlocked).toBe(true);
    expect(rich.rewards.find((r) => r.id === 'r100').unlocked).toBe(false);
    expect(rich.nextReward.points).toBe(15000);
  });

  it('نقاط منتهية (كسولاً) → تُعرض 0 بلا أي كتابة', () => {
    const expired = buildCardPayload(
      { ...FULL_MEMBER, pointsExpireAt: new Date(2026, 0, 1), pointsBalance: 5000 },
      TXS, LOYALTY_DEFAULT_SETTINGS, NOW
    );
    expect(expired.pointsBalance).toBe(0);
    expect(expired.pointsExpireAt).toBe(null);
    expect(expired.rewards.every((r) => !r.unlocked)).toBe(true);
  });
});

describe('تقنيع الجوال', () => {
  it('يعرض أول خانتين وآخر خانتين فقط بصيغة محلية', () => {
    expect(maskPhone('+966501234567')).toBe('05******67');
    expect(maskPhone('0501234567')).toBe('05******67');
  });
  it('صيغة غير صالحة → قناع كامل بلا تسريب', () => {
    expect(maskPhone('غير رقم')).toBe('**********');
    expect(maskPhone('')).toBe('**********');
    expect(maskPhone(null)).toBe('**********');
  });
});

describe('رسالة واتساب الترحيبية', () => {
  const vars = {
    name: 'أحمد',
    storeName: 'تويا',
    memberNo: 'T-48271',
    tier: 'ذهبية',
    points: 6250,
    cardUrl: 'https://toia.example/c/XyZ9AbCd',
  };

  it('يستبدل كل المتغيرات المدعومة', () => {
    const out = renderWelcomeMessage(LOYALTY_DEFAULT_SETTINGS.welcomeMessage, vars);
    expect(out).toContain('مرحبًا أحمد');
    expect(out).toContain('برنامج ولاء تويا');
    expect(out).toContain('T-48271');
    expect(out).toContain('6250 نقطة');
    expect(out).toContain('https://toia.example/c/XyZ9AbCd');
    expect(out).not.toMatch(/\{(name|storeName|memberNo|tier|points|cardUrl)\}/);
  });

  it('قالب قديم بلا متغيرات يُترك كما هو', () => {
    const legacy = 'أهلاً بك في برنامج الولاء! 🌸';
    expect(renderWelcomeMessage(legacy, vars)).toBe(legacy);
  });

  it('متغير بلا قيمة → نص فارغ (لا يبقى {placeholder})', () => {
    expect(renderWelcomeMessage('مرحبا {name}', {})).toBe('مرحبا ');
  });
});

describe('رابط wa.me — الرقم بلا + وبلا أصفار بادئة (شرط المرحلة 2)', () => {
  it('+9665... → 966501234567 في الرابط', () => {
    const url = buildWhatsappUrl('+966501234567', 'مرحبا');
    expect(url.startsWith('https://wa.me/966501234567?text=')).toBe(true);
    expect(url).not.toContain('+');
    expect(url).not.toContain('wa.me/0');
  });

  it('يقبل الصيغة المحلية 05... ويحوّلها لنفس الرقم', () => {
    expect(buildWhatsappUrl('0501234567', 'x')).toContain('wa.me/966501234567');
  });

  it('يرمّز النص العربي والرابط بشكل صحيح', () => {
    const text = 'مرحبًا أحمد\nبطاقتك: https://x.y/c/tok?a=1';
    const url = buildWhatsappUrl('+966501234567', text);
    const encoded = url.split('?text=')[1];
    expect(decodeURIComponent(encoded)).toBe(text);
    expect(encoded).not.toContain('\n'); // السطر الجديد مرمّز %0A
  });

  it('جوال غير صالح → null', () => {
    expect(buildWhatsappUrl('12345', 'x')).toBe(null);
  });
});

describe('رابط البطاقة وأصل التطوير', () => {
  it('يبني /c/{token} على الأصل المعطى', () => {
    expect(cardUrlFor('https://toia.vercel.app', 'AbC123xyzAbC123xyzAbC1')).toBe(
      'https://toia.vercel.app/c/AbC123xyzAbC123xyzAbC1'
    );
    expect(cardUrlFor('https://toia.vercel.app/', 'tok')).toBe('https://toia.vercel.app/c/tok');
  });

  it('يكشف أصل التطوير المحلي (شرط: لا رابط واتساب من localhost)', () => {
    expect(isLocalOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalOrigin('http://127.0.0.1:4173')).toBe(true);
    expect(isLocalOrigin('https://toia.vercel.app')).toBe(false);
  });
});
