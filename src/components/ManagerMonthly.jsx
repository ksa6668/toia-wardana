// src/components/ManagerMonthly.jsx
// ----------------------------------------------------------
// شاشة المؤشرات الشهرية للمدير
// مطابقة لتصميم section#screen-monthly في الـ prototype.
//
// تعرض:
//   1) منتقي الشهر + منتقي الفرع
//   2) ملخص 3 كروت (مبيعات/مصاريف/ربح)
//   3) 3 تبويبات (مبيعات/مصاريف/ربح) — كل واحد جدول يومي
//
// تستهلك Firestore عبر firebase.js الموجود فعلاً (getSales, getExpenses)
// ----------------------------------------------------------
import { useState, useMemo, useEffect } from 'react';
import { Calendar, ChevronDown, MapPin, Loader2, Filter } from 'lucide-react';
import { getSales, getExpenses, getFixedExpensesRange, dateRangeToMonthRange, salesNet, getBranches } from '../firebase';
import BottomSheet from './BottomSheet';
import DayRecordsSheet from './DayRecordsSheet';
import MonthlyBreakdownSheet from './MonthlyBreakdownSheet';
import SarSymbol from './SarSymbol';
import { usePersistedState } from '../hooks/usePersistedState';
import { useCachedQuery } from '../hooks/useCachedQuery';
import {
  monthRange,
  yearRange,
  getAvailableMonths,
  getAvailableYears,
  formatMonthLabel,
  formatDayShort,
} from '../utils/periodHelpers';

