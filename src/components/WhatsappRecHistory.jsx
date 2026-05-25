// src/components/WhatsappRecHistory.jsx
// ----------------------------------------------------------
// Batch 46.3: قائمة "آخر 7 أيام" لعملاء واتساب
// مشابه لـ RecHistorySection لكن لمجموعة whatsapp
// يدعم: عرض + تعديل + حذف
// ----------------------------------------------------------
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Edit2, Trash2, Users, UserPlus, ShoppingBag } from 'lucide-react';
import { getWhatsappEntries } from '../firebase';
import { localDate } from '../utils/dateHelpers';

function formatDayHeader(dateStr, lang) {
  if (!dateStr) return '—';
  // Batch 46.10: utils/dateHelpers الموحّدة
  const today = new Date();
  const todayKey = localDate(today);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const yestKey = localDate(yest);
  if (dateStr === todayKey) return lang === 'en' ? 'Today' : 'اليوم';
  if (dateStr === yestKey) return lang === 'en' ? 'Yesterday' : 'أمس';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
}

export default function WhatsappRecHistory({
  branchId = 'all',
  lang = 'ar',
  refreshKey = 0,
  editable = false,
  onEdit,
  onDelete,
}) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        const fetchBranchId = branchId === 'all' ? null : branchId;
        const data = await getWhatsappEntries(localDate(sevenDaysAgo), localDate(today), fetchBranchId);
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

  // تجميع حسب اليوم (مع الحفاظ على entries منفصلة للتعديل)
  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={20} className="animate-spin text-tw-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
        {error}
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-center text-tw-muted text-xs py-6 bg-white rounded-2xl border border-tw-line">
        {lang === 'en' ? 'No entries in the last 7 days' : 'لا توجد تسجيلات في آخر 7 أيام'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(([date, items]) => (
        <div key={date}>
          <p className="text-xs text-tw-muted font-bold mb-1.5 px-1">{formatDayHeader(date, lang)}</p>
          <div className="space-y-2">
            {items.map((e) => {
              const branchName = e.branchId === 'toia' ? 'تويا' : e.branchId === 'wardana' ? 'وردانة' : e.branchId;
              return (
                <div
                  key={e.id}
                  className="bg-white border border-tw-line rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-tw-soft text-tw-blue flex items-center justify-center flex-shrink-0">
                      <Users size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-tw-navy">{lang === 'en' ? branchName : `فرع ${branchName}`}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-tw-muted flex items-center gap-1">
                          <Users size={10} /> {e.customers || 0}
                        </span>
                        <span className="text-[11px] text-tw-green font-bold flex items-center gap-1">
                          <UserPlus size={10} /> {e.newCustomers || 0}
                        </span>
                        <span className="text-[11px] text-tw-blue font-bold flex items-center gap-1">
                          <ShoppingBag size={10} /> {e.buyers || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => onEdit?.(e)}
                        className="w-7 h-7 rounded-lg bg-tw-soft/60 text-tw-blue flex items-center justify-center active:scale-95"
                        type="button"
                        title={lang === 'en' ? 'Edit' : 'تعديل'}
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => onDelete?.(e)}
                        className="w-7 h-7 rounded-lg bg-red-50 text-tw-red flex items-center justify-center active:scale-95"
                        type="button"
                        title={lang === 'en' ? 'Delete' : 'حذف'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
