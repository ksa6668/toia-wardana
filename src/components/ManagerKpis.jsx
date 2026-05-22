// src/components/ManagerKpis.jsx
// ----------------------------------------------------------
// شاشة المؤشرات (KPIs) للمدير
// مطابقة لتصميم section#screen-kpis في الـ prototype.
//
// تعرض:
//   1) تبويبات شهري/سنوي
//   2) منتقي الفترة + منتقي الفرع
//   3) أداء أسبوعي (4 كروت) أو ربعي (4 كروت)
//   4) قائمة مؤشرات إضافية (مثل: نسبة الورد، التوصيل، التسويق)
//
// يحسب المؤشرات من Firestore عبر firebase.js
// ----------------------------------------------------------
import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, MapPin, Flower2, Truck, Megaphone, Wallet, Loader2 } from 'lucide-react';
import { getSales, getExpenses } from '../firebase';
import BottomSheet from './BottomSheet';
import SarSymbol from './SarSymbol';
import {
  monthRange,
  yearRange,
  getAvailableMonths,
  getAvailableYears,
  formatMonthLabel,
  splitMonthToWeeks,
  splitYearToQuarters,
} from '../utils/periodHelpers';

// كارت أسبوع/ربع (navy gradient)
function PeriodCard({ label, amount, pct }) {
  return (
    <div
      className="text-white p-3 rounded-2xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
        boxShadow: '0 6px 16px rgba(0,91,255,0.15)',
      }}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
      />
      <div className="relative flex flex-col items-center text-center gap-1.5">
        <span className="text-[11px] font-bold opacity-95">{label}</span>
        <b className="text-base font-extrabold flex items-center gap-1">
          {Math.round(amount).toLocaleString()}
          <SarSymbol className="text-[10px]" />
        </b>
        <small className="text-[10px] opacity-80">{pct}%</small>
      </div>
    </div>
  );
}

