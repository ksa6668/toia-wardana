// src/components/LoyaltySettings.jsx
// ----------------------------------------------------------
// إعدادات الولاء لكل متجر (شاشة مدير فرعية) — النسخة 3.0.
// تسعة أقسام: الكسب والفئات، الرصيد، الترحيبية، الضريبة، المصادر،
// قنوات التواصل، حد التنبيه، تفعيل البرنامج، والرسائل.
// القيم تُدخل بالريال في الواجهة وتُخزَّن بالهللات (أعداد صحيحة).
// تحقق إلزامي عند الحفظ برسائل عربية واضحة + سطر مثال حي يتفاعل
// مع تغيير النسب قبل الحفظ.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Loader2, Plus, RotateCcw, AlertTriangle } from 'lucide-react';
import { getLoyaltySettings, setLoyaltySettings } from '../firebase';
import {
  CREDIT_NOTIFY_TEMPLATE,
  CREDIT_MESSAGE_VARS,
  WELCOME_MESSAGE_VARS,
  EXPIRY_MESSAGE_VARS,
  findUnknownVars,
  buildCreditMessage,
  STORE_NAMES,
} from '../loyaltyShare';
import { computeEarnedHalalas, halalasToRiyalLabel, riyalsToHalalas } from '../loyaltyMath';
import { useScreenHeader } from '../context/ScreenCtx';
import { translateBranch } from '../i18n';
import { toLatinDigits } from '../utils/digits';

// صف إعداد (تسمية + حقل) — خارج المكوّن حتى لا يفقد الحقل التركيز عند كل render
function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-bold text-tw-navy flex-shrink-0">{label}</span>
      <div className="w-28">{children}</div>
    </div>
  );
}

const TIER_KEYS = ['silver', 'gold', 'platinum'];
const TIER_AR = { silver: 'فضية', gold: 'ذهبية', platinum: 'بلاتينية' };
const TIER_EN = { silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };

