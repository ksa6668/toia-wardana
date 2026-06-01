// src/components/ReviewsGoalEdit.jsx
// ----------------------------------------------------------
// Batch 49: شاشة إدخال هدف وتحقيق تقييمات قوقل ماب لفرع معيّن
// تفتح عند الضغط على كرت "تقييمات قوقل ماب" في الشاشة الرئيسية للمدير
// تحوي: التقييمات المُحقّقة (فوق) + الهدف الشهري (تحت)
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Loader2, Star, CheckCircle2 } from 'lucide-react';
import { getMonthlyGoal, setMonthlyGoal } from '../firebase';
import { useScreenHeader } from '../context/ScreenCtx';
import BottomSheet from './BottomSheet';
import { formatMonthLabel } from '../utils/periodHelpers';

function availableMonths() {
  const months = [];
  const now = new Date();
  const startYear = 2026;
  const startMonth = 5;
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  let y = startYear, m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months.reverse();
}

export default function ReviewsGoalEdit({ onBack, branchId, branchName, lang = 'ar' }) {
  const title = lang === 'en'
    ? `Reviews Goal - ${branchName}`
    : `هدف التقييمات - ${branchName}`;
  useScreenHeader(title, onBack);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [achieved, setAchieved] = useState('');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const goal = await getMonthlyGoal(branchId, selectedMonth);
        if (cancelled) return;
        setAchieved(goal.reviewsAchieved > 0 ? String(goal.reviewsAchieved) : '');
        setTarget(goal.reviewsTarget > 0 ? String(goal.reviewsTarget) : '');
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر التحميل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branchId, selectedMonth]);

  const handleSave = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      await setMonthlyGoal(branchId, selectedMonth, {
        reviewsAchieved: Number(achieved) || 0,
        reviewsTarget: Number(target) || 0,
      });
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const openMonthPicker = () => {
    setSheet({
      title: lang === 'en' ? 'Pick month' : 'اختر الشهر',
      options: availableMonths().map((m) => ({
        value: m,
        label: formatMonthLabel(m, lang),
      })),
      current: selectedMonth,
      onPick: (v) => { setSelectedMonth(v); setSheet(null); },
    });
  };

  return (
    <div
      className="relative min-h-full px-4 pt-4 pb-8 overflow-y-auto page-bg-soft"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* منتقي الشهر */}
      <button
        onClick={openMonthPicker}
        className="w-full flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-3 px-4 shadow-sm mb-4"
      >
        <Calendar size={14} className="text-tw-blue" />
        <span className="font-bold text-sm text-tw-navy">
          {formatMonthLabel(selectedMonth, lang)}
        </span>
        <ChevronDown size={12} className="text-tw-muted/70" />
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={28} className="animate-spin text-tw-blue" />
        </div>
      ) : (
        <>
          {/* كرت التقييمات المُحقّقة - فوق */}
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-tw-green flex items-center justify-center">
                <CheckCircle2 size={18} />
              </div>
              <h4 className="text-sm font-bold text-tw-navy">
                {lang === 'en' ? 'Reviews achieved' : 'التقييمات المُحقّقة'}
              </h4>
            </div>
            <label className="text-xs text-tw-muted font-bold mb-1.5 block">
              {lang === 'en' ? 'Number received so far' : 'عدد التقييمات التي وصلت'}
            </label>
            <div className="flex items-center gap-2 bg-tw-soft/40 border border-tw-line rounded-xl p-3">
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={achieved}
                onChange={(e) => setAchieved(e.target.value)}
                className="flex-1 text-lg font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50"
                dir="ltr"
              />
              <span className="text-tw-muted/70 text-xs font-bold">
                {lang === 'en' ? 'reviews' : 'تقييم'}
              </span>
            </div>
          </div>

          {/* كرت الهدف الشهري - تحت */}
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-tw-orange flex items-center justify-center">
                <Star size={18} />
              </div>
              <h4 className="text-sm font-bold text-tw-navy">
                {lang === 'en' ? 'Monthly review target' : 'الهدف الشهري'}
              </h4>
            </div>
            <label className="text-xs text-tw-muted font-bold mb-1.5 block">
              {lang === 'en' ? 'Target review count' : 'عدد التقييمات المستهدف'}
            </label>
            <div className="flex items-center gap-2 bg-tw-soft/40 border border-tw-line rounded-xl p-3">
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="flex-1 text-lg font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50"
                dir="ltr"
              />
              <span className="text-tw-muted/70 text-xs font-bold">
                {lang === 'en' ? 'reviews' : 'تقييم'}
              </span>
            </div>
          </div>

          {error && (
            <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mb-3">
              {error}
            </p>
          )}

          {/* زر الحفظ */}
          <div className="tw-btn-row">
            <button
              onClick={handleSave}
              disabled={saving || done}
              className="tw-btn"
              type="button"
              style={{ flex: 1 }}
            >
              {saving && <Loader2 size={18} className="animate-spin inline-block ml-1" />}
              {done
                ? (lang === 'en' ? 'Saved!' : 'تم الحفظ!')
                : saving
                  ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
                  : (lang === 'en' ? 'Save' : 'حفظ')}
            </button>
          </div>
        </>
      )}

      <BottomSheet
        open={!!sheet}
        title={sheet?.title || ''}
        options={sheet?.options || []}
        current={sheet?.current}
        onPick={sheet?.onPick || (() => {})}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
