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
import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, MapPin, Wallet, CreditCard, Send, Globe, Loader2 } from 'lucide-react';
import { getSales } from '../firebase';
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
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { from, to } = period === 'month' ? monthRange(selectedMonth) : yearRange(selectedYear);
        const s = await getSales(from, to);
        if (!cancelled) setSales(s);
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

  // أداء الأسابيع/الأرباع
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

  // النسب الجديدة (Batch 13.10)
  const kpiRows = useMemo(() => {
    const totalCash = filteredSales.reduce((s, x) => s + (Number(x.cash) || 0), 0);
    const totalMada = filteredSales.reduce((s, x) => s + (Number(x.mada) || 0), 0);
    const totalTransfer = filteredSales.reduce((s, x) => s + (Number(x.transfer) || 0), 0);
    const totalSales = totalCash + totalMada + totalTransfer || 1;
    const storeOnly = totalCash + totalMada || 1; // كاش + مدى = المتجر

    return [
      {
        icon: Wallet,
        label: lang === 'en' ? 'Cash ratio of sales' : 'نسبة الكاش من المبيعات',
        pct: (totalCash / totalSales) * 100,
      },
      {
        icon: CreditCard,
        label: lang === 'en' ? 'Mada ratio of sales' : 'نسبة مدى من المبيعات',
        pct: (totalMada / totalSales) * 100,
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
  }, [filteredSales, lang]);

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
