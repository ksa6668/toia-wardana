// src/components/ManageWhatsappBaseline.jsx
// ----------------------------------------------------------
// Batch 46: إدارة الإجمالي التاريخي لعملاء واتساب لكل فرع
// (مثل صفحة المصاريف الثابتة - رقم واحد لكل فرع)
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, MessageCircle } from 'lucide-react';
import { getWhatsappBaseline, setWhatsappBaseline } from '../firebase';
import { useScreenHeader } from '../App';

export default function ManageWhatsappBaseline({ onBack, lang = 'ar' }) {
  useScreenHeader(lang === 'en' ? 'WhatsApp Baseline' : 'إجمالي عملاء واتساب', onBack);

  const [toia, setToia] = useState('');
  const [wardana, setWardana] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const baselines = await getWhatsappBaseline();
        if (cancelled) return;
        const t = baselines.find((b) => b.id === 'toia');
        const w = baselines.find((b) => b.id === 'wardana');
        setToia(t ? String(t.totalCustomers || 0) : '');
        setWardana(w ? String(w.totalCustomers || 0) : '');
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر التحميل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      await Promise.all([
        setWhatsappBaseline('toia', toia),
        setWhatsappBaseline('wardana', wardana),
      ]);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-tw-blue" size={32} />
      </div>
    );
  }

  const renderBranchCard = (title, value, setValue) => (
    <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-tw-line/60 pb-2">
        <h4 className="text-sm font-bold text-tw-navy">{title}</h4>
        <MessageCircle size={16} className="text-tw-blue" />
      </div>
      <div>
        <label className="text-xs font-bold text-tw-muted mb-1.5 block">
          {lang === 'en' ? 'Total customers to date' : 'إجمالي العملاء حتى اليوم'}
        </label>
        <div className="flex items-center gap-2 bg-tw-soft/40 border border-tw-line rounded-xl p-3">
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 text-base font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50"
            dir="ltr"
          />
          <span className="text-tw-muted/70 text-xs">{lang === 'en' ? 'cust.' : 'عميل'}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-full px-4 pt-4 pb-8 overflow-y-auto page-bg-soft"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      <p className="text-center text-tw-muted text-xs mb-4">
        {lang === 'en'
          ? 'Total historical WhatsApp customers per branch'
          : 'إجمالي عملاء واتساب التاريخي لكل فرع'}
      </p>

      <div className="space-y-3 mb-4">
        {renderBranchCard(lang === 'en' ? 'Toia Branch' : 'فرع تويا', toia, setToia)}
        {renderBranchCard(lang === 'en' ? 'Wardana Branch' : 'فرع وردانة', wardana, setWardana)}
      </div>

      {error && (
        <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mb-3">
          {error}
        </p>
      )}

      <button
        type="button"
        className="tw-btn-save"
        onClick={handleSave}
        disabled={saving || done}
        style={{ width: '100%' }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : done ? <CheckCircle2 size={16} /> : null}
        <span>
          {done
            ? (lang === 'en' ? 'Saved!' : 'تم الحفظ!')
            : saving
              ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
              : (lang === 'en' ? 'Save' : 'حفظ')}
        </span>
      </button>
    </div>
  );
}