export default function ManagerMonthly({ lang = 'ar', onEditRecord }) {
  // Batch 45: حفظ اختيارات المستخدم عبر التنقل (sessionStorage)
  const [period, setPeriod] = usePersistedState('monthly.period', 'month');
  const [selectedMonth, setSelectedMonth] = usePersistedState('monthly.month', () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = usePersistedState('monthly.year', new Date().getFullYear());
  const [branchFilter, setBranchFilter] = usePersistedState('monthly.branch', 'all');
  const [activeTab, setActiveTab] = usePersistedState('monthly.tab', 'sales');
  const [categoryFilter, setCategoryFilter] = usePersistedState('monthly.category', 'all');
  // Batch 57: مستوى تجميع الصفوف لـ "كل الأشهر" → 'day' | 'month'
  const [allMonthsGroup, setAllMonthsGroup] = usePersistedState('monthly.allMonthsGroup', 'month');
  // Batch 50: فرز - sortBy = null | 'salesTotal' | 'profit', sortDir = 'asc' | 'desc'
  const [sortBy, setSortBy] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  // Batch 51: تاريخ السجلات المعروضة في Bottom Sheet
  const [dayDetailDate, setDayDetailDate] = useState(null);
  // Batch 53: نوع المؤشر المعروض في BreakdownSheet (null = مغلق)
  const [breakdownMetric, setBreakdownMetric] = useState(null);
  // Batch 51: قائمة الفروع (لإظهار الأسماء في DayRecordsSheet)
  const [branchesList, setBranchesList] = useState([
    { id: 'toia', name: 'تويا' },
    { id: 'wardana', name: 'وردانة' },
  ]);
  useEffect(() => {
    let cancelled = false;
    getBranches().then((bs) => {
      if (!cancelled && bs?.length) setBranchesList(bs);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  // قائمة منبثقة (لا تُحفظ - حالة UI مؤقتة)
  const [sheet, setSheet] = useState(null);

  // Batch 45: حساب النطاق
  const { from, to } = useMemo(() => {
    if (period === 'month') {
      if (selectedMonth === 'all') {
        return { from: '2024-01-01', to: `${new Date().getFullYear()}-12-31` };
      }
      return monthRange(selectedMonth);
    } else {
      if (selectedYear === 'all') {
        return { from: '2024-01-01', to: `${new Date().getFullYear()}-12-31` };
      }
      return yearRange(selectedYear);
    }
  }, [period, selectedMonth, selectedYear]);

  // Batch 45: TTL ديناميكي - الفترة الحالية cache قصير، التاريخية cache طويل
  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentY = now.getFullYear();
    if (period === 'month') return selectedMonth === currentYM || selectedMonth === 'all';
    return selectedYear === currentY || selectedYear === 'all';
  }, [period, selectedMonth, selectedYear]);

  const ttl = isCurrentPeriod ? 30 * 1000 : 30 * 60 * 1000; // 30s للحالي، 30min للتاريخي

  // Batch 45: استعلامات مع cache
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
    { ttl: 5 * 60 * 1000, defaultData: [] } // 5 دقائق (تتغير نادراً)
  );

  const loading = salesLoading || expLoading || fixedLoading;
  const error = salesError || expError;

  // فلترة البيانات حسب الفرع
  const filteredSales = useMemo(() => {
    return branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter);
  }, [sales, branchFilter]);

  const filteredExpenses = useMemo(() => {
    let result = branchFilter === 'all' ? expenses : expenses.filter((e) => e.branchId === branchFilter);
    // Batch 36: تطبيق فلتر التصنيف
    if (categoryFilter !== 'all') {
      result = result.filter((e) => e.categoryId === categoryFilter);
    }
    return result;
  }, [expenses, branchFilter, categoryFilter]);

  // Batch 36: قائمة التصنيفات المتاحة من بيانات المصاريف
  const availableCategories = useMemo(() => {
    const map = new Map();
    // نستخدم expenses (قبل فلتر التصنيف) لكن بعد فلتر الفرع
    const branchFiltered = branchFilter === 'all' ? expenses : expenses.filter((e) => e.branchId === branchFilter);
    branchFiltered.forEach((e) => {
      if (e.categoryId && !map.has(e.categoryId)) {
        map.set(e.categoryId, e.categoryName || e.categoryId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [expenses, branchFilter]);

  // Batch 43: المصاريف الثابتة المفلترة بالفرع
  const filteredFixed = useMemo(() => {
    return branchFilter === 'all' ? fixedExpenses : fixedExpenses.filter((f) => f.branchId === branchFilter);
  }, [fixedExpenses, branchFilter]);

  // Batch 57: مستوى التجميع الفعلي حسب الفترة المختارة
  //   شهر محدّد → يومي | كل الأشهر → (يومي/شهري) | سنة محددة → شهري | كل السنوات → (شهري/سنوي)
  const groupBy = useMemo(() => {
    if (period === 'month') return selectedMonth === 'all' ? allMonthsGroup : 'day';
    return selectedYear === 'all' ? 'year' : 'month';
  }, [period, selectedMonth, selectedYear, allMonthsGroup]);

  // مفتاح التجميع لتاريخ ISO حسب المستوى
  const periodKey = (date, mode) => {
    if (mode === 'year') return date.slice(0, 4);   // YYYY
    if (mode === 'month') return date.slice(0, 7);  // YYYY-MM
    return date;                                    // YYYY-MM-DD
  };

  // Batch 57: مجموع المصاريف الثابتة لكل شهر (مفلتر بالفرع)
  const fixedByMonth = useMemo(() => {
    const map = {};
    filteredFixed.forEach((f) => {
      if (!f.month) return;
      map[f.month] = (map[f.month] || 0) + (f.amount || 0);
    });
    return map;
  }, [filteredFixed]);

  // نصيب اليوم الواحد من المصاريف الثابتة لشهره (ثابت الشهر ÷ أيام الشهر)
  const dailyFixedShare = (dateStr) => {
    const mk = dateStr.slice(0, 7);
    const mf = fixedByMonth[mk] || 0;
    if (mf <= 0) return 0;
    const [y, m] = mk.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    return mf / daysInMonth;
  };

  // Batch 36+43+44: الإجماليات + المتوسطات
  // Batch 57: المصاريف الثابتة تُوزّع نسبة وتناسب على الأيام المسجّلة
  //           (نفس منطق الجدول اليومي) → الكرت = مجموع الجدول، ويختفي تضخّم الشهر الجاري.
  const totals = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + salesNet(s), 0);
    const totalVarExp = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    // الأيام المسجّلة = أي يوم فيه مبيعات أو مصروف متغيّر
    const loggedDays = new Set([
      ...filteredSales.map((s) => s.date),
      ...filteredExpenses.map((e) => e.date),
    ].filter(Boolean));
    let proratedFixed = 0;
    loggedDays.forEach((d) => { proratedFixed += dailyFixedShare(d); });
    const totalExp = totalVarExp + proratedFixed;
    const profit = totalSales - totalExp;
    // Batch 51: تفصيل طرق الدفع
    const totalCash = filteredSales.reduce((s, x) => s + (Number(x.cash) || 0), 0);
    const totalMadaNet = filteredSales.reduce((s, x) => {
      if (typeof x.madaNet === 'number') return s + x.madaNet;
      const m = Number(x.mada) || 0;
      return s + +(m * (1 - 0.0092)).toFixed(2);
    }, 0);
    const totalTransfer = filteredSales.reduce((s, x) => s + (Number(x.transfer) || 0), 0);
    const salesBase = totalSales || 1;
    // عدد الأيام الفريدة لحساب المتوسطات
    const daysWithSales = new Set(filteredSales.map((s) => s.date)).size || 1;
    const daysWithAny = loggedDays.size || 1;
    return {
      sales: totalSales,
      expenses: totalExp,
      profit,
      avgSales: Math.round(totalSales / daysWithSales),
      avgExp: Math.round(totalExp / daysWithAny),
      avgProfit: Math.round(profit / daysWithAny),
      cash: Math.round(totalCash),
      cashPct: Math.round((totalCash / salesBase) * 100),
      mada: Math.round(totalMadaNet),
      madaPct: Math.round((totalMadaNet / salesBase) * 100),
      transfer: Math.round(totalTransfer),
      transferPct: Math.round((totalTransfer / salesBase) * 100),
    };
  }, [filteredSales, filteredExpenses, fixedByMonth]);

  // Batch 57: تجميع المبيعات حسب المستوى (يومي/شهري/سنوي) — total = salesNet
  const salesByGroup = useMemo(() => {
    const map = {};
    filteredSales.forEach((s) => {
      if (!s.date) return;
      const k = periodKey(s.date, groupBy);
      if (!map[k]) map[k] = { cash: 0, mada: 0, transfer: 0, total: 0 };
      map[k].cash += s.cash || 0;
      map[k].mada += s.mada || 0;
      map[k].transfer += s.transfer || 0;
      map[k].total += salesNet(s);
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, vals]) => ({ key, ...vals }));
  }, [filteredSales, groupBy]);

  // Batch 57: الربح حسب المستوى — يوزّع الثابت نسبة وتناسب على الأيام ثم يجمّع
  const profitByGroup = useMemo(() => {
    const days = {};
    filteredSales.forEach((s) => {
      if (!s.date) return;
      if (!days[s.date]) days[s.date] = { sales: 0, expenses: 0 };
      days[s.date].sales += salesNet(s);
    });
    filteredExpenses.forEach((e) => {
      if (!e.date) return;
      if (!days[e.date]) days[e.date] = { sales: 0, expenses: 0 };
      days[e.date].expenses += e.amount || 0;
    });
    // توزيع المصاريف الثابتة نسبياً على كل يوم مسجّل
    Object.keys(days).forEach((d) => { days[d].expenses += dailyFixedShare(d); });
    // التجميع حسب المستوى
    const g = {};
    Object.entries(days).forEach(([d, v]) => {
      const k = periodKey(d, groupBy);
      if (!g[k]) g[k] = { sales: 0, expenses: 0 };
      g[k].sales += v.sales;
      g[k].expenses += v.expenses;
    });
    return Object.entries(g)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, v]) => ({
        key,
        sales: v.sales,
        expenses: Math.round(v.expenses),
        profit: Math.round(v.sales - v.expenses),
      }));
  }, [filteredSales, filteredExpenses, fixedByMonth, groupBy]);

  // المصاريف:
  //   • يومي → سجلات فردية (يوم/تصنيف/مبلغ) كما هي
  //   • شهري/سنوي → مجموع المصاريف لكل فترة (متغيّر + نصيب الثابت) من profitByGroup
  const expenseLineItems = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [filteredExpenses]);

  // Batch 50: نسخ مفروزة - sortBy='salesTotal' للمبيعات | sortBy='profit' للربح
  const sortedSalesByGroup = useMemo(() => {
    if (sortBy !== 'salesTotal') return salesByGroup;
    const arr = [...salesByGroup];
    arr.sort((a, b) => sortDir === 'asc' ? a.total - b.total : b.total - a.total);
    return arr;
  }, [salesByGroup, sortBy, sortDir]);

  const sortedProfitByGroup = useMemo(() => {
    if (sortBy !== 'profit') return profitByGroup;
    const arr = [...profitByGroup];
    arr.sort((a, b) => sortDir === 'asc' ? a.profit - b.profit : b.profit - a.profit);
    return arr;
  }, [profitByGroup, sortBy, sortDir]);

  // helper: تبديل الفرز عند الضغط على رأس العمود
  const toggleSort = (col) => {
    if (sortBy === col) {
      // ضغطة ثانية على نفس العمود → عكس الاتجاه
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc'); // ابدأ تنازلي (الأعلى → الأقل)
    }
  };
  // إعادة فرز افتراضي عند تبديل التبويب
  useEffect(() => {
    setSortBy(null);
    setSortDir('desc');
  }, [activeTab]);

  // فتح منتقي الفترة (شهر أو سنة بناءً على period الحالي)
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
        options: [
          { value: 'all', label: lang === 'en' ? 'All years' : 'كل السنوات' },
          ...getAvailableYears().map((y) => ({ value: y, label: String(y) })),
        ],
        current: selectedYear,
        onPick: (v) => { setSelectedYear(v); setSheet(null); },
      });
    }
  };
  const openBranchPicker = () => {
    setSheet({
      title: lang === 'en' ? 'Pick branch' : 'اختر الفرع',
      options: [
        { value: 'all', label: lang === 'en' ? 'All branches' : 'الكل' },
        { value: 'toia', label: lang === 'en' ? 'Toia' : 'تويا' },
        { value: 'wardana', label: lang === 'en' ? 'Wardana' : 'وردانة' },
      ],
      current: branchFilter,
      onPick: (v) => { setBranchFilter(v); setSheet(null); },
    });
  };

  const branchLabel = {
    all: lang === 'en' ? 'All' : 'الكل',
    toia: lang === 'en' ? 'Toia' : 'تويا',
    wardana: lang === 'en' ? 'Wardana' : 'وردانة',
  }[branchFilter];

  // Batch 57: تسمية صف الفترة حسب المستوى
  const showYearInDay = (period === 'month' && selectedMonth === 'all');
  const formatPeriodLabel = (key) => {
    if (groupBy === 'year') return key;                       // 2026
    if (groupBy === 'month') return formatMonthLabel(key, lang); // يونيو 2026
    return formatDayShort(key, lang, showYearInDay);          // 5 يونيو
  };
  const periodColLabel =
    groupBy === 'year' ? (lang === 'en' ? 'Year' : 'السنة')
    : groupBy === 'month' ? (lang === 'en' ? 'Month' : 'الشهر')
    : (lang === 'en' ? 'Day' : 'اليوم');

  // Batch 57: زر مستوى التجميع (يظهر فقط في "كل الأشهر" → يومي/شهري)
  const groupToggle = (() => {
    if (period === 'month' && selectedMonth === 'all') {
      return {
        value: allMonthsGroup,
        set: setAllMonthsGroup,
        options: [
          { value: 'day', label: lang === 'en' ? 'Daily' : 'يومي' },
          { value: 'month', label: lang === 'en' ? 'Monthly' : 'شهري' },
        ],
      };
    }
    return null;
  })();

  return (
    <div
      className="relative min-h-full px-4 pt-4 pb-8 overflow-hidden page-bg-soft"
      style={{
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Batch 44: تبويبات شهري/سنوي — مطابقة لتصميم ManagerHome */}
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

      {/* أزرار التحكم: الفترة (شهر/سنة) + الفرع */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={openPeriodPicker}
          className="flex-1 flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-2.5 px-3 shadow-sm"
        >
          <Calendar size={14} className="text-tw-blue" />
          <span className="font-bold text-xs text-tw-navy">
            {period === 'month'
              ? (selectedMonth === 'all'
                  ? (lang === 'en' ? 'All months' : 'كل الأشهر')
                  : formatMonthLabel(selectedMonth, lang))
              : (selectedYear === 'all'
                  ? (lang === 'en' ? 'All years' : 'كل السنوات')
                  : String(selectedYear))}
          </span>
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

      {/* Batch 44: 6 كروت (3 إجماليات + 3 متوسطات) - Batch 53: قابلة للضغط لعرض التفصيل الشهري */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <button
          onClick={() => setBreakdownMetric('sales')}
          className="bg-white p-3 rounded-xl border border-tw-line text-center active:scale-95 transition-transform"
          type="button"
        >
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Sales' : 'إجمالي المبيعات'}</p>
          <p className="text-sm font-bold text-tw-blue flex items-center justify-center gap-1">
            {Math.round(totals.sales).toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </button>
        <button
          onClick={() => setBreakdownMetric('expenses')}
          className="bg-white p-3 rounded-xl border border-tw-line text-center active:scale-95 transition-transform"
          type="button"
        >
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Expenses' : 'إجمالي المصاريف'}</p>
          <p className="text-sm font-bold text-tw-red flex items-center justify-center gap-1">
            {Math.round(totals.expenses).toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </button>
        <button
          onClick={() => setBreakdownMetric('profit')}
          className="bg-white p-3 rounded-xl border border-tw-line text-center active:scale-95 transition-transform"
          type="button"
        >
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Net Profit' : 'صافي الربح'}</p>
          <p className="text-sm font-bold text-tw-green flex items-center justify-center gap-1">
            {Math.round(totals.profit).toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => setBreakdownMetric('avgSales')}
          className="bg-white p-3 rounded-xl border border-tw-line text-center active:scale-95 transition-transform"
          type="button"
        >
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Avg sales' : 'متوسط المبيعات'}</p>
          <p className="text-sm font-bold text-tw-blue/80 flex items-center justify-center gap-1">
            {totals.avgSales.toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </button>
        <button
          onClick={() => setBreakdownMetric('avgExpenses')}
          className="bg-white p-3 rounded-xl border border-tw-line text-center active:scale-95 transition-transform"
          type="button"
        >
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Avg expenses' : 'متوسط المصاريف'}</p>
          <p className="text-sm font-bold text-tw-red/80 flex items-center justify-center gap-1">
            {totals.avgExp.toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </button>
        <button
          onClick={() => setBreakdownMetric('avgProfit')}
          className="bg-white p-3 rounded-xl border border-tw-line text-center active:scale-95 transition-transform"
          type="button"
        >
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Avg net profit' : 'متوسط صافي الربح'}</p>
          <p className="text-sm font-bold text-tw-green/80 flex items-center justify-center gap-1">
            {totals.avgProfit.toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </button>
      </div>

      {/* Batch 51: كروت طرق الدفع - الكاش + مدى + التحويل (مبلغ ونسبة) - Batch 53: قابلة للضغط */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <button
          onClick={() => setBreakdownMetric('cash')}
          className="bg-white p-3 rounded-xl border border-tw-line text-center active:scale-95 transition-transform"
          type="button"
        >
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Cash' : 'الكاش'}</p>
          <p className="text-sm font-bold text-tw-navy flex items-center justify-center gap-1">
            {totals.cash.toLocaleString()} <SarSymbol className="text-xs" />
          </p>
          <p className="text-[10px] text-tw-blue font-bold mt-0.5">{totals.cashPct}%</p>
        </button>
        <button
          onClick={() => setBreakdownMetric('mada')}
          className="bg-white p-3 rounded-xl border border-tw-line text-center active:scale-95 transition-transform"
          type="button"
        >
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Mada' : 'مدى'}</p>
          <p className="text-sm font-bold text-tw-navy flex items-center justify-center gap-1">
            {totals.mada.toLocaleString()} <SarSymbol className="text-xs" />
          </p>
          <p className="text-[10px] text-tw-blue font-bold mt-0.5">{totals.madaPct}%</p>
        </button>
        <button
          onClick={() => setBreakdownMetric('transfer')}
          className="bg-white p-3 rounded-xl border border-tw-line text-center active:scale-95 transition-transform"
          type="button"
        >
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Transfer' : 'تحويل'}</p>
          <p className="text-sm font-bold text-tw-navy flex items-center justify-center gap-1">
            {totals.transfer.toLocaleString()} <SarSymbol className="text-xs" />
          </p>
          <p className="text-[10px] text-tw-blue font-bold mt-0.5">{totals.transferPct}%</p>
        </button>
      </div>

      {/* Batch 57: زر مستوى التجميع — يظهر فقط في "كل الأشهر" (يومي/شهري) */}
      {groupToggle && (
        <div className="flex bg-tw-soft p-1 rounded-xl mb-3">
          {groupToggle.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => groupToggle.set(opt.value)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                groupToggle.value === opt.value ? 'bg-tw-blue text-white shadow-sm' : 'text-tw-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* تبويبات */}
      <div className="flex bg-tw-soft p-1 rounded-xl mb-4">
        {[
          { key: 'sales', label: lang === 'en' ? 'Sales' : 'المبيعات' },
          { key: 'expenses', label: lang === 'en' ? 'Expenses' : 'المصاريف' },
          { key: 'profit', label: lang === 'en' ? 'Profit' : 'الربح' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key ? 'bg-tw-blue text-white shadow-sm' : 'text-tw-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* المحتوى */}
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

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-tw-line overflow-hidden">
          {/* تبويب المبيعات */}
          {activeTab === 'sales' && (
            <table className="w-full text-xs">
              <thead className="bg-tw-soft/40">
                <tr>
                  <th className="p-2 text-right font-bold text-tw-muted">{periodColLabel}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Cash' : 'كاش'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Mada' : 'مدى'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Transfer' : 'تحويل'}</th>
                  <th
                    onClick={() => toggleSort('salesTotal')}
                    className="p-2 text-center font-bold text-tw-muted cursor-pointer select-none hover:text-tw-blue active:bg-tw-soft/50"
                  >
                    <span className="inline-flex items-center gap-1">
                      {lang === 'en' ? 'Total' : 'إجمالي'}
                      <span className="text-[10px] opacity-70">
                        {sortBy === 'salesTotal' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSalesByGroup.length === 0 ? (
                  <tr><td colSpan={5} className="text-center p-6 text-tw-muted/70">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                ) : sortedSalesByGroup.map((row) => (
                  <tr key={row.key} className="border-t border-tw-line/60">
                    <td
                      className={`p-2 font-bold text-tw-navy ${groupBy === 'day' ? 'cursor-pointer hover:text-tw-blue active:opacity-70' : ''}`}
                      onClick={groupBy === 'day' ? () => setDayDetailDate(row.key) : undefined}
                    >
                      {formatPeriodLabel(row.key)}
                    </td>
                    <td className="p-2 text-center text-tw-muted">{Math.round(row.cash).toLocaleString()}</td>
                    <td className="p-2 text-center text-tw-muted">{Math.round(row.mada).toLocaleString()}</td>
                    <td className="p-2 text-center text-tw-muted">{Math.round(row.transfer).toLocaleString()}</td>
                    <td className="p-2 text-center font-bold text-tw-blue">{Math.round(row.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* تبويب المصاريف */}
          {activeTab === 'expenses' && (
            <>
              {/* Batch 36: زر فلتر التصنيف فوق الجدول (يومي فقط) */}
              {groupBy === 'day' && availableCategories.length > 0 && (
                <div className="px-2 pt-2 pb-1 flex justify-end">
                  <button
                    onClick={() => setSheet({
                      title: lang === 'en' ? 'Pick category' : 'اختر التصنيف',
                      options: [
                        { value: 'all', label: lang === 'en' ? 'All categories' : 'كل التصنيفات' },
                        ...availableCategories.map((c) => ({ value: c.id, label: c.name })),
                      ],
                      current: categoryFilter,
                      onPick: (v) => { setCategoryFilter(v); setSheet(null); },
                    })}
                    className="inline-flex items-center gap-1.5 bg-white border border-tw-line rounded-lg px-3 py-1.5 text-xs font-bold text-tw-navy hover:bg-tw-soft/40"
                  >
                    <Filter size={12} className="text-tw-blue" />
                    <span>
                      {categoryFilter === 'all'
                        ? (lang === 'en' ? 'All categories' : 'كل التصنيفات')
                        : (availableCategories.find((c) => c.id === categoryFilter)?.name || (lang === 'en' ? 'Category' : 'تصنيف'))}
                    </span>
                    <ChevronDown size={10} className="text-tw-muted/70" />
                  </button>
                </div>
              )}
              {groupBy === 'day' ? (
                <table className="w-full text-xs">
                  <thead className="bg-tw-soft/40">
                    <tr>
                      <th className="p-2 text-right font-bold text-tw-muted">{lang === 'en' ? 'Day' : 'اليوم'}</th>
                      <th className="p-2 text-right font-bold text-tw-muted">{lang === 'en' ? 'Category' : 'التصنيف'}</th>
                      <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Amount' : 'المبلغ'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseLineItems.length === 0 ? (
                      <tr><td colSpan={3} className="text-center p-6 text-tw-muted/70">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                    ) : expenseLineItems.map((row, i) => (
                      <tr key={row.id || i} className="border-t border-tw-line/60">
                        <td className="p-2 text-tw-navy">{formatDayShort(row.date, lang, showYearInDay)}</td>
                        <td className="p-2 text-tw-navy">{row.categoryName || row.category || row.expenseType || '—'}</td>
                        <td className="p-2 text-center font-bold text-tw-red">{Math.round(row.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* Batch 57: عرض مجمّع — إجمالي المصاريف لكل فترة (متغيّر + نصيب الثابت) */
                <table className="w-full text-xs">
                  <thead className="bg-tw-soft/40">
                    <tr>
                      <th className="p-2 text-right font-bold text-tw-muted">{periodColLabel}</th>
                      <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Total expenses' : 'إجمالي المصاريف'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitByGroup.length === 0 ? (
                      <tr><td colSpan={2} className="text-center p-6 text-tw-muted/70">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                    ) : profitByGroup.map((row) => (
                      <tr key={row.key} className="border-t border-tw-line/60">
                        <td className="p-2 font-bold text-tw-navy">{formatPeriodLabel(row.key)}</td>
                        <td className="p-2 text-center font-bold text-tw-red">{Math.round(row.expenses).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* تبويب الربح */}
          {activeTab === 'profit' && (
            <table className="w-full text-xs">
              <thead className="bg-tw-soft/40">
                <tr>
                  <th className="p-2 text-right font-bold text-tw-muted">{periodColLabel}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Sales' : 'المبيعات'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Expenses' : 'المصاريف'}</th>
                  <th
                    onClick={() => toggleSort('profit')}
                    className="p-2 text-center font-bold text-tw-muted cursor-pointer select-none hover:text-tw-blue active:bg-tw-soft/50"
                  >
                    <span className="inline-flex items-center gap-1">
                      {lang === 'en' ? 'Profit' : 'الربح'}
                      <span className="text-[10px] opacity-70">
                        {sortBy === 'profit' ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedProfitByGroup.length === 0 ? (
                  <tr><td colSpan={4} className="text-center p-6 text-tw-muted/70">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                ) : sortedProfitByGroup.map((row) => (
                  <tr key={row.key} className="border-t border-tw-line/60">
                    <td
                      className={`p-2 font-bold text-tw-navy ${groupBy === 'day' ? 'cursor-pointer hover:text-tw-blue active:opacity-70' : ''}`}
                      onClick={groupBy === 'day' ? () => setDayDetailDate(row.key) : undefined}
                    >
                      {formatPeriodLabel(row.key)}
                    </td>
                    <td className="p-2 text-center text-tw-blue">{Math.round(row.sales).toLocaleString()}</td>
                    <td className="p-2 text-center text-tw-red">{Math.round(row.expenses).toLocaleString()}</td>
                    <td className={`p-2 text-center font-bold ${row.profit >= 0 ? 'text-tw-green' : 'text-tw-red'}`}>
                      {Math.round(row.profit).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <BottomSheet
        open={!!sheet}
        title={sheet?.title}
        options={sheet?.options || []}
        current={sheet?.current}
        onPick={sheet?.onPick || (() => {})}
        onClose={() => setSheet(null)}
      />

      {/* Batch 51: Sheet لعرض سجلات اليوم وتعديلها */}
      {dayDetailDate && (
        <DayRecordsSheet
          date={dayDetailDate}
          sales={filteredSales.filter((s) => s.date === dayDetailDate)}
          expenses={filteredExpenses.filter((e) => e.date === dayDetailDate)}
          branches={branchesList}
          lang={lang}
          onClose={() => setDayDetailDate(null)}
          onEditRecord={(rec) => {
            setDayDetailDate(null);
            if (onEditRecord) onEditRecord(rec);
          }}
        />
      )}

      {/* Batch 53: Sheet لعرض تفصيل المؤشر شهرياً */}
      {breakdownMetric && (
        <MonthlyBreakdownSheet
          metric={breakdownMetric}
          branchFilter={branchFilter}
          lang={lang}
          onClose={() => setBreakdownMetric(null)}
        />
      )}
    </div>
  );
}
