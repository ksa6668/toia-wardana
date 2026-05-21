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
import { Calendar, ChevronDown, MapPin, Loader2 } from 'lucide-react';
import { getSales, getExpenses } from '../firebase';
import BottomSheet from './BottomSheet';
import SarSymbol from './SarSymbol';
import {
  monthRange,
  getAvailableMonths,
  formatMonthLabel,
  formatDayShort,
} from '../utils/periodHelpers';

export default function ManagerMonthly({ lang = 'ar' }) {
  // الفترة
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  // فلتر الفرع: 'all' | 'toia' | 'wardana'
  const [branchFilter, setBranchFilter] = useState('all');
  // التبويب: 'sales' | 'expenses' | 'profit'
  const [activeTab, setActiveTab] = useState('sales');
  // البيانات
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  // قائمة منبثقة
  const [sheet, setSheet] = useState(null);

  // تحميل البيانات عند تغيير الشهر
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { from, to } = monthRange(selectedMonth);
        const [s, e] = await Promise.all([getSales(from, to), getExpenses(from, to)]);
        if (!cancelled) {
          setSales(s);
          setExpenses(e);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل البيانات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedMonth]);

  // فلترة البيانات حسب الفرع
  const filteredSales = useMemo(() => {
    return branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter);
  }, [sales, branchFilter]);

  const filteredExpenses = useMemo(() => {
    return branchFilter === 'all' ? expenses : expenses.filter((e) => e.branchId === branchFilter);
  }, [expenses, branchFilter]);

  // الإجماليات للكروت العلوية
  const totals = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalExp = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    return {
      sales: totalSales,
      expenses: totalExp,
      profit: totalSales - totalExp,
    };
  }, [filteredSales, filteredExpenses]);

  // تجميع المبيعات حسب اليوم
  const salesByDay = useMemo(() => {
    const map = {};
    filteredSales.forEach((s) => {
      const day = s.date || s.timestamp?.toDate?.()?.toISOString().slice(0, 10);
      if (!day) return;
      if (!map[day]) map[day] = { cash: 0, mada: 0, transfer: 0, total: 0 };
      map[day].cash += s.cash || 0;
      map[day].mada += s.mada || 0;
      map[day].transfer += s.transfer || 0;
      map[day].total += s.total || 0;
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

  // الربح اليومي = مبيعات - مصاريف
  const profitByDay = useMemo(() => {
    const days = {};
    filteredSales.forEach((s) => {
      const d = s.date;
      if (!d) return;
      if (!days[d]) days[d] = { sales: 0, expenses: 0 };
      days[d].sales += s.total || 0;
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

  // فتح منتقي
  const openMonthPicker = () => {
    setSheet({
      title: lang === 'en' ? 'Pick month' : 'اختر الشهر',
      options: getAvailableMonths().map((m) => ({ value: m, label: formatMonthLabel(m, lang) })),
      current: selectedMonth,
      onPick: (v) => { setSelectedMonth(v); setSheet(null); },
    });
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
      {/* أزرار التحكم: الشهر + الفرع */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={openMonthPicker}
          className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-2.5 px-3 shadow-sm"
        >
          <Calendar size={14} className="text-blue-600" />
          <span className="font-bold text-xs text-slate-700">{formatMonthLabel(selectedMonth, lang)}</span>
          <ChevronDown size={12} className="text-gray-400" />
        </button>
        <button
          onClick={openBranchPicker}
          className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-2.5 px-3 shadow-sm"
        >
          <MapPin size={14} className="text-blue-600" />
          <span className="font-bold text-xs text-slate-700">
            {lang === 'en' ? `Branch: ${branchLabel}` : `الفرع: ${branchLabel}`}
          </span>
          <ChevronDown size={12} className="text-gray-400" />
        </button>
      </div>

      {/* ملخص 3 كروت */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
          <p className="text-[10px] text-gray-500 mb-1">{lang === 'en' ? 'Sales' : 'إجمالي المبيعات'}</p>
          <p className="text-sm font-bold text-blue-700 flex items-center justify-center gap-1">
            {Math.round(totals.sales).toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
          <p className="text-[10px] text-gray-500 mb-1">{lang === 'en' ? 'Expenses' : 'إجمالي المصاريف'}</p>
          <p className="text-sm font-bold text-red-600 flex items-center justify-center gap-1">
            {Math.round(totals.expenses).toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </div>
        <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
          <p className="text-[10px] text-gray-500 mb-1">{lang === 'en' ? 'Net Profit' : 'صافي الربح'}</p>
          <p className="text-sm font-bold text-emerald-600 flex items-center justify-center gap-1">
            {Math.round(totals.profit).toLocaleString()} <SarSymbol className="text-xs" />
          </p>
        </div>
      </div>

      {/* تبويبات */}
      <div className="flex bg-blue-50 p-1 rounded-xl mb-4">
        {[
          { key: 'sales', label: lang === 'en' ? 'Sales' : 'المبيعات' },
          { key: 'expenses', label: lang === 'en' ? 'Expenses' : 'المصاريف' },
          { key: 'profit', label: lang === 'en' ? 'Profit' : 'الربح' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* المحتوى */}
      {loading && (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}
      {error && (
        <p className="text-red-600 text-xs text-center bg-red-50 border border-red-100 rounded-lg p-3">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* تبويب المبيعات */}
          {activeTab === 'sales' && (
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-right font-bold text-slate-600">{lang === 'en' ? 'Day' : 'اليوم'}</th>
                  <th className="p-2 text-center font-bold text-slate-600">{lang === 'en' ? 'Cash' : 'كاش'}</th>
                  <th className="p-2 text-center font-bold text-slate-600">{lang === 'en' ? 'Mada' : 'مدى'}</th>
                  <th className="p-2 text-center font-bold text-slate-600">{lang === 'en' ? 'Transfer' : 'تحويل'}</th>
                  <th className="p-2 text-center font-bold text-slate-600">{lang === 'en' ? 'Total' : 'إجمالي'}</th>
                </tr>
              </thead>
              <tbody>
                {salesByDay.length === 0 ? (
                  <tr><td colSpan={5} className="text-center p-6 text-gray-400">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                ) : salesByDay.map((row) => (
                  <tr key={row.day} className="border-t border-gray-50">
                    <td className="p-2 font-bold text-slate-700">{formatDayShort(row.day, lang)}</td>
                    <td className="p-2 text-center text-slate-600">{Math.round(row.cash).toLocaleString()}</td>
                    <td className="p-2 text-center text-slate-600">{Math.round(row.mada).toLocaleString()}</td>
                    <td className="p-2 text-center text-slate-600">{Math.round(row.transfer).toLocaleString()}</td>
                    <td className="p-2 text-center font-bold text-blue-700">{Math.round(row.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* تبويب المصاريف */}
          {activeTab === 'expenses' && (
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-right font-bold text-slate-600">{lang === 'en' ? 'Day' : 'اليوم'}</th>
                  <th className="p-2 text-right font-bold text-slate-600">{lang === 'en' ? 'Category' : 'التصنيف'}</th>
                  <th className="p-2 text-center font-bold text-slate-600">{lang === 'en' ? 'Amount' : 'المبلغ'}</th>
                </tr>
              </thead>
              <tbody>
                {expensesByDay.length === 0 ? (
                  <tr><td colSpan={3} className="text-center p-6 text-gray-400">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                ) : expensesByDay.map((row, i) => (
                  <tr key={row.id || i} className="border-t border-gray-50">
                    <td className="p-2 text-slate-700">{formatDayShort(row.date, lang)}</td>
                    <td className="p-2 text-slate-700">{row.category || row.expenseType || '—'}</td>
                    <td className="p-2 text-center font-bold text-red-600">{Math.round(row.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* تبويب الربح */}
          {activeTab === 'profit' && (
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-right font-bold text-slate-600">{lang === 'en' ? 'Day' : 'اليوم'}</th>
                  <th className="p-2 text-center font-bold text-slate-600">{lang === 'en' ? 'Sales' : 'المبيعات'}</th>
                  <th className="p-2 text-center font-bold text-slate-600">{lang === 'en' ? 'Expenses' : 'المصاريف'}</th>
                  <th className="p-2 text-center font-bold text-slate-600">{lang === 'en' ? 'Profit' : 'الربح'}</th>
                </tr>
              </thead>
              <tbody>
                {profitByDay.length === 0 ? (
                  <tr><td colSpan={4} className="text-center p-6 text-gray-400">{lang === 'en' ? 'No data' : 'لا توجد بيانات'}</td></tr>
                ) : profitByDay.map((row) => (
                  <tr key={row.day} className="border-t border-gray-50">
                    <td className="p-2 font-bold text-slate-700">{formatDayShort(row.day, lang)}</td>
                    <td className="p-2 text-center text-blue-700">{Math.round(row.sales).toLocaleString()}</td>
                    <td className="p-2 text-center text-red-600">{Math.round(row.expenses).toLocaleString()}</td>
                    <td className={`p-2 text-center font-bold ${row.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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
