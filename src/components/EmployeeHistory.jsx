// src/components/EmployeeHistory.jsx
// ----------------------------------------------------------
// سجل آخر 7 أيام للموظف — عرض المبيعات والمصاريف المسجّلة
// تصميم مطابق لـ rec-history-section في الـ prototype.
//
// يقرأ من Firestore عبر firebase.js (getSales, getExpenses)
// محدود بفرع الموظف فقط.
// ----------------------------------------------------------
import { useState, useEffect, useMemo } from 'react';
import {
  ChevronRight, TrendingUp, Receipt, Loader2, Image as ImageIcon, Calendar,
} from 'lucide-react';
import { getSales, getExpenses } from '../firebase';
import { t, translateCategory } from '../i18n';
import SarSymbol from './SarSymbol';
import { formatDayShort } from '../utils/periodHelpers';

export default function EmployeeHistory({ setView, branchId, lang = 'ar' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        // آخر 7 أيام
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const iso = (d) => d.toISOString().slice(0, 10);
        const from = iso(sevenDaysAgo);
        const to = iso(today);
        const [s, e] = await Promise.all([getSales(from, to), getExpenses(from, to)]);
        if (!cancelled) {
          // فلتر فرع الموظف فقط
          setSales(s.filter((x) => x.branchId === branchId));
          setExpenses(e.filter((x) => x.branchId === branchId));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل البيانات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branchId]);

  // الإجماليات
  const totals = useMemo(() => {
    const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalExp = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    return { sales: totalSales, expenses: totalExp, net: totalSales - totalExp };
  }, [sales, expenses]);

  // دمج وترتيب حسب التاريخ النازل
  const allEntries = useMemo(() => {
    const items = [
      ...sales.map((s) => ({ kind: 'sale', ...s })),
      ...expenses.map((e) => ({ kind: 'expense', ...e })),
    ];
    return items.sort((a, b) => {
      const dA = a.date || '';
      const dB = b.date || '';
      return dB.localeCompare(dA);
    });
  }, [sales, expenses]);

  return (
    <div
      className="min-h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* شريط العنوان */}
      <div className="relative z-10 flex items-center p-4 border-b border-gray-100 bg-white/60 backdrop-blur-sm">
        <button
          onClick={() => setView('employeeHome')}
          className="p-2 text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
        >
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-slate-800 px-8">
          {lang === 'en' ? 'Last 7 days' : 'آخر 7 أيام'}
        </h2>
      </div>

      <div className="relative z-10 p-4 space-y-4 pb-8">
        {/* ملخص 3 كروت */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-3 rounded-xl border border-gray-100 text-center shadow-sm">
            <p className="text-[10px] text-gray-500 mb-1">{lang === 'en' ? 'Sales' : 'المبيعات'}</p>
            <p className="text-sm font-bold text-blue-700 flex items-center justify-center gap-1">
              {Math.round(totals.sales).toLocaleString()} <SarSymbol className="text-xs" />
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-100 text-center shadow-sm">
            <p className="text-[10px] text-gray-500 mb-1">{lang === 'en' ? 'Expenses' : 'المصاريف'}</p>
            <p className="text-sm font-bold text-red-600 flex items-center justify-center gap-1">
              {Math.round(totals.expenses).toLocaleString()} <SarSymbol className="text-xs" />
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-gray-100 text-center shadow-sm">
            <p className="text-[10px] text-gray-500 mb-1">{lang === 'en' ? 'Net' : 'الصافي'}</p>
            <p className="text-sm font-bold text-emerald-600 flex items-center justify-center gap-1">
              {Math.round(totals.net).toLocaleString()} <SarSymbol className="text-xs" />
            </p>
          </div>
        </div>

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
          <>
            {/* عنوان القسم */}
            <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
              <span className="text-sm font-bold text-slate-700">
                {lang === 'en' ? 'Recent entries' : 'العمليات الأخيرة'}
              </span>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                {allEntries.length}
              </span>
            </div>

            {/* القائمة */}
            {allEntries.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                <Calendar size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-500 mb-1">
                  {lang === 'en' ? 'No entries yet' : 'لا توجد عمليات بعد'}
                </p>
                <p className="text-xs text-gray-400">
                  {lang === 'en'
                    ? 'Record your first sale or expense from the home screen.'
                    : 'سجّل أول مبيعات أو مصروف من الشاشة الرئيسية.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {allEntries.map((entry, i) => (
                  <div
                    key={entry.id || i}
                    className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-3"
                  >
                    {/* أيقونة النوع */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      entry.kind === 'sale'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {entry.kind === 'sale' ? <TrendingUp size={18} /> : <Receipt size={18} />}
                    </div>

                    {/* التفاصيل */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {entry.kind === 'sale'
                          ? (lang === 'en' ? 'Daily sales' : 'مبيعات اليوم')
                          : translateCategory(lang, entry.categoryName || entry.category || '—')}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {formatDayShort(entry.date, lang)}
                        {entry.notes && ` • ${entry.notes}`}
                      </p>
                    </div>

                    {/* أيقونة الفاتورة لو موجودة */}
                    {entry.invoiceUrl && (
                      <a
                        href={entry.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title={lang === 'en' ? 'View invoice' : 'عرض الفاتورة'}
                      >
                        <ImageIcon size={16} />
                      </a>
                    )}

                    {/* المبلغ */}
                    <div className={`text-sm font-bold flex items-center gap-1 ${
                      entry.kind === 'sale' ? 'text-blue-700' : 'text-red-600'
                    }`}>
                      {entry.kind === 'sale'
                        ? `+${Math.round(entry.total || 0).toLocaleString()}`
                        : `−${Math.round(entry.amount || 0).toLocaleString()}`}
                      <SarSymbol className="text-xs" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
