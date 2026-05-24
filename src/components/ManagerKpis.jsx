// src/components/ManagerKpis.jsx
// ----------------------------------------------------------
// شاشة المؤشرات (KPIs) للمدير
// Batch 13:
//   - تبويبات شهري/سنوي بنفس tw-tabs style كـ ManagerHome
//   - period-picker بنفس tw-period-picker style
//   - النسب الجديدة:
//       • نسبة الكاش من المبيعات
//       • نسبة مدى من المبيعات
//       • نسبة التحويل (أون لاين) من المبيعات
//       • نسبة الأون من المتجر (التحويل / كاش+مدى)
//   - حذف: نسبة التسويق، نسبة المصاريف من المبيعات
// ----------------------------------------------------------
import { useState, useMemo } from 'react';
import { ChevronDown, MapPin, Wallet, CreditCard, Send, Globe, Flower2, Truck, Loader2 } from 'lucide-react';
import { getSales, getExpenses, getFixedExpensesRange, dateRangeToMonthRange, salesNet } from '../firebase';
import BottomSheet from './BottomSheet';
import SarSymbol from './SarSymbol';
import { usePersistedState } from '../hooks/usePersistedState';
import { useCachedQuery } from '../hooks/useCachedQuery';
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
        <b className="text-2xl font-extrabold flex items-center gap-1 leading-tight">
          {Math.round(amount).toLocaleString()}
          <SarSymbol className="text-xs" />
        </b>
        <small className="text-[10px] opacity-80">{pct}%</small>
      </div>
    </div>
  );
}

// صف KPI واحد (أيقونة + اسم + نسبة)
function KpiRow({ icon: Icon, label, pct }) {
  const p = Math.max(0, Math.min(100, Math.round(pct) || 0));
  return (
    <div className="flex items-center justify-between py-3 border-b border-tw-line last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-tw-soft text-tw-blue flex items-center justify-center">
          <Icon size={16} />
        </div>
        <span className="text-sm font-bold text-tw-navy">{label}</span>
      </div>
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
        <span className="text-[10px] font-bold text-black relative">{p}%</span>
      </div>
    </div>
  );
}

