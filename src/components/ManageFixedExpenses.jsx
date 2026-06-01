// src/components/ManageFixedExpenses.jsx
// ----------------------------------------------------------
// شاشة المصاريف الثابتة الشهرية (إيجار + رواتب + تأمينات GOSI) لكل فرع.
// مُستخرَجة من App.jsx.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Loader2, ChevronDown, CheckCircle2 } from 'lucide-react';
import { getFixedExpenses, setFixedExpense } from '../firebase';
import { getAvailableMonths, formatMonthLabel } from '../utils/periodHelpers';
import { monthStr } from '../utils/dateHelpers';
import { useScreenHeader } from '../context/ScreenCtx';
import SarSymbol from './SarSymbol';
import BottomSheet from './BottomSheet';

export default function ManageFixedExpenses({ onBack }) {
  useScreenHeader('المصاريف الثابتة', onBack);
  // Batch 31: السماح باختيار الشهر (للسجلات التاريخية + الشهر الحالي)
  const [month, setMonth] = useState(monthStr());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  // كل فرع له 3 بنود: إيجار + رواتب + تأمينات GOSI
  const [toia, setToia] = useState({ rent: '', salaries: '', gosi: '' });
  const [wardana, setWardana] = useState({ rent: '', salaries: '', gosi: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Batch 31: نُفرغ القيم أولاً عند تغيّر الشهر
      setToia({ rent: '', salaries: '', gosi: '' });
      setWardana({ rent: '', salaries: '', gosi: '' });
      try {
        const fixed = await getFixedExpenses(month);
        if (cancelled) return;
        const t = fixed.find((f) => f.branchId === 'toia');
        const w = fixed.find((f) => f.branchId === 'wardana');
        if (t) {
          // إذا الـ breakdown موجود نستخدمه، وإلا نضع المبلغ كله في الإيجار (compat)
          if (t.rent != null || t.salaries != null || t.gosi != null) {
            setToia({
              rent: t.rent != null ? String(t.rent) : '',
              salaries: t.salaries != null ? String(t.salaries) : '',
              gosi: t.gosi != null ? String(t.gosi) : '',
            });
          } else if (t.amount) {
            setToia({ rent: String(t.amount), salaries: '', gosi: '' });
          }
        }
        if (w) {
          if (w.rent != null || w.salaries != null || w.gosi != null) {
            setWardana({
              rent: w.rent != null ? String(w.rent) : '',
              salaries: w.salaries != null ? String(w.salaries) : '',
              gosi: w.gosi != null ? String(w.gosi) : '',
            });
          } else if (w.amount) {
            setWardana({ rent: String(w.amount), salaries: '', gosi: '' });
          }
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر التحميل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [month]);

  const handleSave = async () => {
    setError(''); setDone(false);
    setSaving(true);
    try {
      await setFixedExpense({
        month, branchId: 'toia',
        rent: toia.rent, salaries: toia.salaries, gosi: toia.gosi,
      });
      await setFixedExpense({
        month, branchId: 'wardana',
        rent: wardana.rent, salaries: wardana.salaries, gosi: wardana.gosi,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const sumBranch = (b) =>
    (Number(b.rent) || 0) + (Number(b.salaries) || 0) + (Number(b.gosi) || 0);
  const totalFixed = sumBranch(toia) + sumBranch(wardana);

  // Batch 42: BranchCard كـ helper function (مش inner component) لتجنّب re-mount
  // كل keystroke كان يُعيد إنشاء المكون → الـ input يفقد focus → الكيبورد يختفي.
  // الحل: تحويلها لـ function تعيد JSX (داخل نفس scope الحالي).
  const renderBranchCard = (title, data, setData) => (
    <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-tw-line/60 pb-2">
        <h4 className="text-sm font-bold text-tw-navy">{title}</h4>
        <span className="text-xs font-bold text-tw-blue flex items-center gap-1">
          {sumBranch(data).toLocaleString()} <SarSymbol className="text-[10px]" />
        </span>
      </div>

      {[
        { key: 'rent', label: 'الإيجار' },
        { key: 'salaries', label: 'الرواتب' },
        { key: 'gosi', label: 'التأمينات (GOSI)' },
      ].map((field) => (
        <div key={field.key}>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">{field.label}</label>
          <div className="flex items-center gap-2 bg-tw-soft/40 border border-tw-line rounded-xl p-3">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={data[field.key]}
              onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
              className="flex-1 text-base font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50"
              dir="ltr"
            />
            <SarSymbol className="text-tw-muted/70 text-sm" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="min-h-full relative pb-20"
      style={{
        background: 'transparent',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="relative z-10 p-4 space-y-4">
        {/* Batch 31: منتقي الشهر — قابل للضغط */}
        <button
          onClick={() => setShowMonthPicker(true)}
          className="w-full bg-white rounded-2xl border border-tw-line shadow-sm p-3 flex items-center justify-between"
        >
          <div className="text-right flex-1">
            <p className="text-tw-navy font-bold text-sm">{formatMonthLabel(month, 'ar')}</p>
            <p className="text-tw-muted/70 text-[11px] mt-1">إيجار + رواتب + تأمينات GOSI لكل فرع</p>
          </div>
          <ChevronDown size={16} className="text-tw-muted" />
        </button>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-tw-muted/50" /></div>
        ) : (
          <>
            {renderBranchCard('فرع تويا', toia, setToia)}
            {renderBranchCard('فرع وردانة', wardana, setWardana)}

            {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
            {done && (
              <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> تم الحفظ
              </p>
            )}

            <div
              className="text-white p-4 rounded-2xl flex items-center justify-between relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #082765 0%, #061742 60%, #1E3A8A 100%)',
                boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
              }}
            >
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
              />
              <small className="relative text-xs opacity-95 font-bold">إجمالي المصاريف الثابتة الشهرية</small>
              <b className="relative text-xl font-extrabold flex items-center gap-1.5">
                {totalFixed.toLocaleString()} <SarSymbol className="text-base" />
              </b>
            </div>

            <div className="tw-btn-row pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="tw-btn"
                type="button"
                style={{ flex: 1 }}
              >
                {saving && <Loader2 size={18} className="animate-spin inline-block ml-1" />}
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Batch 31: BottomSheet لاختيار الشهر — من ماي 2024 للحالي */}
      <BottomSheet
        open={showMonthPicker}
        title="اختر الشهر"
        options={getAvailableMonths().map((m) => ({ value: m, label: formatMonthLabel(m, 'ar') }))}
        current={month}
        onPick={(v) => { setMonth(v); setShowMonthPicker(false); }}
        onClose={() => setShowMonthPicker(false)}
      />
    </div>
  );
}
