// src/components/MonthlyBreakdownSheet.jsx
// ----------------------------------------------------------
// Batch 53: Bottom Sheet لعرض تفصيل أي كرت من الكشف الشامل
// مقسّم حسب الأشهر (من أول شهر فيه بيانات → الشهر الحالي)
// الفرع المختار في الكشف يستمر هنا (لا فلتر شهر/سنة)
// ----------------------------------------------------------
import { useEffect, useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import SarSymbol from './SarSymbol';
import SheetPortal from './SheetPortal';
import { getSales, getExpenses, getFixedExpensesRange, salesNet } from '../firebase';
import { localMonth } from '../utils/dateHelpers';
import { formatMonthLabel } from '../utils/periodHelpers';

// نطاق تاريخي مفتوح: من 2024-01-01 إلى نهاية السنة الحالية
const HISTORY_FROM = '2024-01-01';
const HISTORY_TO = `${new Date().getFullYear()}-12-31`;

export default function MonthlyBreakdownSheet({
  metric,        // 'sales' | 'expenses' | 'profit' | 'avgSales' | 'avgExpenses' | 'avgProfit' | 'cash' | 'mada' | 'transfer'
  branchFilter,  // 'all' | 'toia' | 'wardana'
  lang = 'ar',
  onClose,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [fixed, setFixed] = useState([]);

  // إغلاق بزر Esc
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // تحميل البيانات التاريخية
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [s, e, f] = await Promise.all([
          getSales(HISTORY_FROM, HISTORY_TO),
          getExpenses(HISTORY_FROM, HISTORY_TO),
          getFixedExpensesRange('2024-01', `${new Date().getFullYear()}-12`),
        ]);
        if (cancelled) return;
        setSales(s);
        setExpenses(e);
        setFixed(f);
      } catch (err) {
        if (!cancelled) setError(err?.message || (lang === 'en' ? 'Failed to load' : 'تعذّر التحميل'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [lang]);

  // تطبيق فلتر الفرع
  const filteredSales = useMemo(() =>
    branchFilter === 'all' ? sales : sales.filter((s) => s.branchId === branchFilter),
    [sales, branchFilter]
  );
  const filteredExpenses = useMemo(() =>
    branchFilter === 'all' ? expenses : expenses.filter((e) => e.branchId === branchFilter),
    [expenses, branchFilter]
  );
  const filteredFixed = useMemo(() =>
    branchFilter === 'all' ? fixed : fixed.filter((f) => f.branchId === branchFilter),
    [fixed, branchFilter]
  );

  // تجميع البيانات حسب الشهر
  const rows = useMemo(() => {
    // map: { 'YYYY-MM': { sales: 0, expenses: 0, cash: 0, mada: 0, transfer: 0, daysWithSales: Set, daysWithExp: Set, daysWithAny: Set } }
    const byMonth = new Map();
    const ensure = (m) => {
      if (!byMonth.has(m)) byMonth.set(m, {
        month: m,
        sales: 0,
        varExpenses: 0,
        fixedExpenses: 0,
        cash: 0,
        mada: 0,
        transfer: 0,
        daysWithSales: new Set(),
        daysWithExp: new Set(),
        daysWithAny: new Set(),
      });
      return byMonth.get(m);
    };

    for (const s of filteredSales) {
      if (!s.date) continue;
      const m = s.date.slice(0, 7);
      const row = ensure(m);
      row.sales += salesNet(s);
      row.cash += Number(s.cash) || 0;
      // mada net
      if (typeof s.madaNet === 'number') row.mada += s.madaNet;
      else row.mada += +((Number(s.mada) || 0) * (1 - 0.0092)).toFixed(2);
      row.transfer += Number(s.transfer) || 0;
      row.daysWithSales.add(s.date);
      row.daysWithAny.add(s.date);
    }
    for (const e of filteredExpenses) {
      if (!e.date) continue;
      const m = e.date.slice(0, 7);
      const row = ensure(m);
      row.varExpenses += Number(e.amount) || 0;
      row.daysWithExp.add(e.date);
      row.daysWithAny.add(e.date);
    }
    for (const f of filteredFixed) {
      if (!f.month) continue;
      const row = ensure(f.month);
      row.fixedExpenses += Number(f.amount) || 0;
    }

    // Batch 58: توزيع الثابت نسبة وتناسب على الأيام المسجّلة لكل شهر
    // (ثابت الشهر ÷ أيام الشهر × الأيام المسجّلة) — ليطابق كروت الكشف الشامل.
    // الأشهر المكتملة التسجيل تبقى كما هي تقريباً، والشهر الجاري لا يتضخّم.
    for (const row of byMonth.values()) {
      if (row.fixedExpenses > 0) {
        const [y, m] = row.month.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        row.fixedExpenses = (row.fixedExpenses / daysInMonth) * row.daysWithAny.size;
      }
    }

    // ترتيب الأحدث أولاً
    return Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [filteredSales, filteredExpenses, filteredFixed]);

  // استخراج القيمة المطلوبة من كل صف حسب نوع المؤشر
  const getValue = (row) => {
    const totalExp = row.varExpenses + row.fixedExpenses;
    const profit = row.sales - totalExp;
    switch (metric) {
      case 'sales':       return row.sales;
      case 'expenses':    return totalExp;
      case 'profit':      return profit;
      case 'avgSales':    return row.daysWithSales.size > 0 ? row.sales / row.daysWithSales.size : 0;
      case 'avgExpenses': return row.daysWithExp.size > 0 ? totalExp / row.daysWithExp.size : 0;
      case 'avgProfit':   return row.daysWithAny.size > 0 ? profit / row.daysWithAny.size : 0;
      case 'cash':        return row.cash;
      case 'mada':        return row.mada;
      case 'transfer':    return row.transfer;
      default:            return 0;
    }
  };

  // عنوان + لون حسب نوع المؤشر
  const config = useMemo(() => {
    const map = {
      sales:       { title: lang === 'en' ? 'Total sales' : 'إجمالي المبيعات', color: 'text-tw-blue' },
      expenses:    { title: lang === 'en' ? 'Total expenses' : 'إجمالي المصاريف', color: 'text-tw-red' },
      profit:      { title: lang === 'en' ? 'Net profit' : 'صافي الربح', color: 'text-tw-green' },
      avgSales:    { title: lang === 'en' ? 'Avg sales' : 'متوسط المبيعات', color: 'text-tw-blue' },
      avgExpenses: { title: lang === 'en' ? 'Avg expenses' : 'متوسط المصاريف', color: 'text-tw-red' },
      avgProfit:   { title: lang === 'en' ? 'Avg net profit' : 'متوسط صافي الربح', color: 'text-tw-green' },
      cash:        { title: lang === 'en' ? 'Cash' : 'الكاش', color: 'text-tw-navy' },
      mada:        { title: lang === 'en' ? 'Mada' : 'مدى', color: 'text-tw-navy' },
      transfer:    { title: lang === 'en' ? 'Transfer' : 'تحويل', color: 'text-tw-navy' },
    };
    return map[metric] || { title: '', color: 'text-tw-navy' };
  }, [metric, lang]);

  // إجمالي القيم لعرضه أعلى الصفحة
  const total = useMemo(() => {
    return rows.reduce((sum, r) => sum + getValue(r), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, metric]);

  const branchLabel = {
    all: lang === 'en' ? 'All branches' : 'كل الفروع',
    toia: lang === 'en' ? 'Toia' : 'تويا',
    wardana: lang === 'en' ? 'Wardana' : 'وردانة',
  }[branchFilter] || '';

  return (
    <SheetPortal>
      <div className="tw-sheet-overlay show" onClick={onClose} />
      <div className="tw-sheet-panel show" role="dialog" aria-modal="true" style={{ maxHeight: '85vh' }}>
        <div className="tw-sheet-grab" />

        {/* رأس الشيت */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-base font-bold text-tw-navy">{config.title}</h3>
            <p className="text-[11px] text-tw-muted">{branchLabel}</p>
          </div>
          <button onClick={onClose} className="tw-circle-btn" type="button" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* الإجمالي */}
        {!loading && !error && rows.length > 0 && (
          <div className="bg-tw-soft/40 rounded-xl p-3 mb-3 border border-tw-line flex items-center justify-between">
            <span className="text-xs font-bold text-tw-muted">
              {lang === 'en' ? 'Total' : 'الإجمالي'}
            </span>
            <span className={`text-base font-extrabold ${config.color} flex items-center gap-1`}>
              {Math.round(total).toLocaleString()}
              <SarSymbol className="text-xs" />
            </span>
          </div>
        )}

        {/* المحتوى */}
        <div style={{ maxHeight: 'calc(85vh - 160px)', overflowY: 'auto' }}>
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-tw-blue" />
            </div>
          )}
          {error && (
            <p className="text-tw-red text-xs text-center bg-red-50 border border-red-100 rounded-lg p-3">
              {error}
            </p>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="text-center text-tw-muted text-xs py-8">
              {lang === 'en' ? 'No data available' : 'لا توجد بيانات'}
            </p>
          )}
          {!loading && !error && rows.length > 0 && (
            <div className="bg-white rounded-xl border border-tw-line overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-tw-soft/40">
                  <tr>
                    <th className="p-2.5 text-right font-bold text-tw-muted">
                      {lang === 'en' ? 'Month' : 'الشهر'}
                    </th>
                    <th className="p-2.5 text-center font-bold text-tw-muted">
                      {lang === 'en' ? 'Amount' : 'المبلغ'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const val = Math.round(getValue(row));
                    const valColor = val < 0 ? 'text-tw-red' : config.color;
                    return (
                      <tr key={row.month} className="border-t border-tw-line/60">
                        <td className="p-2.5 font-bold text-tw-navy">
                          {formatMonthLabel(row.month, lang)}
                        </td>
                        <td className={`p-2.5 text-center font-bold ${valColor} flex items-center justify-center gap-1`}>
                          {val.toLocaleString()}
                          <SarSymbol className="text-[10px]" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SheetPortal>
  );
}
