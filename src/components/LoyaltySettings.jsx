// src/components/LoyaltySettings.jsx
// ----------------------------------------------------------
// إعدادات الولاء الأساسية لكل متجر (شاشة مدير فرعية):
// النقاط لكل ريال، أساس الاحتساب والضريبة، مدد الانتهاء والنافذة،
// المكافآت، الفئات، المصادر (تعطيل بدل حذف)، والرسالة الترحيبية.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { getLoyaltySettings, setLoyaltySettings } from '../firebase';
import { useScreenHeader } from '../context/ScreenCtx';
import { translateBranch } from '../i18n';

// صف إعداد (تسمية + حقل) — خارج المكوّن حتى لا يفقد الحقل التركيز عند كل render
function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-bold text-tw-navy flex-shrink-0">{label}</span>
      <div className="w-28">{children}</div>
    </div>
  );
}

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

  const setReward = (idx, key, value) => {
    setS((prev) => {
      const rewards = prev.rewards.map((r, i) => (i === idx ? { ...r, [key]: value } : r));
      return { ...prev, rewards };
    });
  };
  const setTier = (idx, key, value) => {
    setS((prev) => {
      const tiers = prev.tiers.map((t, i) => (i === idx ? { ...t, [key]: value } : t));
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

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      // تنقية الأرقام قبل الحفظ (حقول فارغة → افتراضي منطقي)
      const clean = {
        enabled: s.enabled !== false,
        pointsPerRiyal: Number(s.pointsPerRiyal) || 0,
        vatRegistered: !!s.vatRegistered,
        pointsBasis: s.vatRegistered ? s.pointsBasis : 'gross',
        vatRate: Number(s.vatRate) || 0,
        expiryMonths: Number(s.expiryMonths) || 0,
        tierWindowMonths: Number(s.tierWindowMonths) || 0,
        largeTransactionAlert: Number(s.largeTransactionAlert) || 0,
        tiers: (s.tiers || []).map((t) => ({
          ...t,
          min: Number(t.min) || 0,
          max: t.max === '' || t.max == null ? null : Number(t.max),
        })),
        rewards: (s.rewards || []).map((r) => ({
          ...r,
          value: Number(r.value) || 0,
          points: Number(r.points) || 0,
          active: r.active !== false,
        })),
        sources: s.sources || [],
        welcomeMessage: s.welcomeMessage || '',
      };
      await setLoyaltySettings(store, clean);
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

  return (
    <div
      className="min-h-full px-4 pt-3 pb-8 space-y-3"
      style={{ fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif' }}
    >
      {/* عام */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-3">
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'General' : 'عام'}</h4>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-xs font-bold text-tw-navy">{en ? 'Program enabled' : 'البرنامج مفعّل'}</span>
          <input type="checkbox" checked={s.enabled !== false}
                 onChange={(e) => set('enabled', e.target.checked)} className="w-4 h-4 accent-[#005BFF]" />
        </label>
        <Row label={en ? 'Points per riyal' : 'النقاط لكل ريال'}>
          <input type="number" inputMode="decimal" min="0" value={s.pointsPerRiyal}
                 onChange={(e) => setNum('pointsPerRiyal', e.target.value)} className={numCls} />
        </Row>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-xs font-bold text-tw-navy">{en ? 'VAT registered' : 'منشأة مسجلة بالضريبة'}</span>
          <input type="checkbox" checked={!!s.vatRegistered}
                 onChange={(e) => {
                   set('vatRegistered', e.target.checked);
                   set('pointsBasis', e.target.checked ? 'net' : 'gross');
                 }} className="w-4 h-4 accent-[#005BFF]" />
        </label>
        {s.vatRegistered && (
          <Row label={en ? 'VAT rate' : 'نسبة الضريبة'}>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={s.vatRate}
                   onChange={(e) => setNum('vatRate', e.target.value)} className={numCls} />
          </Row>
        )}
        <p className="text-[11px] text-tw-muted font-semibold">
          {en
            ? `Points basis: ${s.vatRegistered ? 'net (excl. VAT)' : 'gross'}`
            : `أساس الاحتساب: ${s.vatRegistered ? 'الصافي (قبل الضريبة)' : 'الإجمالي'}`}
        </p>
        <Row label={en ? 'Points expiry (months)' : 'انتهاء النقاط (شهور)'}>
          <input type="number" inputMode="numeric" min="0" value={s.expiryMonths}
                 onChange={(e) => setNum('expiryMonths', e.target.value)} className={numCls} />
        </Row>
        <Row label={en ? 'Tier window (months)' : 'نافذة الفئة (شهور)'}>
          <input type="number" inputMode="numeric" min="0" value={s.tierWindowMonths}
                 onChange={(e) => setNum('tierWindowMonths', e.target.value)} className={numCls} />
        </Row>
        <Row label={en ? 'Large purchase alert (SAR)' : 'تنبيه شراء كبير (ريال)'}>
          <input type="number" inputMode="numeric" min="0" value={s.largeTransactionAlert}
                 onChange={(e) => setNum('largeTransactionAlert', e.target.value)} className={numCls} />
        </Row>
      </div>

      {/* الفئات */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-2">
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Tiers' : 'الفئات'}</h4>
        <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 text-[10px] font-bold text-tw-muted">
          <span>{en ? 'Name' : 'الاسم'}</span><span className="text-center">{en ? 'Min' : 'من'}</span><span className="text-center">{en ? 'Max' : 'إلى'}</span>
        </div>
        {(s.tiers || []).map((tr, i) => (
          <div key={tr.key} className="grid grid-cols-[1fr_5rem_5rem] gap-2">
            <input type="text" value={tr.name} onChange={(e) => setTier(i, 'name', e.target.value)} className={inputCls} />
            <input type="number" inputMode="numeric" value={tr.min}
                   onChange={(e) => setTier(i, 'min', e.target.value === '' ? '' : Number(e.target.value))} className={numCls} />
            <input type="number" inputMode="numeric" value={tr.max == null ? '' : tr.max}
                   placeholder="∞"
                   onChange={(e) => setTier(i, 'max', e.target.value === '' ? null : Number(e.target.value))} className={numCls} />
          </div>
        ))}
      </div>

      {/* المكافآت */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-2">
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Rewards' : 'المكافآت'}</h4>
        <div className="grid grid-cols-[1fr_4.5rem_5.5rem_2rem] gap-2 text-[10px] font-bold text-tw-muted">
          <span>{en ? 'Label' : 'الاسم'}</span><span className="text-center">{en ? 'Value' : 'القيمة'}</span><span className="text-center">{en ? 'Points' : 'النقاط'}</span><span />
        </div>
        {(s.rewards || []).map((r, i) => (
          <div key={r.id} className="grid grid-cols-[1fr_4.5rem_5.5rem_2rem] gap-2 items-center">
            <input type="text" value={r.label} onChange={(e) => setReward(i, 'label', e.target.value)} className={inputCls} />
            <input type="number" inputMode="numeric" value={r.value}
                   onChange={(e) => setReward(i, 'value', e.target.value === '' ? '' : Number(e.target.value))} className={numCls} />
            <input type="number" inputMode="numeric" value={r.points}
                   onChange={(e) => setReward(i, 'points', e.target.value === '' ? '' : Number(e.target.value))} className={numCls} />
            <input type="checkbox" checked={r.active !== false}
                   onChange={(e) => setReward(i, 'active', e.target.checked)}
                   title={en ? 'Active' : 'مفعّلة'} className="w-4 h-4 accent-[#005BFF] justify-self-center" />
          </div>
        ))}
      </div>

      {/* المصادر — تعطيل بدل الحذف */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-2">
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

      {/* الرسالة الترحيبية */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-2">
        <h4 className="font-bold text-sm text-tw-navy">{en ? 'Welcome message' : 'الرسالة الترحيبية'}</h4>
        <textarea rows={6} value={s.welcomeMessage || ''}
                  onChange={(e) => set('welcomeMessage', e.target.value)}
                  className={inputCls} style={{ resize: 'none' }} />
        {/* المرحلة 2: تُرسل عبر واتساب مع رابط البطاقة — المتغيرات تُستبدل تلقائياً */}
        <p className="text-[11px] text-tw-muted font-semibold leading-relaxed" dir="ltr" style={{ textAlign: en ? 'left' : 'right' }}>
          {'{name} {storeName} {memberNo} {tier} {points} {cardUrl}'}
        </p>
        <p className="text-[11px] text-tw-muted font-semibold">
          {en
            ? 'Supported variables above are replaced automatically when sending the card via WhatsApp.'
            : 'المتغيرات أعلاه تُستبدل تلقائياً عند إرسال البطاقة عبر واتساب.'}
        </p>
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
