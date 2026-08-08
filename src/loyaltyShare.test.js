// src/loyaltyShare.test.js
// ====================================================================
// اختبارات vitest لمنطق المشاركة (loyaltyShare.js) — النسخة 3.0:
//   • payload البطاقة: عدم تسريب أي حقل خارج القائمة البيضاء —
//     language ممرَّر عمداً (المرحلة B)، وgender لا يظهر أبداً
//   • الإعدادات الافتراضية الجديدة (بلا مكافآت وبلا نقاط)
//   • تقنيع الجوال
//   • رسائل واتساب: الترحيبية {ar,en} وإشعار الرصيد القابل للتعديل
//   • رابط wa.me: الرقم بلا + وبلا أصفار بادئة (966501234567)
// ====================================================================
import { describe, it, expect } from 'vitest';
import {
  LOYALTY_DEFAULT_SETTINGS,
  CARD_PAYLOAD_ALLOWED_KEYS,
  buildCardPayload,
  maskPhone,
  renderWelcomeMessage,
  buildCreditMessage,
  findUnknownVars,
  CREDIT_NOTIFY_TEMPLATE,
  CREDIT_MESSAGE_VARS,
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
  gender: 'male',    // يجب ألا يتسرب إلى البطاقة العامة إطلاقاً
  language: 'ar',    // ممرَّر عمداً ضمن القائمة البيضاء (المرحلة B)
  joinedAt: new Date(2026, 0, 15),
  balanceHalalas: 875,
  lastPurchaseAt: new Date(2026, 6, 1),
  balanceExpiresAt: new Date(2027, 6, 1),
  welcomeBonusAt: new Date(2026, 0, 15),
  manualTier: null,
  status: 'active',
  createdBy: 'uid-employee-1',
  createdByName: 'موظف تويا',
  updatedAt: new Date(),
  statusReason: 'سبب إداري',
};

const TXS = [
  { id: 't1', type: 'earn', deltaHalalas: 375, amountHalalas: 15000, invoiceNo: 'INV-77', at: new Date(2026, 6, 1) },
  { id: 'w1', type: 'welcome', deltaHalalas: 500, at: new Date(2026, 0, 15) },
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

  it('language ممرَّر عمداً ضمن القائمة البيضاء (استعداداً للمرحلة B) — ليس تسريباً', () => {
    expect(CARD_PAYLOAD_ALLOWED_KEYS).toContain('language');
    expect(payload.language).toBe('ar');
    // عضو إنجليزي → en، وقيمة مجهولة/مفقودة → ar افتراضياً
    expect(buildCardPayload({ ...FULL_MEMBER, language: 'en' }, TXS, LOYALTY_DEFAULT_SETTINGS, NOW).language).toBe('en');
    expect(buildCardPayload({ ...FULL_MEMBER, language: undefined }, TXS, LOYALTY_DEFAULT_SETTINGS, NOW).language).toBe('ar');
  });

  it('gender لا يظهر أبداً — لا كحقل ولا كقيمة في أي مكان من الاستجابة', () => {
    expect(payload).not.toHaveProperty('gender');
    expect(CARD_PAYLOAD_ALLOWED_KEYS).not.toContain('gender');
    expect(JSON.stringify(payload)).not.toContain('gender');
  });

  it('لا يعيد إطلاقاً memberId ولا cardToken ولا الجوال الكامل ولا الحقول الإدارية', () => {
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('memberId');
    expect(payload).not.toHaveProperty('cardToken');
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('createdBy');
    expect(payload).not.toHaveProperty('statusReason');
    expect(payload).not.toHaveProperty('marketingConsent');
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
    expect(payload.balanceHalalas).toBe(875);
    expect(payload.joinedAt).toBe('2026-01-15');
    // المكتسب 375 هللة < عتبة الذهبية 5000 → فضية، والترحيبية لا تدخل الحساب
    expect(payload.tier?.key).toBe('silver');
    expect(payload.tier?.name?.ar).toBe('فضية');
    expect(payload.phoneMasked).toBe('05******67');
  });

  it('expiryMonths ضمن القائمة البيضاء ويُقرأ من إعدادات المتجر (لنص الشروط)', () => {
    expect(CARD_PAYLOAD_ALLOWED_KEYS).toContain('expiryMonths');
    expect(payload.expiryMonths).toBe(12); // الافتراضي الجديد
    const custom = buildCardPayload(FULL_MEMBER, TXS, { ...LOYALTY_DEFAULT_SETTINGS, expiryMonths: 6 }, NOW);
    expect(custom.expiryMonths).toBe(6); // تغيير الإعداد ينعكس مباشرة
  });

  it('رصيد منتهٍ (كسولاً) → يُعرض 0 بلا أي كتابة', () => {
    const expired = buildCardPayload(
      { ...FULL_MEMBER, balanceExpiresAt: new Date(2026, 0, 1), balanceHalalas: 5000 },
      TXS, LOYALTY_DEFAULT_SETTINGS, NOW
    );
    expect(expired.balanceHalalas).toBe(0);
    expect(expired.balanceExpiresAt).toBe(null);
  });
});