// صف KPI واحد (أيقونة + اسم + نسبة)
function KpiRow({ icon: Icon, label, pct }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center justify-between py-3 border-b border-tw-line last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-tw-soft text-tw-blue flex items-center justify-center">
          <Icon size={16} />
        </div>
        <span className="text-sm font-bold text-tw-navy">{label}</span>
      </div>
      {/* مؤشر دائري بسيط: نص داخل دائرة ملونة */}
      <div className="relative w-11 h-11 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <circle
            cx="22" cy="22" r="18"
            fill="none"
            stroke="#005BFF"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(p / 100) * 113} 113`}
          />
        </svg>
        <span className="text-[10px] font-bold text-tw-blue relative">{p}%</span>
      </div>
    </div>
  );
}

export default function ManagerKpis({ lang = 'ar' }) {
  const [period, setPeriod] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [branchFilter, setBranchFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { from, to } = period === 'month' ? monthRange(selectedMonth) : yearRange(selectedYear);
        const [s, e] = await Promise.all([getSales(from, to), getExpenses(from, to)]);
        if (!cancelled) { setSales(s); setExpenses(e); }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل البيانات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [period, selectedMonth, selectedYear]);

  const filteredSales = useMemo(
    () => branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter),
    [sales, branchFilter]
  );
  const filteredExpenses = useMemo(
    () => branchFilter === 'all' ? expenses : expenses.filter((e) => e.branchId === branchFilter),
    [expenses, branchFilter]
  );

  // حساب أداء الأسابيع/الأرباع
  const periodCards = useMemo(() => {
    const ranges = period === 'month'
      ? splitMonthToWeeks(selectedMonth)
      : splitYearToQuarters(selectedYear);
    const totalAll = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0) || 1;
    return ranges.map((r) => {
      const slice = filteredSales.filter((s) => s.date >= r.from && s.date <= r.to);
      const amount = slice.reduce((sum, s) => sum + (s.total || 0), 0);
      const pct = ((amount / totalAll) * 100).toFixed(1);
      return {
        label: lang === 'en' ? r.labelEn : r.labelAr,
        amount,
        pct,
      };
    });
  }, [period, selectedMonth, selectedYear, filteredSales, lang]);

  // مؤشرات نسبية: مصاريف الورد/التوصيل/التسويق كنسبة من المبيعات
  const kpiRows = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0) || 1;
    const sumByType = (type) =>
      filteredExpenses
        .filter((e) => e.expenseType === type || e.category === type)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
    const flowers = sumByType('flower');
    const delivery = sumByType('delivery');
    const marketing = sumByType('marketing');
    const totalExp = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    return [
      {
        icon: Flower2,
        label: lang === 'en' ? 'Flowers cost ratio' : 'نسبة تكلفة الورد',
        pct: Math.round((flowers / totalSales) * 100),
      },
      {
        icon: Truck,
        label: lang === 'en' ? 'Delivery cost ratio' : 'نسبة تكلفة التوصيل',
        pct: Math.round((delivery / totalSales) * 100),
      },
      {
        icon: Megaphone,
        label: lang === 'en' ? 'Marketing ratio' : 'نسبة التسويق',
        pct: Math.round((marketing / totalSales) * 100),
      },
      {
        icon: Wallet,
        label: lang === 'en' ? 'Total expenses ratio' : 'إجمالي المصاريف من المبيعات',
        pct: Math.round((totalExp / totalSales) * 100),
      },
    ];
  }, [filteredSales, filteredExpenses, lang]);

  const openPeriodPicker = () => {
    if (period === 'month') {
      setSheet({
        title: lang === 'en' ? 'Pick month' : 'اختر الشهر',
        options: getAvailableMonths().map((m) => ({ value: m, label: formatMonthLabel(m, lang) })),
        current: selectedMonth,
        onPick: (v) => { setSelectedMonth(v); setSheet(null); },
      });
    } else {
      setSheet({
        title: lang === 'en' ? 'Pick year' : 'اختر السنة',
        options: getAvailableYears().map((y) => ({ value: y, label: String(y) })),
        current: selectedYear,
        onPick: (v) => { setSelectedYear(v); setSheet(null); },
      });
    }
  };
  const openBranchPicker = () => setSheet({
    title: lang === 'en' ? 'Pick branch' : 'اختر الفرع',
    options: [
      { value: 'all', label: lang === 'en' ? 'All branches' : 'الكل' },
      { value: 'toia', label: lang === 'en' ? 'Toia' : 'تويا' },
      { value: 'wardana', label: lang === 'en' ? 'Wardana' : 'وردانة' },
    ],
    current: branchFilter,
    onPick: (v) => { setBranchFilter(v); setSheet(null); },
  });

  const branchLabel = {
    all: lang === 'en' ? 'All' : 'الكل',
    toia: lang === 'en' ? 'Toia' : 'تويا',
    wardana: lang === 'en' ? 'Wardana' : 'وردانة',
  }[branchFilter];

  const periodLabel = period === 'month'
    ? formatMonthLabel(selectedMonth, lang)
    : String(selectedYear);

  return (
    <div
      className="min-h-full px-4 pt-4 pb-8"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* تبويبات شهري/سنوي */}
      <div className="flex bg-tw-soft p-1 rounded-xl mb-3">
        <button
          onClick={() => setPeriod('month')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            period === 'month' ? 'bg-tw-blue text-white shadow-sm' : 'text-tw-muted'
          }`}
        >
          {lang === 'en' ? 'Monthly' : 'شهري'}
        </button>
        <button
          onClick={() => setPeriod('year')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            period === 'year' ? 'bg-tw-blue text-white shadow-sm' : 'text-tw-muted'
          }`}
        >
          {lang === 'en' ? 'Yearly' : 'سنوي'}
        </button>
      </div>

      {/* أزرار التحكم */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={openPeriodPicker}
          className="flex-1 flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-2.5 px-3 shadow-sm"
        >
          <Calendar size={14} className="text-tw-blue" />
          <span className="font-bold text-xs text-tw-navy">{periodLabel}</span>
          <ChevronDown size={12} className="text-tw-muted/70" />
        </button>
        <button
          onClick={openBranchPicker}
          className="flex-1 flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-2.5 px-3 shadow-sm"
        >
          <MapPin size={14} className="text-tw-blue" />
          <span className="font-bold text-xs text-tw-navy">
            {lang === 'en' ? `Branch: ${branchLabel}` : `الفرع: ${branchLabel}`}
          </span>
          <ChevronDown size={12} className="text-tw-muted/70" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-tw-muted/70">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}
      {error && (
        <p className="text-tw-red text-xs text-center bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>
      )}

      {!loading && !error && (
        <>
          {/* عنوان القسم */}
          <h3 className="text-center text-sm font-extrabold text-tw-navy my-3">
            {period === 'month'
              ? (lang === 'en' ? 'Weekly sales performance' : 'أداء المبيعات الأسبوعي')
              : (lang === 'en' ? 'Quarterly sales performance' : 'أداء المبيعات الربع سنوي')
            }
          </h3>

          {/* 4 كروت */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {periodCards.map((c, i) => (
              <PeriodCard key={i} label={c.label} amount={c.amount} pct={c.pct} />
            ))}
          </div>

          {/* قائمة المؤشرات */}
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm px-4 py-2">
            {kpiRows.map((row, i) => (
              <KpiRow key={i} icon={row.icon} label={row.label} pct={row.pct} />
            ))}
          </div>
        </>
      )}

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
