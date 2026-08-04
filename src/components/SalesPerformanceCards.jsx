// src/components/SalesPerformanceCards.jsx
// ----------------------------------------------------------
// Batch 88: صف كروت أداء المبيعات (أسبوعي / ربع سنوي / نصف سنوي)
// داخل الكشف الشامل — بديل كروت الفترة في شاشة المؤشرات المحذوفة.
//
//   • كرت واحد فقط مفتوح في نفس الوقت — الافتراضي: الكل مغلق.
//   • لكل كرت منتقي فترة خاص به (شهر للأسبوعي، سنة للربع/النصف سنوي).
//   • الحساب عبر computePeriodCards (منقول حرفياً من شاشة المؤشرات)
//     + دوال التقسيم المشتركة في periodHelpers.
//   • الجلب يبدأ فقط عند فتح الكرت (enabled) — نفس مفاتيح cache
//     المستخدمة في بقية الشاشات ['sales', from, to] ⇒ لا قراءات مكررة.
//   • حالة فارغة صريحة عند عدم وجود بيانات للفترة (لا أصفار مضللة).
// ----------------------------------------------------------
import { useState, useMemo } from 'react';
import { Calendar, ChevronDown, Loader2 } from 'lucide-react';
import { getSales } from '../firebase';
import BottomSheet from './BottomSheet';
import SarSymbol from './SarSymbol';
import { useCachedQuery } from '../hooks/useCachedQuery';
import {
  monthRange,
  yearRange,
  getAvailableMonths,
  getAvailableYears,
  formatMonthLabel,
  splitMonthToWeeks,
  splitYearToQuarters,
  splitYearToHalves,
} from '../utils/periodHelpers';
import { computePeriodCards } from '../utils/kpiHelpers';

// كارت أسبوع/ربع/نصف (navy gradient) — منقول من شاشة المؤشرات (PeriodCard)
function PeriodCard({ label, amount, pct }) {
  return (
    <div
      className="text-white p-3 rounded-2xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
        boxShadow: '0 6px 16px rgba(0,91,255,0.15)',
      }}
    >
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
      />
      <div className="relative flex flex-col items-center text-center gap-1.5">
        <span className="text-[11px] font-bold opacity-95">{label}</span>
        <b className="text-2xl font-extrabold flex items-center gap-1 leading-tight">
          {Math.round(amount).toLocaleString()}
          <SarSymbol className="text-xs" />
        </b>
        <small className="text-[10px] opacity-80">{pct}%</small>
      </div>
    </div>
  );
}

// TTL بنمط الشاشة: الفترة الحالية 30 ثانية، التاريخية 30 دقيقة
const ttlFor = (isCurrent) => (isCurrent ? 30 * 1000 : 30 * 60 * 1000);

