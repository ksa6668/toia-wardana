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
import { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronDown, MapPin, Loader2, Filter } from 'lucide-react';
import { getSales, getExpenses, getFixedExpensesRange, dateRangeToMonthRange, salesNet } from '../firebase';
import BottomSheet from './BottomSheet';
import SarSymbol from './SarSymbol';
import {
  monthRange,
  yearRange,
  getAvailableMonths,
  getAvailableYears,
  formatMonthLabel,
  formatDayShort,
} from '../utils/periodHelpers';

export default function ManagerMonthly({ lang = 'ar' }) {
  // Batch 44: دعم شهري وسنوي + خياري "كل الأشهر" و"كل السنوات"
  const [period, setPeriod] = useState('month'); // 'month' | 'year'
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  // فلتر الفرع: 'all' | 'toia' | 'wardana'
  const [branchFilter, setBranchFilter] = useState('all');
  // التبويب: 'sales' | 'expenses' | 'profit'
  const [activeTab, setActiveTab] = useState('sales');
  // Batch 36: فلتر التصنيف للمصاريف ('all' أو categoryId)
  const [categoryFilter, setCategoryFilter] = useState('all');
  // البيانات
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]); // Batch 43
  // قائمة منبثقة
  const [sheet, setSheet] = useState(null);

  // تحميل البيانات عند تغيير الفترة
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Batch 44: تحديد النطاق بناءً على period
        let from, to;
        if (period === 'month') {
          if (selectedMonth === 'all') {
            from = '2024-01-01';
            to = `${new Date().getFullYear()}-12-31`;
          } else {
            ({ from, to } = monthRange(selectedMonth));
          }
        } else {
          // period === 'year'
          if (selectedYear === 'all') {
            from = '2024-01-01';
            to = `${new Date().getFullYear()}-12-31`;
          } else {
            ({ from, to } = yearRange(selectedYear));
          }
        }
        // Batch 43: نجلب أيضاً المصاريف الثابتة
        const { fromMonth, toMonth } = dateRangeToMonthRange(from, to);
        const [s, e, fx] = await Promise.all([
          getSales(from, to),
          getExpenses(from, to),
          getFixedExpensesRange(fromMonth, toMonth),
        ]);
        if (!cancelled) {
          setSales(s);
          setExpenses(e);
          setFixedExpenses(fx);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل البيانات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [period, selectedMonth, selectedYear]);

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

  // Batch 36+43+44: الإجماليات + المتوسطات
  const totals = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + salesNet(s), 0);
    const totalVarExp = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalFixedExp = filteredFixed.reduce((sum, f) => sum + (f.amount || 0), 0);
    const totalExp = totalVarExp + totalFixedExp;
    const profit = totalSales - totalExp;
    // عدد الأيام الفريدة للحساب المتوسطات
    const daysWithSales = new Set(filteredSales.map((s) => s.date)).size || 1;
    const daysWithExp = new Set(filteredExpenses.map((e) => e.date)).size || 1;
    const daysWithAny = new Set([
      ...filteredSales.map((s) => s.date),
      ...filteredExpenses.map((e) => e.date),
    ]).size || 1;
    return {
      sales: totalSales,
      expenses: totalExp,
      profit,
      avgSales: Math.round(totalSales / daysWithSales),
      avgExp: Math.round(totalExp / daysWithExp),
      avgProfit: Math.round(profit / daysWithAny),
    };
  }, [filteredSales, filteredExpenses, filteredFixed]);

  // تجميع المبيعات حسب اليوم — يستخدم salesNet للـ total
  const salesByDay = useMemo(() => {
    const map = {};
    filteredSales.forEach((s) => {
      const day = s.date;
      if (!day) return;
      if (!map[day]) map[day] = { cash: 0, mada: 0, transfer: 0, total: 0 };
      map[day].cash += s.cash || 0;
      map[day].mada += s.mada || 0;
      map[day].transfer += s.transfer || 0;
      map[day].total += salesNet(s); // صافي بعد رسوم مدى
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, vals]) => ({ day, ...vals }));
  }, [filteredSales]);

  // المصاريف بترتيب اليوم
  const expensesByDay = useMemo(() => {
    return [...filteredExpenses]
      .sort((a, b) => {
        const dA = a.date || '';
        const dB = b.date || '';
        return dB.localeCompare(dA);
      });
  }, [filteredExpenses]);

  // الربح اليومي
  const profitByDay = useMemo(() => {
    const days = {};
    filteredSales.forEach((s) => {
      const d = s.date;
      if (!d) return;
      if (!days[d]) days[d] = { sales: 0, expenses: 0 };
      days[d].sales += salesNet(s);
    });
    filteredExpenses.forEach((e) => {
      const d = e.date;
      if (!d) return;
      if (!days[d]) days[d] = { sales: 0, expenses: 0 };
      days[d].expenses += e.amount || 0;
    });
    return Object.entries(days)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, v]) => ({ day, sales: v.sales, expenses: v.expenses, profit: v.sales - v.expenses }));
  }, [filteredSales, filteredExpenses]);

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

  return (
    <div
      className="min-h-full px-4 pt-4 pb-8"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
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

      {/* Batch 44: 6 كروت (3 إجماليات + 3 متوسطات) */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-white p-3 rounded-xl border border-tw-line text-center">
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Sales' : 'إجمالي المبيعات'}</p>
          <p className="text-sm font-bold text-tw-blue flex items-center justify-center gap-1">
            {Math.round(totals.sales).toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-tw-line text-center">
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Expenses' : 'إجمالي المصاريف'}</p>
          <p className="text-sm font-bold text-tw-red flex items-center justify-center gap-1">
            {Math.round(totals.expenses).toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-tw-line text-center">
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Net Profit' : 'صافي الربح'}</p>
          <p className="text-sm font-bold text-tw-green flex items-center justify-center gap-1">
            {Math.round(totals.profit).toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white p-3 rounded-xl border border-tw-line text-center">
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Avg sales' : 'متوسط المبيعات'}</p>
          <p className="text-sm font-bold text-tw-blue/80 flex items-center justify-center gap-1">
            {totals.avgSales.toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-tw-line text-center">
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Avg expenses' : 'متوسط المصاريف'}</p>
          <p className="text-sm font-bold text-tw-red/80 flex items-center justify-center gap-1">
            {totals.avgExp.toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-tw-line text-center">
          <p className="text-[10px] text-tw-muted mb-1">{lang === 'en' ? 'Avg net profit' : 'متوسط صافي الربح'}</p>
          <p className="text-sm font-bold text-tw-green/80 flex items-center justify-center gap-1">
            {totals.avgProfit.toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </div>
      </div>

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
                  <th className="p-2 text-right font-bold text-tw-muted">{lang === 'en' ? 'Day' : 'اليوم'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Cash' : 'كاش'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Mada' : 'مدى'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Transfer' : 'تحويل'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Total' : 'إجمالي'}</th>
                </tr>
              </thead>
              <tbody>
                {salesByDay.length === 0 ? (
                  <tr><td colSpan={5} className="text-center p-6 text-tw-muted/70">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                ) : salesByDay.map((row) => (
                  <tr key={row.day} className="border-t border-tw-line/60">
                    <td className="p-2 font-bold text-tw-navy">{formatDayShort(row.day, lang)}</td>
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
              {/* Batch 36: زر فلتر التصنيف فوق الجدول */}
              {availableCategories.length > 0 && (
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
              <table className="w-full text-xs">
                <thead className="bg-tw-soft/40">
                  <tr>
                    <th className="p-2 text-right font-bold text-tw-muted">{lang === 'en' ? 'Day' : 'اليوم'}</th>
                    <th className="p-2 text-right font-bold text-tw-muted">{lang === 'en' ? 'Category' : 'التصنيف'}</th>
                    <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Amount' : 'المبلغ'}</th>
                  </tr>
                </thead>
                <tbody>
                  {expensesByDay.length === 0 ? (
                    <tr><td colSpan={3} className="text-center p-6 text-tw-muted/70">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                  ) : expensesByDay.map((row, i) => (
                    <tr key={row.id || i} className="border-t border-tw-line/60">
                      <td className="p-2 text-tw-navy">{formatDayShort(row.date, lang)}</td>
                      <td className="p-2 text-tw-navy">{row.categoryName || row.category || row.expenseType || '—'}</td>
                      <td className="p-2 text-center font-bold text-tw-red">{Math.round(row.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* تبويب الربح */}
          {activeTab === 'profit' && (
            <table className="w-full text-xs">
              <thead className="bg-tw-soft/40">
                <tr>
                  <th className="p-2 text-right font-bold text-tw-muted">{lang === 'en' ? 'Day' : 'اليوم'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Sales' : 'المبيعات'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Expenses' : 'المصاريف'}</th>
                  <th className="p-2 text-center font-bold text-tw-muted">{lang === 'en' ? 'Profit' : 'الربح'}</th>
                </tr>
              </thead>
              <tbody>
                {profitByDay.length === 0 ? (
                  <tr><td colSpan={4} className="text-center p-6 text-tw-muted/70">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                ) : profitByDay.map((row) => (
                  <tr key={row.day} className="border-t border-tw-line/60">
                    <td className="p-2 font-bold text-tw-navy">{formatDayShort(row.day, lang)}</td>
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
    </div>
  );
}
