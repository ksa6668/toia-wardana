// src/components/ManagerWhatsapp.jsx
// ----------------------------------------------------------
// Batch 46: شاشة عرض إحصائيات عملاء واتساب للمدير
// - 4 كروت إحصائية (إجمالي/جدد/مشترين/نسبة المشترين)
// - جدول يومي
// - تبويبات شهري/سنوي مثل ManagerMonthly
// ----------------------------------------------------------
import { useState, useMemo } from 'react';
import { Calendar, ChevronDown, MapPin, Loader2, Users, UserPlus, ShoppingBag, Percent } from 'lucide-react';
import { getWhatsappEntries, getWhatsappBaseline } from '../firebase';
import BottomSheet from './BottomSheet';
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

export default function ManagerWhatsapp({ lang = 'ar' }) {
  // Batch 45/46: حفظ اختيارات المستخدم
  const [period, setPeriod] = usePersistedState('whatsapp.period', 'month');
  const [selectedMonth, setSelectedMonth] = usePersistedState('whatsapp.month', () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = usePersistedState('whatsapp.year', new Date().getFullYear());
  const [branchFilter, setBranchFilter] = usePersistedState('whatsapp.branch', 'all');
  const [sheet, setSheet] = useState(null);

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

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentY = now.getFullYear();
    if (period === 'month') return selectedMonth === currentYM || selectedMonth === 'all';
    return selectedYear === currentY || selectedYear === 'all';
  }, [period, selectedMonth, selectedYear]);

  const ttl = isCurrentPeriod ? 30 * 1000 : 30 * 60 * 1000;

  const { data: entries = [], loading, error } = useCachedQuery(
    ['whatsapp', from, to],
    () => getWhatsappEntries(from, to),
    { ttl, defaultData: [] }
  );

  // Batch 46.2: baseline تاريخي (لا يتغيّر مع الفترة)
  const { data: baselines = [], loading: baselineLoading } = useCachedQuery(
    ['whatsappBaseline'],
    () => getWhatsappBaseline(),
    { ttl: 5 * 60 * 1000, defaultData: [] }
  );

  const filteredEntries = useMemo(() => {
    return branchFilter === 'all' ? entries : entries.filter((e) => e.branchId === branchFilter);
  }, [entries, branchFilter]);

  // Batch 46.2: الإجماليات الجديدة
  // - إجمالي عملاء واتساب = baseline + مجموع العملاء الجدد (تراكمي)
  // - العملاء الجدد = مجموع newCustomers في الفترة
  // - عدد المشترين = مجموع buyers في الفترة
  // - نسبة المشترين = buyers / customers (من الكشف فقط، بدون baseline)
  const totals = useMemo(() => {
    // مجموع baseline (مفلتر بالفرع)
    const filteredBaseline = branchFilter === 'all'
      ? baselines
      : baselines.filter((b) => b.branchId === branchFilter);
    const totalBaseline = filteredBaseline.reduce((sum, b) => sum + (b.totalCustomers || 0), 0);

    const totalNew = filteredEntries.reduce((sum, e) => sum + (e.newCustomers || 0), 0);
    const totalBuyers = filteredEntries.reduce((sum, e) => sum + (e.buyers || 0), 0);
    const dailyCustomers = filteredEntries.reduce((sum, e) => sum + (e.customers || 0), 0);

    // إجمالي العملاء = baseline + الجدد التراكمي
    const totalCustomers = totalBaseline + totalNew;
    // نسبة المشترين من سجل الكشف فقط
    const buyersPct = dailyCustomers > 0 ? Math.round((totalBuyers / dailyCustomers) * 100) : 0;
    return { totalCustomers, totalNew, totalBuyers, buyersPct };
  }, [filteredEntries, baselines, branchFilter]);

  // جدول مجمع باليوم
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of filteredEntries) {
      const cur = map.get(e.date) || { date: e.date, customers: 0, newCustomers: 0, buyers: 0 };
      cur.customers += e.customers || 0;
      cur.newCustomers += e.newCustomers || 0;
      cur.buyers += e.buyers || 0;
      map.set(e.date, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredEntries]);

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

  if (loading || baselineLoading) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-tw-blue" size={32} />
      </div>
    );
  }

  return (
    <div className="relative min-h-full px-4 pt-4 pb-24 overflow-y-auto page-bg-soft"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* تبويبات شهري/سنوي */}
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

      {/* أزرار التحكم */}
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

      {error && (
        <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mb-3">
          {error}
        </p>
      )}

      {/* 4 كروت إحصائية - صفّين، كل صف كرتين */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white p-4 rounded-2xl border border-tw-line text-center">
          <Users size={18} className="mx-auto text-tw-blue mb-2" />
          <p className="text-[11px] text-tw-muted mb-1">{lang === 'en' ? 'Total customers' : 'إجمالي عملاء واتساب'}</p>
          <p className="text-lg font-extrabold text-tw-navy">{totals.totalCustomers.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-tw-line text-center">
          <UserPlus size={18} className="mx-auto text-tw-green mb-2" />
          <p className="text-[11px] text-tw-muted mb-1">{lang === 'en' ? 'New customers' : 'العملاء الجدد'}</p>
          <p className="text-lg font-extrabold text-tw-navy">{totals.totalNew.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-tw-line text-center">
          <ShoppingBag size={18} className="mx-auto text-tw-blue mb-2" />
          <p className="text-[11px] text-tw-muted mb-1">{lang === 'en' ? 'Buyers' : 'عدد المشترين'}</p>
          <p className="text-lg font-extrabold text-tw-navy">{totals.totalBuyers.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-tw-line text-center">
          <Percent size={18} className="mx-auto text-tw-green mb-2" />
          <p className="text-[11px] text-tw-muted mb-1">{lang === 'en' ? 'Buyers ratio' : 'نسبة المشترين'}</p>
          <p className="text-lg font-extrabold text-tw-navy">{totals.buyersPct}%</p>
        </div>
      </div>

      {/* جدول يومي - Batch 46.7: إضافة عمود النسبة */}
      <div className="bg-white rounded-2xl border border-tw-line overflow-hidden">
        <div className="grid grid-cols-5 px-3 py-2.5 border-b border-tw-line bg-tw-soft/40 text-[11px] font-bold text-tw-muted">
          <div className="text-right">{lang === 'en' ? 'Day' : 'اليوم'}</div>
          <div className="text-center">{lang === 'en' ? 'Customers' : 'عملاء'}</div>
          <div className="text-center">{lang === 'en' ? 'New' : 'جدد'}</div>
          <div className="text-center">{lang === 'en' ? 'Buyers' : 'مشترين'}</div>
          <div className="text-center">{lang === 'en' ? 'Ratio' : 'النسبة'}</div>
        </div>
        {byDay.length === 0 ? (
          <p className="text-center text-tw-muted text-xs py-6">
            {lang === 'en' ? 'No data for this period' : 'لا توجد بيانات لهذه الفترة'}
          </p>
        ) : (
          byDay.map((d) => {
            const ratio = d.customers > 0 ? Math.round((d.buyers / d.customers) * 100) : 0;
            // Batch 48: تلوين النسبة - أحمر < 20% / أخضر >= 20%
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
      </div>

      <BottomSheet
        open={!!sheet}
        title={sheet?.title || ''}
        options={sheet?.options || []}
        current={sheet?.current}
        onPick={sheet?.onPick || (() => {})}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