export default function SalesPerformanceCards({ lang = 'ar', branchFilter = 'all' }) {
  // useState عادي (وليس usePersistedState) ⇒ تعود الكروت مغلقة عند إعادة فتح الشاشة
  const [expanded, setExpanded] = useState(null); // null | 'week' | 'quarter' | 'half'
  const [weekMonth, setWeekMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [quarterYear, setQuarterYear] = useState(() => new Date().getFullYear());
  const [halfYear, setHalfYear] = useState(() => new Date().getFullYear());
  const [sheet, setSheet] = useState(null);

  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentY = now.getFullYear();

  const weekRange = useMemo(() => monthRange(weekMonth), [weekMonth]);
  const quarterRange = useMemo(() => yearRange(quarterYear), [quarterYear]);
  const halfRange = useMemo(() => yearRange(halfYear), [halfYear]);

  const { data: weekSales = [], loading: weekLoading } = useCachedQuery(
    ['sales', weekRange.from, weekRange.to],
    () => getSales(weekRange.from, weekRange.to),
    { ttl: ttlFor(weekMonth === currentYM), defaultData: [], enabled: expanded === 'week' }
  );
  const { data: quarterSales = [], loading: quarterLoading } = useCachedQuery(
    ['sales', quarterRange.from, quarterRange.to],
    () => getSales(quarterRange.from, quarterRange.to),
    { ttl: ttlFor(quarterYear === currentY), defaultData: [], enabled: expanded === 'quarter' }
  );
  const { data: halfSales = [], loading: halfLoading } = useCachedQuery(
    ['sales', halfRange.from, halfRange.to],
    () => getSales(halfRange.from, halfRange.to),
    { ttl: ttlFor(halfYear === currentY), defaultData: [], enabled: expanded === 'half' }
  );

  const filterBranch = (rows) =>
    branchFilter === 'all' ? rows : rows.filter((s) => s.branchId === branchFilter);

  const openMonthPicker = () => setSheet({
    title: lang === 'en' ? 'Pick month' : 'اختر الشهر',
    options: getAvailableMonths().map((m) => ({ value: m, label: formatMonthLabel(m, lang) })),
    current: weekMonth,
    onPick: (v) => { setWeekMonth(v); setSheet(null); },
  });
  const openYearPicker = (current, setter) => setSheet({
    title: lang === 'en' ? 'Pick year' : 'اختر السنة',
    options: getAvailableYears().map((y) => ({ value: y, label: String(y) })),
    current,
    onPick: (v) => { setter(v); setSheet(null); },
  });

  // تعريف الكروت الثلاثة — الترتيب في RTL: الأسبوعي يميناً ثم الربع ثم النصف سنوي
  const sections = {
    week: {
      title: lang === 'en' ? 'Weekly sales performance' : 'أداء المبيعات الأسبوعي',
      pickerLabel: formatMonthLabel(weekMonth, lang),
      openPicker: openMonthPicker,
      loading: weekLoading,
      sales: filterBranch(weekSales),
      ranges: splitMonthToWeeks(weekMonth),
      grid: 'grid-cols-2 md:grid-cols-4',
    },
    quarter: {
      title: lang === 'en' ? 'Quarterly sales performance' : 'أداء المبيعات الربع سنوي',
      pickerLabel: String(quarterYear),
      openPicker: () => openYearPicker(quarterYear, setQuarterYear),
      loading: quarterLoading,
      sales: filterBranch(quarterSales),
      ranges: splitYearToQuarters(quarterYear),
      grid: 'grid-cols-2 md:grid-cols-4',
    },
    half: {
      title: lang === 'en' ? 'Half-yearly sales performance' : 'أداء المبيعات النصف سنوي',
      pickerLabel: String(halfYear),
      openPicker: () => openYearPicker(halfYear, setHalfYear),
      loading: halfLoading,
      sales: filterBranch(halfSales),
      ranges: splitYearToHalves(halfYear),
      grid: 'grid-cols-2',
    },
  };

  const active = expanded ? sections[expanded] : null;
  // نفس معادلة شاشة المؤشرات حرفياً (computePeriodCards) — لا تُحسب إلا عند وجود بيانات
  const activeCards = active && !active.loading && active.sales.length > 0
    ? computePeriodCards(active.ranges, active.sales, lang)
    : [];

  return (
    <>
      {/* صف الكروت الثلاثة — نفس ارتفاع بقية كروت الكشف الشامل */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {['week', 'quarter', 'half'].map((k) => {
          const s = sections[k];
          const open = expanded === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setExpanded(open ? null : k)}
              className={`bg-white p-3 rounded-xl border text-center min-h-[4.75rem] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform ${
                open ? 'border-tw-blue shadow-sm' : 'border-tw-line'
              }`}
            >
              <p className={`text-[10px] font-bold leading-tight ${open ? 'text-tw-blue' : 'text-tw-muted'}`}>
                {s.title}
              </p>
              <ChevronDown
                size={14}
                className={`transition-transform ${open ? 'rotate-180 text-tw-blue' : 'text-tw-muted/70'}`}
              />
            </button>
          );
        })}
      </div>

      {/* اللوحة الموسّعة — كرت واحد فقط مفتوح في نفس الوقت */}
      {active && (
        <div className="bg-white p-3 rounded-xl border border-tw-line mb-2">
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-xs font-extrabold text-tw-navy">{active.title}</p>
            <button
              type="button"
              onClick={active.openPicker}
              className="flex items-center gap-1.5 bg-tw-soft rounded-lg py-1.5 px-2.5 active:scale-95 transition-transform"
            >
              <Calendar size={12} className="text-tw-blue" />
              <span className="text-[11px] font-bold text-tw-navy">{active.pickerLabel}</span>
              <ChevronDown size={12} className="text-tw-muted/70" />
            </button>
          </div>
          {active.loading ? (
            <div className="flex items-center justify-center py-8 text-tw-muted/70">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : active.sales.length === 0 ? (
            <p className="text-center text-xs text-tw-muted/70 py-6">
              {lang === 'en' ? 'No data for the selected period' : 'لا توجد بيانات للفترة المختارة'}
            </p>
          ) : (
            <div className={`grid gap-2 ${active.grid}`}>
              {activeCards.map((c, i) => (
                <PeriodCard key={i} label={c.label} amount={c.amount} pct={c.pct} />
              ))}
            </div>
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
    </>
  );
}