export default function LoyaltySettings({ store, lang, onBack }) {
  const en = lang === 'en';
  useScreenHeader(
    (en ? 'Loyalty settings — ' : 'إعدادات الولاء — ') + translateBranch(lang, store, store),
    onBack
  );

  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [newSource, setNewSource] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getLoyaltySettings(store);
        if (!cancelled) setS(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || (en ? 'Failed to load' : 'تعذّر التحميل'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // en للنص فقط
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const set = (key, value) => setS((prev) => ({ ...prev, [key]: value }));
  const setNum = (key, value) => set(key, value === '' ? '' : Number(value));
  // القيم الريالية تُعرض ريالاً وتبقى في الحالة هللات — التحويل عند الإدخال
  const setRiyal = (key, value) => set(key, value === '' ? '' : riyalsToHalalas(value) ?? '');
  const riyalValue = (halalas) => (halalas === '' || halalas == null ? '' : Number(halalas) / 100);

  const setTier = (idx, key, value) => {
    setS((prev) => {
      const tiers = prev.tiers.map((t, i) => (i === idx ? { ...t, [key]: value } : t));
      return { ...prev, tiers };
    });
  };
  const setTierName = (idx, nameLang, value) => {
    setS((prev) => {
      const tiers = prev.tiers.map((t, i) =>
        i === idx ? { ...t, name: { ...(typeof t.name === 'object' ? t.name : { ar: String(t.name || '') }), [nameLang]: value } } : t
      );
      return { ...prev, tiers };
    });
  };
  const setSource = (idx, key, value) => {
    setS((prev) => {
      const sources = prev.sources.map((x, i) => (i === idx ? { ...x, [key]: value } : x));
      return { ...prev, sources };
    });
  };
  const addSource = () => {
    const label = newSource.trim();
    if (!label) return;
    setS((prev) => ({
      ...prev,
      sources: [...(prev.sources || []), { id: `s${Date.now()}`, label, active: true }],
    }));
    setNewSource('');
  };
  const setMessage = (key, msgLang, value) => {
    setS((prev) => ({
      ...prev,
      [key]: { ...(typeof prev[key] === 'object' ? prev[key] : {}), [msgLang]: value },
    }));
  };
  const setContact = (key, value) => {
    setS((prev) => ({ ...prev, contacts: { ...(prev.contacts || {}), [key]: value } }));
  };

  // ---- التحقق الإلزامي عند الحفظ — رسائل عربية واضحة ----
  const validate = (tiers) => {
    const [silver, gold, platinum] = tiers;
    for (const t of tiers) {
      const rate = Number(t.ratePercent);
      // حماية من خطأ إدخال يكلّف مالاً — كل نسبة بين 0 و10
      if (!(rate > 0 && rate <= 10)) {
        return en
          ? `Earn rate for ${TIER_EN[t.key]} must be between 0 and 10`
          : `نسبة كسب «${TIER_AR[t.key]}» يجب أن تكون بين 0 و10`;
      }
    }
    if (!(Number(silver.ratePercent) <= Number(gold.ratePercent)
        && Number(gold.ratePercent) <= Number(platinum.ratePercent))) {
      return en
        ? 'Rates must be ascending: Silver ≤ Gold ≤ Platinum'
        : 'النسب يجب أن تكون تصاعدية: فضية ≤ ذهبية ≤ بلاتينية';
    }
    const goldMin = Number(gold.minEarnedHalalas);
    const platMin = Number(platinum.minEarnedHalalas);
    if (!(goldMin > 0) || !(platMin > 0)) {
      return en ? 'Tier thresholds must be positive' : 'عتبات الفئات يجب أن تكون أكبر من صفر';
    }
    if (!(goldMin < platMin)) {
      return en
        ? 'Thresholds must be ascending: Gold < Platinum'
        : 'العتبات يجب أن تكون تصاعدية: عتبة الذهبية أقل من عتبة البلاتينية';
    }
    return null;
  };

  const handleSave = async () => {
    setMsg('');
    setError('');
    // تنقية الأرقام قبل الحفظ (حقول فارغة → افتراضي منطقي)
    const tiers = TIER_KEYS.map((key, i) => {
      const t = (s.tiers || [])[i] || { key };
      return {
        key,
        name: typeof t.name === 'object' ? t.name : { ar: String(t.name || TIER_AR[key]), en: TIER_EN[key] },
        minEarnedHalalas: key === 'silver' ? 0 : Math.round(Number(t.minEarnedHalalas) || 0),
        ratePercent: Number(t.ratePercent) || 0,
      };
    });
    const invalid = validate(tiers);
    if (invalid) { setError(invalid); return; }

    setSaving(true);
    try {
      const clean = {
        enabled: s.enabled !== false,
        tiers,
        tierWindowMonths: Number(s.tierWindowMonths) || 24,
        expiryMonths: Number(s.expiryMonths) || 12,
        expiryWarningDays: Number(s.expiryWarningDays) || 30,
        earnRoundingHalalas: Math.max(1, Math.round(Number(s.earnRoundingHalalas) || 25)),
        redeemStepHalalas: Math.max(1, Math.round(Number(s.redeemStepHalalas) || 25)),
        welcomeBonusEnabled: s.welcomeBonusEnabled !== false,
        welcomeBonusHalalas: Math.max(0, Math.round(Number(s.welcomeBonusHalalas) || 0)),
        welcomeBonusDelayHours: Math.max(0, Number(s.welcomeBonusDelayHours) || 0),
        vatRegistered: !!s.vatRegistered,
        amountBasis: s.vatRegistered ? 'net' : 'gross',
        vatRate: Number(s.vatRate) || 0,
        largeTransactionAlertRiyals: Math.max(0, Number(s.largeTransactionAlertRiyals) || 0),
        sources: s.sources || [],
        contacts: {
          whatsapp: String(s.contacts?.whatsapp || '').trim(),
          instagram: String(s.contacts?.instagram || '').trim(),
          tiktok: String(s.contacts?.tiktok || '').trim(),
        },
        welcomeMessage: {
          ar: s.welcomeMessage?.ar || '',
          en: s.welcomeMessage?.en || '',
        },
        expiryWarningMessage: {
          ar: s.expiryWarningMessage?.ar || '',
          en: s.expiryWarningMessage?.en || '',
        },
        // إشعار الرصيد — فارغ = السقوط على القالب الثابت وقت الإرسال
        creditMessage: s.creditMessage || '',
      };
      await setLoyaltySettings(store, clean);
      setS((prev) => ({ ...prev, ...clean }));
      setMsg(en ? 'Saved ✓' : 'تم الحفظ ✓');
    } catch (err) {
      setError(err?.message || (en ? 'Save failed' : 'تعذّر الحفظ'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-tw-muted">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm font-bold">{en ? 'Loading…' : 'جارٍ التحميل…'}</span>
      </div>
    );
  }
  if (!s) return <p className="p-6 text-center text-sm font-bold text-tw-red">{error || '—'}</p>;

  const inputCls = 'w-full p-2.5 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue';
  const numCls = `${inputCls} text-center font-mono`;
  const cardCls = 'bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-3';

  // سطر المثال الحي — يتفاعل فوراً مع تغيير النسب/التقريب قبل الحفظ
  const example = (() => {
    const amountHalalas = 15000; // فاتورة 150 ريالاً
    const roundStep = Math.max(1, Math.round(Number(s.earnRoundingHalalas) || 25));
    const conf = { earnRoundingHalalas: roundStep, amountBasis: 'gross' };
    const parts = TIER_KEYS.map((key, i) => {
      const rate = Number((s.tiers || [])[i]?.ratePercent) || 0;
      const earned = computeEarnedHalalas(amountHalalas, rate, conf);
      return `${en ? TIER_EN[key] : TIER_AR[key]} ${halalasToRiyalLabel(earned)}`;
    });
    return en
      ? `A SAR 150 invoice earns: ${parts.join(' • ')} SAR`
      : `فاتورة 150 ريالًا تكسب: ${parts.join(' • ')} ريال`;
  })();

  const msgHelp = (vars) => (
    <p className="text-[11px] text-tw-muted font-semibold leading-relaxed" dir="ltr" style={{ textAlign: en ? 'left' : 'right' }}>
      {vars.map((v) => `{${v}}`).join(' ')}
    </p>
  );

  return (
    <div
      className="min-h-full px-4 pt-3 pb-8 space-y-3"
      style={{ fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif' }}
    >
      {/* 1) الكسب والفئات */}
      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Earning & tiers' : 'الكسب والفئات'}</h4>
        {TIER_KEYS.map((key, i) => (
          <Row key={key} label={en ? `${TIER_EN[key]} rate %` : `نسبة كسب ${TIER_AR[key]} ٪`}>
            <input type="number" inputMode="decimal" min="0" max="10" step="0.05"
                   value={(s.tiers || [])[i]?.ratePercent ?? ''}
                   onChange={(e) => setTier(i, 'ratePercent', e.target.value === '' ? '' : Number(toLatinDigits(e.target.value)))}
                   className={numCls} />
          </Row>
        ))}
        {/* العتبات تُدخل بالريال وتُخزَّن هللات — الفضية ثابتة عند 0 */}
        <Row label={en ? 'Gold threshold (SAR)' : 'عتبة الذهبية (ريال)'}>
          <input type="number" inputMode="decimal" min="0"
                 value={riyalValue((s.tiers || [])[1]?.minEarnedHalalas)}
                 onChange={(e) => setTier(1, 'minEarnedHalalas', e.target.value === '' ? '' : riyalsToHalalas(toLatinDigits(e.target.value)) ?? '')}
                 className={numCls} />
        </Row>
        <Row label={en ? 'Platinum threshold (SAR)' : 'عتبة البلاتينية (ريال)'}>
          <input type="number" inputMode="decimal" min="0"
                 value={riyalValue((s.tiers || [])[2]?.minEarnedHalalas)}
                 onChange={(e) => setTier(2, 'minEarnedHalalas', e.target.value === '' ? '' : riyalsToHalalas(toLatinDigits(e.target.value)) ?? '')}
                 className={numCls} />
        </Row>
        <Row label={en ? 'Tier window (months)' : 'نافذة احتساب الفئة (شهور)'}>
          <input type="number" inputMode="numeric" min="1" value={s.tierWindowMonths}
                 onChange={(e) => setNum('tierWindowMonths', toLatinDigits(e.target.value))} className={numCls} />
        </Row>
        {/* أسماء الفئات (ar/en) — تظهر في البطاقة والواجهة */}
        <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 text-[10px] font-bold text-tw-muted">
          <span /><span className="text-center">{en ? 'Arabic name' : 'الاسم عربي'}</span><span className="text-center">{en ? 'English name' : 'الاسم إنجليزي'}</span>
        </div>
        {TIER_KEYS.map((key, i) => (
          <div key={key} className="grid grid-cols-[4rem_1fr_1fr] gap-2 items-center">
            <span className="text-[11px] font-bold text-tw-muted">{en ? TIER_EN[key] : TIER_AR[key]}</span>
            <input type="text" value={(s.tiers || [])[i]?.name?.ar ?? ''} onChange={(e) => setTierName(i, 'ar', e.target.value)} className={inputCls} />
            <input type="text" dir="ltr" value={(s.tiers || [])[i]?.name?.en ?? ''} onChange={(e) => setTierName(i, 'en', e.target.value)} className={inputCls} />
          </div>
        ))}
        {/* المثال الحي — بعد تطبيق التقريب لأقرب ربع ريال */}
        <p className="text-[11px] font-bold text-tw-blue bg-tw-soft/50 border border-tw-line rounded-xl p-2.5">
          {example}
        </p>
      </div>

      {/* 2) الرصيد */}
      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Balance' : 'الرصيد'}</h4>
        <Row label={en ? 'Balance expiry (months)' : 'مدة انتهاء الرصيد (شهور)'}>
          <input type="number" inputMode="numeric" min="1" value={s.expiryMonths}
                 onChange={(e) => setNum('expiryMonths', toLatinDigits(e.target.value))} className={numCls} />
        </Row>
        <Row label={en ? 'Expiry warning (days)' : 'أيام التنبيه قبل الانتهاء'}>
          <input type="number" inputMode="numeric" min="1" value={s.expiryWarningDays}
                 onChange={(e) => setNum('expiryWarningDays', toLatinDigits(e.target.value))} className={numCls} />
        </Row>
        <Row label={en ? 'Earn rounding (halalas)' : 'تقريب الكسب (هللة)'}>
          <input type="number" inputMode="numeric" min="1" value={s.earnRoundingHalalas}
                 onChange={(e) => setNum('earnRoundingHalalas', toLatinDigits(e.target.value))} className={numCls} />
        </Row>
        <Row label={en ? 'Redeem step (halalas)' : 'خطوة الاستبدال (هللة)'}>
          <input type="number" inputMode="numeric" min="1" value={s.redeemStepHalalas}
                 onChange={(e) => setNum('redeemStepHalalas', toLatinDigits(e.target.value))} className={numCls} />
        </Row>
        <p className="text-[11px] text-tw-muted font-semibold">
          {en ? '25 halalas = quarter riyal.' : '25 هللة = ربع ريال.'}
        </p>
      </div>

      {/* 3) المكافأة الترحيبية */}
      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Welcome bonus' : 'المكافأة الترحيبية'}</h4>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-xs font-bold text-tw-navy">{en ? 'Enabled' : 'مفعّلة'}</span>
          <input type="checkbox" checked={s.welcomeBonusEnabled !== false}
                 onChange={(e) => set('welcomeBonusEnabled', e.target.checked)} className="w-4 h-4 accent-[#005BFF]" />
        </label>
        <Row label={en ? 'Value (SAR)' : 'القيمة (ريال)'}>
          <input type="number" inputMode="decimal" min="0" step="0.25" value={riyalValue(s.welcomeBonusHalalas)}
                 onChange={(e) => setRiyal('welcomeBonusHalalas', toLatinDigits(e.target.value))} className={numCls} />
        </Row>
        <Row label={en ? 'Hold delay (hours)' : 'مدة التأخير (ساعة)'}>
          <input type="number" inputMode="numeric" min="0" value={s.welcomeBonusDelayHours}
                 onChange={(e) => setNum('welcomeBonusDelayHours', toLatinDigits(e.target.value))} className={numCls} />
        </Row>
      </div>

      {/* 4) الضريبة */}
      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'VAT' : 'الضريبة'}</h4>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-xs font-bold text-tw-navy">{en ? 'VAT registered' : 'منشأة مسجلة بالضريبة'}</span>
          <input type="checkbox" checked={!!s.vatRegistered}
                 onChange={(e) => {
                   set('vatRegistered', e.target.checked);
                   set('amountBasis', e.target.checked ? 'net' : 'gross');
                 }} className="w-4 h-4 accent-[#005BFF]" />
        </label>
        {s.vatRegistered && (
          <Row label={en ? 'VAT rate' : 'نسبة الضريبة'}>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={s.vatRate}
                   onChange={(e) => setNum('vatRate', toLatinDigits(e.target.value))} className={numCls} />
          </Row>
        )}
        <p className="text-[11px] text-tw-muted font-semibold">
          {en
            ? `Earn basis: ${s.vatRegistered ? 'net (excl. VAT)' : 'gross'}`
            : `أساس الاحتساب: ${s.vatRegistered ? 'الصافي (قبل الضريبة)' : 'الإجمالي'}`}
        </p>
      </div>

      {/* 5) المصادر — تعطيل بدل الحذف */}
      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Acquisition sources' : 'مصادر التعرف'}</h4>
        {(s.sources || []).map((src, i) => (
          <div key={src.id} className="flex items-center gap-2">
            <input type="text" value={src.label} onChange={(e) => setSource(i, 'label', e.target.value)} className={inputCls} />
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-tw-muted flex-shrink-0 cursor-pointer">
              <input type="checkbox" checked={src.active !== false}
                     onChange={(e) => setSource(i, 'active', e.target.checked)} className="w-4 h-4 accent-[#005BFF]" />
              {en ? 'active' : 'مفعّل'}
            </label>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)}
                 placeholder={en ? 'New source…' : 'مصدر جديد…'} className={inputCls}
                 onKeyDown={(e) => { if (e.key === 'Enter') addSource(); }} />
          <button type="button" onClick={addSource}
                  className="p-2.5 rounded-xl bg-tw-soft text-tw-blue flex-shrink-0 hover:bg-tw-soft/70">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* 6) قنوات التواصل — تُعرض في صفحة البطاقة (المرحلة B) */}
      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Contact channels' : 'قنوات التواصل'}</h4>
        <Row label={en ? 'WhatsApp' : 'واتساب'}>
          <input type="text" dir="ltr" value={s.contacts?.whatsapp || ''}
                 onChange={(e) => setContact('whatsapp', toLatinDigits(e.target.value))} className={numCls} />
        </Row>
        <Row label={en ? 'Instagram' : 'انستقرام'}>
          <input type="text" dir="ltr" value={s.contacts?.instagram || ''}
                 onChange={(e) => setContact('instagram', e.target.value)} className={numCls} />
        </Row>
        <Row label={en ? 'TikTok' : 'تيك توك'}>
          <input type="text" dir="ltr" value={s.contacts?.tiktok || ''}
                 onChange={(e) => setContact('tiktok', e.target.value)} className={numCls} />
        </Row>
      </div>

      {/* 7) حد التنبيه على العمليات الكبيرة */}
      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Large transaction alert' : 'التنبيه على العمليات الكبيرة'}</h4>
        <Row label={en ? 'Threshold (SAR)' : 'الحد (ريال)'}>
          <input type="number" inputMode="numeric" min="0" value={s.largeTransactionAlertRiyals}
                 onChange={(e) => setNum('largeTransactionAlertRiyals', toLatinDigits(e.target.value))} className={numCls} />
        </Row>
      </div>

      {/* 8) تفعيل البرنامج */}
      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Program' : 'البرنامج'}</h4>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-xs font-bold text-tw-navy">{en ? 'Program enabled' : 'البرنامج مفعّل'}</span>
          <input type="checkbox" checked={s.enabled !== false}
                 onChange={(e) => set('enabled', e.target.checked)} className="w-4 h-4 accent-[#005BFF]" />
        </label>
      </div>

      {/* 9) الرسائل — حقلان (عربي/إنجليزي) للترحيبية ولتنبيه الانتهاء */}
      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Welcome message' : 'الرسالة الترحيبية'}</h4>
        <p className="text-[10px] font-bold text-tw-muted">{en ? 'Arabic' : 'عربي'}</p>
        <textarea rows={5} value={s.welcomeMessage?.ar || ''}
                  onChange={(e) => setMessage('welcomeMessage', 'ar', e.target.value)}
                  className={inputCls} style={{ resize: 'none' }} />
        <p className="text-[10px] font-bold text-tw-muted">{en ? 'English' : 'إنجليزي'}</p>
        <textarea rows={5} dir="ltr" value={s.welcomeMessage?.en || ''}
                  onChange={(e) => setMessage('welcomeMessage', 'en', e.target.value)}
                  className={inputCls} style={{ resize: 'none' }} />
        {msgHelp(WELCOME_MESSAGE_VARS)}
        <p className="text-[11px] text-tw-muted font-semibold">
          {en
            ? 'Variables above are replaced automatically when sending the card via WhatsApp.'
            : 'المتغيرات أعلاه تُستبدل تلقائياً عند إرسال البطاقة عبر واتساب.'}
        </p>
      </div>

      <div className={cardCls}>
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Expiry warning message' : 'رسالة تنبيه الانتهاء'}</h4>
        <p className="text-[10px] font-bold text-tw-muted">{en ? 'Arabic' : 'عربي'}</p>
        <textarea rows={4} value={s.expiryWarningMessage?.ar || ''}
                  onChange={(e) => setMessage('expiryWarningMessage', 'ar', e.target.value)}
                  className={inputCls} style={{ resize: 'none' }} />
        <p className="text-[10px] font-bold text-tw-muted">{en ? 'English' : 'إنجليزي'}</p>
        <textarea rows={4} dir="ltr" value={s.expiryWarningMessage?.en || ''}
                  onChange={(e) => setMessage('expiryWarningMessage', 'en', e.target.value)}
                  className={inputCls} style={{ resize: 'none' }} />
        {msgHelp(EXPIRY_MESSAGE_VARS)}
      </div>

      {/* رسالة إشعار الرصيد — نص عربي واحد الآن ({ar,en} في المرحلة B)، بمعاينة حيّة */}
      <div className={cardCls}>
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-sm text-tw-navy">{en ? 'Credit notification message' : 'رسالة إشعار الرصيد'}</h4>
          <button
            type="button"
            onClick={() => set('creditMessage', CREDIT_NOTIFY_TEMPLATE)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tw-soft text-tw-blue text-[10px] font-bold hover:bg-tw-soft/70 flex-shrink-0"
          >
            <RotateCcw size={12} /> {en ? 'Restore default' : 'استعادة النص الافتراضي'}
          </button>
        </div>
        <textarea rows={6} value={s.creditMessage || ''}
                  onChange={(e) => set('creditMessage', e.target.value)}
                  className={inputCls} style={{ resize: 'none' }} />
        {msgHelp(CREDIT_MESSAGE_VARS)}
        <p className="text-[11px] text-tw-muted font-semibold">
          {en
            ? 'Sent after adding credit. Empty field = the built-in default text.'
            : 'تُرسل بعد إضافة الرصيد. الحقل الفارغ = النص الافتراضي المدمج.'}
        </p>
        {/* تحذير غير مانع للحفظ — متغيرات {...} خارج الخمسة أعلاه */}
        {(() => {
          const unknown = findUnknownVars(s.creditMessage || '');
          if (!unknown.length) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-amber-700">
                {en ? 'Unknown variables (left as-is when sending): ' : 'متغيرات غير معروفة (ستُترك كما هي عند الإرسال): '}
                <span dir="ltr">{unknown.map((u) => `{${u}}`).join(' ')}</span>
              </p>
            </div>
          );
        })()}
        {/* معاينة حيّة ببيانات وهمية ثابتة */}
        <div className="bg-tw-soft/40 border border-tw-line rounded-xl p-3">
          <p className="text-[10px] font-bold text-tw-muted mb-1.5">{en ? 'Live preview' : 'معاينة حيّة'}</p>
          <p className="text-xs font-semibold text-tw-navy whitespace-pre-line leading-relaxed">
            {buildCreditMessage({
              name: 'أحمد',
              earned: '3.75',
              balance: '12.50',
              cardUrl: 'https://example.com/c/xxxxxxxx',
              storeName: STORE_NAMES[store] || store,
            }, s.creditMessage)}
          </p>
        </div>
      </div>

      {msg && <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl p-2.5 text-center">{msg}</p>}
      {error && <p className="text-xs font-bold text-tw-red bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">{error}</p>}

      <button type="button" onClick={handleSave} disabled={saving}
              className="w-full py-3 rounded-xl bg-tw-blue text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
        {saving && <Loader2 size={16} className="animate-spin" />}
        {saving ? (en ? 'Saving…' : 'جارٍ الحفظ…') : (en ? 'Save settings' : 'حفظ الإعدادات')}
      </button>
    </div>
  );
}
