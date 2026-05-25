// src/components/EmployeeWhatsappTable.jsx
// ----------------------------------------------------------
// Batch 48: جدول كشف عملاء واتساب للموظف (آخر 3 أيام)
// مشابه لجدول تبويب واتساب عند المدير لكن:
//   - 3 أيام فقط
//   - فلتر تلقائي على فرع الموظف
//   - تلوين النسبة (أحمر < 20% / أخضر >= 20%)
// ----------------------------------------------------------
import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { getWhatsappEntries } from '../firebase';
import { localDate, daysAgoLocal } from '../utils/dateHelpers';
import { formatDayShort } from '../utils/periodHelpers';

export default function EmployeeWhatsappTable({ branchId, lang = 'ar', refreshKey = 0 }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!branchId) { setLoading(false); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        // آخر 3 أيام (اليوم + يومين)
        const from = daysAgoLocal(2);
        const to = localDate(new Date());
        const data = await getWhatsappEntries(from, to, branchId);
        if (!cancelled) setEntries(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || (lang === 'en' ? 'Failed to load' : 'تعذّر التحميل'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branchId, refreshKey, lang]);

  // تجميع حسب اليوم
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const cur = map.get(e.date) || { date: e.date, customers: 0, newCustomers: 0, buyers: 0 };
      cur.customers += e.customers || 0;
      cur.newCustomers += e.newCustomers || 0;
      cur.buyers += e.buyers || 0;
      map.set(e.date, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [entries]);

  return (
    <div className="bg-white rounded-2xl border border-tw-line overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-tw-line bg-tw-soft/40">
        <MessageCircle size={14} className="text-tw-blue" />
        <h4 className="text-xs font-bold text-tw-navy">
          {lang === 'en' ? 'Last 3 days - WhatsApp' : 'آخر 3 أيام - عملاء واتساب'}
        </h4>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-tw-blue" />
        </div>
      ) : error ? (
        <p className="text-center text-tw-red text-xs py-6 px-3">{error}</p>
      ) : (
        <>
          {/* رؤوس الأعمدة */}
          <div className="grid grid-cols-5 px-3 py-2 border-b border-tw-line/60 text-[11px] font-bold text-tw-muted">
            <div className="text-right">{lang === 'en' ? 'Day' : 'اليوم'}</div>
            <div className="text-center">{lang === 'en' ? 'Customers' : 'عملاء'}</div>
            <div className="text-center">{lang === 'en' ? 'New' : 'جدد'}</div>
            <div className="text-center">{lang === 'en' ? 'Buyers' : 'مشترين'}</div>
            <div className="text-center">{lang === 'en' ? 'Ratio' : 'النسبة'}</div>
          </div>

          {byDay.length === 0 ? (
            <p className="text-center text-tw-muted text-xs py-6">
              {lang === 'en' ? 'No entries in the last 3 days' : 'لا توجد تسجيلات في آخر 3 أيام'}
            </p>
          ) : (
            byDay.map((d) => {
              const ratio = d.customers > 0 ? Math.round((d.buyers / d.customers) * 100) : 0;
              // تلوين النسبة - أحمر < 20% / أخضر >= 20%
              const ratioClass = d.customers === 0
                ? 'text-tw-muted'
                : ratio >= 20
                  ? 'text-tw-green'
                  : 'text-tw-red';
              return (
                <div key={d.date} className="grid grid-cols-5 px-3 py-2.5 border-b border-tw-line/50 last:border-b-0 text-xs">
                  <div className="text-right font-bold text-tw-navy">{formatDayShort(d.date, lang)}</div>
                  <div className="text-center text-tw-navy">{d.customers}</div>
                  <div className="text-center text-tw-green font-bold">{d.newCustomers}</div>
                  <div className="text-center text-tw-blue font-bold">{d.buyers}</div>
                  <div className={`text-center font-bold ${ratioClass}`}>{ratio}%</div>
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