export default function ManagerKpis({ lang = 'ar' }) {
  // Batch 45: حفظ الاختيارات
  const [period, setPeriod] = usePersistedState('kpis.period', 'month');
  const [selectedMonth, setSelectedMonth] = usePersistedState('kpis.month', () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = usePersistedState('kpis.year', new Date().getFullYear());
  const [branchFilter, setBranchFilter] = usePersistedState('kpis.branch', 'all');
  const [sheet, setSheet] = useState(null);

  // Batch 45: حساب النطاق
  const { from, to } = useMemo(() => {
    if (period === 'month') {
      if (selectedMonth === 'all') {
        return { from: '2024-01-01', to: `${new Date().getFullYear()}-12-31` };
      }
      return monthRange(selectedMonth);
    }
    return yearRange(selectedYear);
  }, [period, selectedMonth, selectedYear]);

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentY = now.getFullYear();
    if (period === 'month') return selectedMonth === currentYM || selectedMonth === 'all';
    return selectedYear === currentY;
  }, [period, selectedMonth, selectedYear]);

  const ttl = isCurrentPeriod ? 30 * 1000 : 30 * 60 * 1000;

  const { data: sales = [], loading: salesLoading, error: salesError } = useCachedQuery(
    ['sales', from, to],
    () => getSales(from, to),
    { ttl, defaultData: [] }
  );
  const { data: expenses = [], loading: expLoading, error: expError } = useCachedQuery(
    ['expenses', from, to],
    () => getExpenses(from, to),
    { ttl, defaultData: [] }
  );
  const { fromMonth, toMonth } = useMemo(() => dateRangeToMonthRange(from, to), [from, to]);
  const { data: fixedExpenses = [], loading: fixedLoading } = useCachedQuery(
    ['fixedExpenses', fromMonth, toMonth],
    () => getFixedExpensesRange(fromMonth, toMonth),
    { ttl: 5 * 60 * 1000, defaultData: [] }
  );

  const loading = salesLoading || expLoading || fixedLoading;
  const error = salesError || expError;

  const filteredSales = useMemo(
    () => branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter),
    [sales, branchFilter]
  );
  const filteredExpenses = useMemo(
    () => branchFilter === 'all' ? expenses : expenses.filter((e) => e.branchId === branchFilter),
    [expenses, branchFilter]
  );
  // Batch 43: المصاريف الثابتة محمَّلة (للاتساق) لكن KPIs الحالية نسب من المبيعات فقط
  // (إذا أضفنا KPI ربح لاحقاً، الـ filteredFixed جاهز)
  // eslint-disable-next-line no-unused-vars
  const filteredFixed = useMemo(
    () => branchFilter === 'all' ? fixedExpenses : fixedExpenses.filter((f) => f.branchId === branchFilter),
    [fixedExpenses, branchFilter]
  );

  // أداء الأسابيع/الأرباع
  const periodCards = useMemo(() => {
    // Batch 36: لو "كل الأشهر" نعرضها كقسم واحد (لا يوجد أسابيع منطقية)
    if (period === 'month' && selectedMonth === 'all') {
      const totalAll = filteredSales.reduce((sum, s) => sum + salesNet(s), 0) || 1;
      return [{
        label: lang === 'en' ? 'All months' : 'كل الأشهر',
        amount: totalAll,
        pct: '100.0',
      }];
    }
    const ranges = period === 'month'
      ? splitMonthToWeeks(selectedMonth)
      : splitYearToQuarters(selectedYear);
    const totalAll = filteredSales.reduce((sum, s) => sum + salesNet(s), 0) || 1;
    return ranges.map((r) => {
      const slice = filteredSales.filter((s) => s.date >= r.from && s.date <= r.to);
      const amount = slice.reduce((sum, s) => sum + salesNet(s), 0);
      const pct = ((amount / totalAll) * 100).toFixed(1);
      return {
        label: lang === 'en' ? r.labelEn : r.labelAr,
        amount,
        pct,
      };
    });
  }, [period, selectedMonth, selectedYear, filteredSales, lang]);

  // النسب (Batch 13 + Batch 15)
  const kpiRows = useMemo(() => {
    // Batch 29: نستخدم madaNet (بعد رسوم مدى) ليطابق netTotal — مبالغ الحساب البنكي الفعلية
    const totalCash = filteredSales.reduce((s, x) => s + (Number(x.cash) || 0), 0);
    const totalMadaNet = filteredSales.reduce((s, x) => {
      // لو madaNet مخزّن في السجل نستخدمه، وإلا نحسبه
      if (typeof x.madaNet === 'number') return s + x.madaNet;
      const m = Number(x.mada) || 0;
      return s + +(m * (1 - 0.0092)).toFixed(2);
    }, 0);
    const totalTransfer = filteredSales.reduce((s, x) => s + (Number(x.transfer) || 0), 0);
    const totalSales = totalCash + totalMadaNet + totalTransfer || 1;
    const storeOnly = totalCash + totalMadaNet || 1; // كاش + مدى صافي = المتجر

    // مصاريف الورد والتوصيل من filteredExpenses
    const sumByType = (type) =>
      filteredExpenses
        .filter((e) => e.expenseType === type || e.category === type)
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const flowers = sumByType('flower');
    const delivery = sumByType('delivery');

    return [
      {
        icon: Flower2,
        label: lang === 'en' ? 'Flowers cost ratio of sales' : 'نسبة تكلفة الورد من المبيعات',
        pct: (flowers / totalSales) * 100,
      },
      {
        icon: Truck,
        label: lang === 'en' ? 'Delivery cost ratio of sales' : 'نسبة تكلفة التوصيل من المبيعات',
        pct: (delivery / totalSales) * 100,
      },
      {
        icon: Wallet,
        label: lang === 'en' ? 'Cash ratio of sales' : 'نسبة الكاش من المبيعات',
        pct: (totalCash / totalSales) * 100,
      },
      {
        icon: CreditCard,
        label: lang === 'en' ? 'Mada ratio of sales' : 'نسبة مدى من المبيعات',
        pct: (totalMadaNet / totalSales) * 100,
      },
      {
        icon: Send,
        label: lang === 'en' ? 'Transfer ratio of sales' : 'نسبة التحويل من المبيعات',
        pct: (totalTransfer / totalSales) * 100,
      },
      {
        icon: Globe,
        label: lang === 'en' ? 'Online ratio of store sales' : 'نسبة الأون لاين من المتجر',
        pct: (totalTransfer / storeOnly) * 100,
      },
    ];
  }, [filteredSales, filteredExpenses, lang]);

  const openPeriodPicker = () => {
    if (period === 'month') {
      setSheet({
        title: lang === 'en' ? 'Pick month' : 'اختر الشهر',
        options: [
          { value: 'all', label: lang === 'en' ? 'All months' : 'كل الأشهر' },
          ...getAvailableMonths().map((m) => ({ value: m, label: formatMonthLabel(m, lang) })),
        ],
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
    ? (selectedMonth === 'all'
        ? (lang === 'en' ? 'All months' : 'كل الأشهر')
        : formatMonthLabel(selectedMonth, lang))
    : String(selectedYear);

  return (
    <div
      className="relative min-h-full px-4 pt-4 pb-8 overflow-hidden page-bg-soft"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* تبويبات شهري/سنوي — نفس style كـ ManagerHome */}
      <div className="tw-tabs relative z-10">
        <span
          onClick={() => setPeriod('month')}
          className={period === 'month' ? 'active' : ''}
        >
          {lang === 'en' ? 'Monthly' : 'شهري'}
        </span>
        <span
          onClick={() => setPeriod('year')}
          className={period === 'year' ? 'active' : ''}
        >
          {lang === 'en' ? 'Yearly' : 'سنوي'}
        </span>
      </div>

      {/* منتقي الفترة + منتقي الفرع */}
      <div className="flex gap-2 relative z-10 mb-3">
        <div onClick={openPeriodPicker} className="tw-period-picker" style={{ flex: 1, margin: 0 }}>
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="font-num">{periodLabel}</span>
          <ChevronDown size={14} className="text-tw-muted" />
        </div>
        <div onClick={openBranchPicker} className="tw-period-picker" style={{ flex: 1, margin: 0 }}>
          <MapPin size={14} className="text-tw-blue" />
          <span>{lang === 'en' ? `Branch: ${branchLabel}` : `الفرع: ${branchLabel}`}</span>
          <ChevronDown size={14} className="text-tw-muted" />
        </div>
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

          {/* قائمة المؤشرات الجديدة */}
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
