// src/components/ExpenseBudgetEdit.jsx
// ----------------------------------------------------------
// Batch 76: شاشة إدخال ميزانية المصروفات الشهرية لفرع معيّن
// تفتح عند الضغط على كرت "المصروفات" في الشاشة الرئيسية للموظف.
// نسخة من BudgetGoalEdit لكنها تقرأ/تحفظ حقل expenseBudget
// المستقل تماماً عن budget (ميزانية المبيعات) — setDoc merge فقط.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Loader2, Wallet } from 'lucide-react';
import { getMonthlyGoal, setMonthlyGoal } from '../firebase';
import { useScreenHeader } from '../context/ScreenCtx';
import BottomSheet from './BottomSheet';
import SarSymbol from './SarSymbol';
import { formatMonthLabel, getMonthsFrom } from '../utils/periodHelpers';
import { toLatinDigits } from '../utils/digits';

export default function ExpenseBudgetEdit({ onBack, branchId, branchName, lang = 'ar' }) {
  const title = lang === 'en'
    ? `Expense Budget - ${branchName}`
    : `ميزانية المصروفات - ${branchName}`;
  useScreenHeader(title, onBack);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [expenseBudget, setExpenseBudget] = useState('');
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
        setExpenseBudget(goal.expenseBudget > 0 ? String(goal.expenseBudget) : '');
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
      // حقل expenseBudget فقط — لا نمرّر budget حتى لا نمسّ ميزانية المبيعات
      await setMonthlyGoal(branchId, selectedMonth, {
        expenseBudget: Number(expenseBudget) || 0,
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
      options: getMonthsFrom().map((m) => ({
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
          {/* كرت إدخال ميزانية المصروفات */}
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-xl bg-tw-soft text-tw-blue flex items-center justify-center">
                <Wallet size={18} />
              </div>
              <h4 className="text-sm font-bold text-tw-navy">
                {lang === 'en' ? 'Monthly expense budget' : 'ميزانية المصروفات الشهرية'}
              </h4>
            </div>
            <label className="text-xs text-tw-muted font-bold mb-1.5 block">
              {lang === 'en' ? 'Budget amount' : 'المبلغ المستهدف'}
            </label>
            <div className="flex items-center gap-2 bg-tw-soft/40 border border-tw-line rounded-xl p-3">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={expenseBudget}
                onChange={(e) => setExpenseBudget(toLatinDigits(e.target.value))}
                className="flex-1 text-lg font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50"
                dir="ltr"
              />
              <SarSymbol className="text-tw-muted/70 text-base" />
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
