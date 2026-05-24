// src/components/RecHistorySection.jsx
// قائمة "آخر 7 أيام" — مكوّن مشترك
// editable=true → يظهر زر ✎ + 🗑 على كل سطر (للمدير)
import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, Receipt, Loader2, Image as ImageIcon, Calendar, Pencil, Trash2,
} from 'lucide-react';
import { getSales, getExpenses } from '../firebase';
import { translateCategory } from '../i18n';
import SarSymbol from './SarSymbol';

function formatDayHeader(dateStr, lang) {
  if (!dateStr) return '—';
  // Batch 46.3: التاريخ المحلي بدل UTC (لتجنّب مشكلة المنطقة الزمنية)
  const localISO = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const today = new Date();
  const todayKey = localISO(today);
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const yestKey = localISO(yest);
  if (dateStr === todayKey) return lang === 'en' ? 'Today' : 'اليوم';
  if (dateStr === yestKey) return lang === 'en' ? 'Yesterday' : 'أمس';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
}

export default function RecHistorySection({
  branchId,
  lang = 'ar',
  showTitle = true,
  refreshKey = 0,
  editable = false,
  onEdit,
  onDelete,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!branchId) { setLoading(false); return; }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        // Batch 46.3: استخدام التاريخ المحلي (وليس UTC) لتجنّب فرق المنطقة الزمنية
        // السعودية UTC+3 → toISOString يعطي يوم سابق بعد منتصف الليل
        const iso = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        // Batch 41: لو branchId === 'all' (المدير)، نجلب كل الفروع
        // لو فرع معيّن، نُمرر branchId لـ getSales/getExpenses ليفلتر في Firestore
        const fetchBranchId = branchId === 'all' ? null : branchId;
        const [s, e] = await Promise.all([
          getSales(iso(sevenDaysAgo), iso(today), fetchBranchId),
          getExpenses(iso(sevenDaysAgo), iso(today), fetchBranchId),
        ]);
        if (!cancelled) {
          // البيانات مفلترة في Firestore بالفعل (أو 'all' للمدير)
          setSales(s);
          setExpenses(e);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || (lang === 'en' ? 'Failed to load data' : 'تعذّر تحميل البيانات'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branchId, lang, refreshKey]);

  const allEntries = useMemo(() => {
    const items = [
      ...sales.map((s) => ({ kind: 'sale', ...s })),
      ...expenses.map((e) => ({ kind: 'expense', ...e })),
    ];
    return items.sort((a, b) => {
      const k = (a.date || '').localeCompare(b.date || '');
      if (k !== 0) return -k;
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
  }, [sales, expenses]);

  const groupedByDay = useMemo(() => {
    const map = {};
    allEntries.forEach((e) => {
      const k = e.date || '—';
      if (!map[k]) map[k] = [];
      map[k].push(e);
    });
    return map;
  }, [allEntries]);

  const days = Object.keys(groupedByDay);

  return (
    <div className="tw-rec-history-section">
      {showTitle && (
        <div className="tw-rec-history-title">
          <span>{lang === 'en' ? 'Last 7 days' : 'آخر 7 أيام'}</span>
        </div>
      )}

      {loading && (
        <div className="tw-rec-empty">
          <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block', color: 'var(--tw-blue)' }} />
          <span>{lang === 'en' ? 'Loading…' : 'جارٍ التحميل…'}</span>
        </div>
      )}

      {error && !loading && (
        <div className="tw-rec-empty" style={{ color: 'var(--tw-red)' }}>
          {error}
        </div>
      )}

      {!loading && !error && allEntries.length === 0 && (
        <div className="tw-rec-empty">
          <Calendar />
          <div>
            {lang === 'en'
              ? 'No records in the last 7 days'
              : 'لا توجد عمليات في آخر 7 أيام'}
          </div>
        </div>
      )}

      {!loading && !error && days.map((day) => (
        <div key={day}>
          <div className="tw-rec-day-header">{formatDayHeader(day, lang)}</div>
          {groupedByDay[day].map((entry, i) => {
            const isSale = entry.kind === 'sale';
            const title = isSale
              ? (lang === 'en' ? 'Daily sales' : 'مبيعات اليوم')
              : translateCategory(lang, entry.categoryName || entry.category || '—');
            const sub = [
              entry.notes,
              entry.invoiceUrl && (lang === 'en' ? 'with photo' : 'مع صورة'),
            ].filter(Boolean).join(' • ');
            const amt = isSale
              ? Math.round(entry.total || 0)
              : Math.round(entry.amount || 0);

            return (
              <div key={entry.id || `${day}-${i}`} className="tw-rec-card">
                <div className={`tw-rec-icon ${isSale ? 'sale' : 'expense'}`}>
                  {isSale ? <TrendingUp /> : <Receipt />}
                </div>
                <div className="tw-rec-body">
                  <b>{title}</b>
                  {sub && <small>{sub}</small>}
                </div>

                {entry.invoiceUrl && (
                  <a
                    href={entry.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tw-rec-action-btn"
                    title={lang === 'en' ? 'View invoice' : 'عرض الفاتورة'}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ImageIcon size={14} />
                  </a>
                )}

                <div className={`tw-rec-amt ${isSale ? 'sale' : 'expense'}`}>
                  <span dir="ltr">{isSale ? '+' : '−'}{amt.toLocaleString('en-US')}</span>
                  <SarSymbol />
                </div>

                {editable && (
                  <div className="tw-rec-actions">
                    <button
                      type="button"
                      className="tw-rec-action-btn edit"
                      onClick={() => onEdit?.(entry)}
                      title={lang === 'en' ? 'Edit' : 'تعديل'}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      className="tw-rec-action-btn delete"
                      onClick={() => onDelete?.(entry)}
                      title={lang === 'en' ? 'Delete' : 'حذف'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