describe('الإعدادات الافتراضية 3.0 — بلا نقاط وبلا مكافآت', () => {
  it('لا أثر لبنية النقاط القديمة', () => {
    expect(LOYALTY_DEFAULT_SETTINGS).not.toHaveProperty('rewards');
    expect(LOYALTY_DEFAULT_SETTINGS).not.toHaveProperty('pointsPerRiyal');
    expect(LOYALTY_DEFAULT_SETTINGS).not.toHaveProperty('pointsBasis');
    expect(LOYALTY_DEFAULT_SETTINGS).not.toHaveProperty('pointsMessage');
  });

  it('الفئات الثلاث بالعتبات والنسب الافتراضية', () => {
    const [s, g, p] = LOYALTY_DEFAULT_SETTINGS.tiers;
    expect([s.key, g.key, p.key]).toEqual(['silver', 'gold', 'platinum']);
    expect([s.minEarnedHalalas, g.minEarnedHalalas, p.minEarnedHalalas]).toEqual([0, 5000, 10000]);
    expect([s.ratePercent, g.ratePercent, p.ratePercent]).toEqual([2.5, 2.75, 3]);
    expect(s.name).toEqual({ ar: 'فضية', en: 'Silver' });
  });

  it('قيم الرصيد والترحيبية والتقريب', () => {
    expect(LOYALTY_DEFAULT_SETTINGS.expiryMonths).toBe(12);
    expect(LOYALTY_DEFAULT_SETTINGS.expiryWarningDays).toBe(30);
    expect(LOYALTY_DEFAULT_SETTINGS.welcomeBonusHalalas).toBe(500);
    expect(LOYALTY_DEFAULT_SETTINGS.welcomeBonusDelayHours).toBe(24);
    expect(LOYALTY_DEFAULT_SETTINGS.earnRoundingHalalas).toBe(25);
    expect(LOYALTY_DEFAULT_SETTINGS.redeemStepHalalas).toBe(25);
    expect(LOYALTY_DEFAULT_SETTINGS.largeTransactionAlertRiyals).toBe(1000);
    expect(LOYALTY_DEFAULT_SETTINGS.tierWindowMonths).toBe(24);
  });

  it('الرسائل ثنائية ({ar,en}) وإشعار الرصيد عربي واحد الآن', () => {
    expect(typeof LOYALTY_DEFAULT_SETTINGS.welcomeMessage.ar).toBe('string');
    expect(typeof LOYALTY_DEFAULT_SETTINGS.welcomeMessage.en).toBe('string');
    expect(typeof LOYALTY_DEFAULT_SETTINGS.expiryWarningMessage.ar).toBe('string');
    expect(typeof LOYALTY_DEFAULT_SETTINGS.expiryWarningMessage.en).toBe('string');
    expect(LOYALTY_DEFAULT_SETTINGS.creditMessage).toBe(CREDIT_NOTIFY_TEMPLATE);
    expect(LOYALTY_DEFAULT_SETTINGS.contacts).toEqual({ whatsapp: '', instagram: '', tiktok: '' });
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

describe('رسالة واتساب الترحيبية — الرصيد بالريال', () => {
  const vars = {
    name: 'أحمد',
    storeName: 'تويا',
    memberNo: 'T-48271',
    tier: 'ذهبية',
    balance: '8.75',
    cardUrl: 'https://toia.example/c/XyZ9AbCd',
  };

  it('يستبدل كل المتغيرات المدعومة', () => {
    const out = renderWelcomeMessage(LOYALTY_DEFAULT_SETTINGS.welcomeMessage.ar, vars);
    expect(out).toContain('مرحبًا أحمد');
    expect(out).toContain('برنامج ولاء تويا');
    expect(out).toContain('T-48271');
    expect(out).toContain('8.75 ريال');
    expect(out).toContain('https://toia.example/c/XyZ9AbCd');
    expect(out).not.toMatch(/\{(name|storeName|memberNo|tier|balance|cardUrl)\}/);
  });

  it('القالب الإنجليزي يعمل بنفس المتغيرات', () => {
    const out = renderWelcomeMessage(LOYALTY_DEFAULT_SETTINGS.welcomeMessage.en, {
      ...vars, name: 'Ahmed', storeName: 'Toia',
    });
    expect(out).toContain('Hello Ahmed');
    expect(out).toContain('SAR 8.75');
    expect(out).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('قالب قديم بلا متغيرات يُترك كما هو', () => {
    const legacy = 'أهلاً بك في برنامج الولاء! 🌸';
    expect(renderWelcomeMessage(legacy, vars)).toBe(legacy);
  });

  it('متغير بلا قيمة → نص فارغ (لا يبقى {placeholder})', () => {
    expect(renderWelcomeMessage('مرحبا {name}', {})).toBe('مرحبا ');
  });

  it('قالب تنبيه الانتهاء يستبدل {expiryDate}', () => {
    const out = renderWelcomeMessage(LOYALTY_DEFAULT_SETTINGS.expiryWarningMessage.ar, {
      name: 'سارة', storeName: 'وردانة', balance: '12', expiryDate: '2027-01-15',
    });
    expect(out).toContain('سينتهي بتاريخ 2027-01-15');
    expect(out).not.toMatch(/\{[a-zA-Z]+\}/);
  });
});

describe('إشعار الرصيد المعاملاتي (خلف Batch 92 — بصيغة الريال)', () => {
  const vars = {
    name: 'أحمد',
    earned: '3.75',       // من الحركة نفسها (deltaHalalas بصيغة عرض)
    balance: '12.50',     // من الحركة نفسها (balanceAfterHalalas بصيغة عرض)
    cardUrl: 'https://toia.example/c/AbC123',
    storeName: 'وردانة',
  };

  it('يستبدل الخمسة كلها بالقيم الحرفية من الحركة ولا يترك أي placeholder', () => {
    const msg = buildCreditMessage(vars);
    expect(msg).toContain('مرحبًا أحمد 🌸');
    expect(msg).toContain('أُضيف إلى رصيدك 3.75 ريال من مشترياتك.');
    expect(msg).toContain('رصيدك الآن: 12.50 ريال.');
    expect(msg).toContain('بطاقتك: https://toia.example/c/AbC123');
    expect(msg).toContain('نسعد بخدمتك — وردانة');
    expect(msg).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('الرسالة كاملة عبر wa.me: فك الترميز يعيد النص بأسطره والرقم بلا +', () => {
    const msg = buildCreditMessage(vars);
    const url = buildWhatsappUrl('+966501234567', msg);
    expect(url.startsWith('https://wa.me/966501234567?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(msg);
    expect(url).not.toContain('+');
  });

  it('قالب مخصص من الإعدادات يتقدم على الثابت (الميزة ملك المدير)', () => {
    const custom = 'شكراً {name}! +{earned} ريال، رصيدك {balance}. — {storeName}';
    const msg = buildCreditMessage(vars, custom);
    expect(msg).toBe('شكراً أحمد! +3.75 ريال، رصيدك 12.50. — وردانة');
    expect(msg).not.toContain('بطاقتك'); // نص القالب الثابت لم يُستخدم
  });

  it('فارغ / مسافات / غير ممرر → السقوط على القالب الثابت', () => {
    const fromConstant = buildCreditMessage(vars);
    expect(buildCreditMessage(vars, '')).toBe(fromConstant);
    expect(buildCreditMessage(vars, '   \n  ')).toBe(fromConstant);
    expect(buildCreditMessage(vars, undefined)).toBe(fromConstant);
    expect(fromConstant).toContain('نسعد بخدمتك — وردانة');
  });

  it('findUnknownVars: يكشف الغريب ويتجاهل الخمسة المسموحة', () => {
    expect(findUnknownVars(CREDIT_NOTIFY_TEMPLATE)).toEqual([]);
    expect(findUnknownVars('مرحبا {name} {foo} و{bar} و{earned}')).toEqual(['foo', 'bar']);
    expect(findUnknownVars('نص بلا أقواس إطلاقاً')).toEqual([]);
    expect(findUnknownVars('')).toEqual([]);
    // {memberNo} و{tier} معروفان للمُستبدِل لكن رسالة الرصيد لا تمرر
    // قيمتيهما (فراغ صامت) — يُعدّان غير معروفين في هذا السياق تحديداً
    expect(findUnknownVars('عضويتك {memberNo} فئة {tier}')).toEqual(['memberNo', 'tier']);
    expect(CREDIT_MESSAGE_VARS).toEqual(['name', 'earned', 'balance', 'cardUrl', 'storeName']);
  });
});

describe('رابط wa.me — الرقم بلا + وبلا أصفار بادئة', () => {
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
