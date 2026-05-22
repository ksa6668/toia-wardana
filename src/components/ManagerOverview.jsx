// src/components/ManagerOverview.jsx
// ----------------------------------------------------------
// شاشة النظرة العامة للمدير
// مطابقة لتصميم section#screen-overview في الـ prototype.
//
// تعرض:
//   1) منتقي السنة + منتقي الفرع
//   2) كارت hero كبير (صافي الربح + شريط تقدم)
//   3) شبكة 2×2 من المقاييس (مبيعات/مصاريف/متوسط مبيعات/متوسط مصاريف)
//
// يستخدم Firestore عبر firebase.js (getSales, getExpenses)
// ----------------------------------------------------------
import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, MapPin, TrendingUp, Receipt, BarChart3, Wallet, Loader2 } from 'lucide-react';
import { getSales, getExpenses } from '../firebase';
import BottomSheet from './BottomSheet';
import SarSymbol from './SarSymbol';
import { yearRange, getAvailableYears } from '../utils/periodHelpers';

// كارت متري واحد في الشبكة السفلية
function MetricCard({ icon: Icon, label, value, alt }) {
  return (
    <div className="bg-white p-3 rounded-2xl border border-tw-line shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
        alt ? 'bg-red-50 text-tw-red' : 'bg-tw-soft text-tw-blue'
      }`}>
        <Icon size={18} />
      </div>
      <p className="text-[10px] text-tw-muted mb-1 font-bold">{label}</p>
      <p className="text-sm font-bold text-tw-navy flex items-center gap-1">
        {value.toLocaleString()} <SarSymbol className="text-xs text-tw-muted" />
      </p>
    </div>
  );
}

export default function ManagerOverview({ lang = 'ar' }) {
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
        const { from, to } = yearRange(selectedYear);
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
  }, [selectedYear]);

  const filteredSales = useMemo(
    () => branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter),
    [sales, branchFilter]
  );
  const filteredExpenses = useMemo(
    () => branchFilter === 'all' ? expenses : expenses.filter((e) => e.branchId === branchFilter),
    [expenses, branchFilter]
  );

  const stats = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalExp = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    // عدد الأيام الفريدة التي فيها مبيعات (للمتوسطات)
    const daysWithSales = new Set(filteredSales.map((s) => s.date)).size || 1;
    const daysWithExp = new Set(filteredExpenses.map((e) => e.date)).size || 1;
    return {
      totalSales,
      totalExp,
      profit: totalSales - totalExp,
      avgSales: Math.round(totalSales / daysWithSales),
      avgExp: Math.round(totalExp / daysWithExp),
      profitPct: totalSales > 0 ? Math.round((Math.max(0, totalSales - totalExp) / totalSales) * 100) : 0,
    };
  }, [filteredSales, filteredExpenses]);

  const openYearPicker = () => setSheet({
    title: lang === 'en' ? 'Pick year' : 'اختر السنة',
    options: getAvailableYears().map((y) => ({ value: y, label: String(y) })),
    current: selectedYear,
    onPick: (v) => { setSelectedYear(v); setSheet(null); },
  });
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

  return (
    <div
      className="min-h-full px-4 pt-4 pb-8"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* أزرار التحكم */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={openYearPicker}
          className="flex-1 flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-2.5 px-3 shadow-sm"
        >
          <Calendar size={14} className="text-tw-blue" />
          <span className="font-bold text-xs text-tw-navy">{selectedYear}</span>
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
          {/* كارت hero بصافي الربح */}
          <div
            className="text-white p-5 rounded-2xl overflow-hidden relative mb-4"
            style={{
              background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
              boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
            }}
          >
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
            />
            <div className="relative">
              <p className="text-xs font-bold opacity-95 text-right mb-2">
                {lang === 'en' ? 'Net Profit' : 'صافي الربح'}
              </p>
              <div className="flex items-center justify-end gap-2 mb-2">
                <span className="text-3xl font-extrabold leading-none">
                  {Math.round(stats.profit).toLocaleString()}
                </span>
                <SarSymbol className="text-xl" />
              </div>
              <p className="text-[11px] opacity-80 text-right mb-3">
                {lang === 'en' ? 'Sales − Expenses' : 'المبيعات − المصاريف'}
              </p>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${stats.profitPct}%` }} />
              </div>
            </div>
          </div>

          {/* شبكة المقاييس */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={TrendingUp}
              label={lang === 'en' ? 'Total Sales' : 'إجمالي المبيعات'}
              value={Math.round(stats.totalSales)}
            />
            <MetricCard
              icon={Receipt}
              label={lang === 'en' ? 'Total Expenses' : 'إجمالي المصاريف'}
              value={Math.round(stats.totalExp)}
              alt
            />
            <MetricCard
              icon={BarChart3}
              label={lang === 'en' ? 'Avg Sales/day' : 'متوسط المبيعات'}
              value={stats.avgSales}
            />
            <MetricCard
              icon={Wallet}
              label={lang === 'en' ? 'Avg Expenses/day' : 'متوسط المصاريف'}
              value={stats.avgExp}
              alt
            />
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
