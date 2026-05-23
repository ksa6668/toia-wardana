// src/components/ManagerGoals.jsx
// ----------------------------------------------------------
// شاشة إدارة الأهداف الشهرية للمدير
// مطابقة لتصميم section#screen-goals في الـ prototype.
//
// تعرض حقول لكل فرع:
//   - هدف المبيعات الشهري (ميزانية)
//   - هدف عدد التقييمات
//
// يحفظ في Firestore عبر setMonthlyGoal()
// المسار: goals/{branchId}_{YYYY-MM}
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, CheckCircle2, Loader2, Target, Star } from 'lucide-react';
import {
  getBranches, getMonthlyGoal, setMonthlyGoal,
} from '../firebase';
import BottomSheet from './BottomSheet';
import BranchIcon from './BranchIcon';
import SarSymbol from './SarSymbol';
import { getNext3Months, formatMonthLabel } from '../utils/periodHelpers';
import { useScreenHeader } from '../App';

export default function ManagerGoals({ onBack, lang = 'ar' }) {
  useScreenHeader(lang === 'en' ? 'Monthly Goals' : 'الأهداف الشهرية', onBack);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [branches, setBranches] = useState([]);
  // map: { [branchId]: { budget, reviewsTarget } }
  const [goals, setGoals] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);

  // تحميل الفروع والأهداف عند تغيير الشهر
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setDone(false);
      try {
        const brs = await getBranches();
        if (cancelled) return;
        setBranches(brs);
        // جلب الأهداف لكل فرع
        const goalsMap = {};
        for (const b of brs) {
          const g = await getMonthlyGoal(b.id, selectedMonth);
          goalsMap[b.id] = {
            budget: g.budget || '',
            reviewsTarget: g.reviewsTarget || '',
          };
        }
        if (!cancelled) setGoals(goalsMap);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل الأهداف');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedMonth]);

  const updateGoal = (branchId, field, value) => {
    setGoals((g) => ({
      ...g,
      [branchId]: { ...g[branchId], [field]: value },
    }));
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      // حفظ كل الأهداف بالتوازي
      const promises = branches.map((b) =>
        setMonthlyGoal(b.id, selectedMonth, goals[b.id] || { budget: 0, reviewsTarget: 0 })
      );
      await Promise.all(promises);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (err) {
      setError(err?.message || 'تعذّر حفظ الأهداف');
    } finally {
      setSaving(false);
    }
  };

  const openMonthPicker = () => setSheet({
    title: lang === 'en' ? 'Pick month' : 'اختر الشهر',
    options: getNext3Months().map((m) => ({ value: m, label: formatMonthLabel(m, lang) })),
    current: selectedMonth,
    onPick: (v) => { setSelectedMonth(v); setSheet(null); },
  });

  return (
    <div
      className="min-h-full relative overflow-hidden"
      style={{
        background: 'transparent',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      <div className="relative z-10 p-4 space-y-4 pb-8">
        {/* منتقي الشهر */}
        <button
          onClick={openMonthPicker}
          className="w-full flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <Calendar size={16} className="text-tw-blue" />
          <span className="font-bold text-sm text-tw-navy">{formatMonthLabel(selectedMonth, lang)}</span>
          <ChevronDown size={14} className="text-tw-muted/70" />
        </button>

        {loading && (
          <div className="flex items-center justify-center py-10 text-tw-muted/70">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}
        {error && (
          <p className="text-tw-red text-xs text-center bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </p>
        )}

        {!loading && !error && branches.map((b) => (
          <div key={b.id} className="space-y-3">
            {/* عنوان الفرع */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
              <div className="flex items-center gap-2 px-3 py-1.5 bg-tw-soft border border-tw-line rounded-full">
                <BranchIcon size={14} className="text-tw-blue" />
                <span className="text-sm font-bold text-tw-navy">
                  {lang === 'en' ? (b.nameEn || b.name) : (b.name.startsWith('فرع') ? b.name : `فرع ${b.name}`)}
                </span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
            </div>

            {/* كارت الميزانية */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-tw-line">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-tw-soft text-tw-blue flex items-center justify-center">
                  <Target size={18} />
                </div>
                <h4 className="text-sm font-bold text-tw-navy">
                  {lang === 'en' ? 'Sales target (budget)' : 'هدف المبيعات الشهرية'}
                </h4>
              </div>
              <label className="text-xs text-tw-muted font-bold mb-1.5 block">
                {lang === 'en' ? 'Target amount' : 'المبلغ المستهدف'}
              </label>
              <div className="flex items-center gap-2 bg-tw-soft/40 border border-tw-line rounded-xl p-3">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={goals[b.id]?.budget || ''}
                  onChange={(e) => updateGoal(b.id, 'budget', e.target.value)}
                  className="flex-1 text-lg font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50"
                  dir="ltr"
                />
                <SarSymbol className="text-tw-muted/70 text-base" />
              </div>
            </div>

            {/* كارت التقييمات */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-tw-line">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-tw-orange flex items-center justify-center">
                  <Star size={18} />
                </div>
                <h4 className="text-sm font-bold text-tw-navy">
                  {lang === 'en' ? 'Google Maps reviews target' : 'هدف تقييمات قوقل ماب'}
                </h4>
              </div>
              <label className="text-xs text-tw-muted font-bold mb-1.5 block">
                {lang === 'en' ? 'Target review count' : 'عدد التقييمات المستهدف'}
              </label>
              <div className="flex items-center gap-2 bg-tw-soft/40 border border-tw-line rounded-xl p-3">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={goals[b.id]?.reviewsTarget || ''}
                  onChange={(e) => updateGoal(b.id, 'reviewsTarget', e.target.value)}
                  className="flex-1 text-lg font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50"
                  dir="ltr"
                />
                <span className="text-tw-muted/70 text-xs font-bold">
                  {lang === 'en' ? 'reviews' : 'تقييم'}
                </span>
              </div>
            </div>
          </div>
        ))}

        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {lang === 'en' ? 'Goals saved' : 'تم حفظ الأهداف'}
          </p>
        )}

        {/* أزرار الإجراءات */}
        {!loading && branches.length > 0 && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={onBack}
              className="flex-1 bg-white border border-tw-line text-tw-navy font-bold py-3.5 rounded-xl hover:bg-tw-soft/40 transition-colors"
            >
              {lang === 'en' ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
              }}
            >
              {saving && <Loader2 size={18} className="animate-spin" />}
              {saving
                ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
                : (lang === 'en' ? 'Save Goals' : 'حفظ الأهداف')}
            </button>
          </div>
        )}
      </div>

      <BottomSheet
        open={!!sheet}
        title={sheet?.title}
        options={sheet?.options || []}
        current={sheet?.current}
        onPick={sheet?.onPick || (() => {})}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
