// src/components/WhatsappBuyersMonthly.jsx
// ----------------------------------------------------------
// Batch 64: صفحة "إحصائيات المشترين الشهرية"
// تُفتح من كرت "عدد المشترين" في تبويب واتساب (ManagerWhatsapp).
// تعرض إجمالي عدد المشترين لكل شهر من السنة الحالية (يناير → ديسمبر)
// للفرع المختار، مع كرت علوي بالإجمالي السنوي.
// نقرأ من نفس مصدر البيانات (getWhatsappEntries / مجموعة whatsapp، حقل buyers)
// ونجمّع شهرياً فقط — بدون أي تفصيل يومي أو عملاء أو نسبة.
// ----------------------------------------------------------
import { useMemo } from 'react';
import { Loader2, ShoppingBag, MapPin } from 'lucide-react';
import { getWhatsappEntries } from '../firebase';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { useScreenHeader } from '../context/ScreenCtx';
import { yearRange } from '../utils/periodHelpers';

// أسماء الأشهر — تقويم ميلادي صراحةً (مبنية يدوياً لضمان الميلادي على كل الأجهزة،
// نفس النمط المعتمد في periodHelpers/dateHelpers لتفادي الهجري الافتراضي في 'ar-SA').
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function WhatsappBuyersMonthly({
  branchId = 'all',
  year = new Date().getFullYear(),
  lang = 'ar',
  onBack,
}) {
  useScreenHeader(lang === 'en' ? 'Monthly buyers stats' : 'إحصائيات المشترين الشهرية', onBack);

  const { from, to } = useMemo(() => yearRange(year), [year]);

  // نفس مصدر بيانات الشاشة الحالية — مجموعة whatsapp ضمن نطاق السنة
  const isCurrentYear = year === new Date().getFullYear();
  const ttl = isCurrentYear ? 30 * 1000 : 30 * 60 * 1000;
  const { data: entries = [], loading, error } = useCachedQuery(
    ['whatsapp', from, to],
    () => getWhatsappEntries(from, to),
    { ttl, defaultData: [] }
  );

  // تجميع عدد المشترين شهرياً للفرع المختار (يناير → ديسمبر)
  const { months, yearTotal } = useMemo(() => {
    const filtered = branchId === 'all'
      ? entries
      : entries.filter((e) => e.branchId === branchId);
    // 12 خانة مبدئياً بصفر — لضمان عرض 0 للأشهر بلا بيانات
    const sums = new Array(12).fill(0);
    for (const e of filtered) {
      if (!e.date) continue;
      const m = Number(e.date.slice(5, 7)); // YYYY-MM-DD → الشهر
      if (m >= 1 && m <= 12) sums[m - 1] += e.buyers || 0;
    }
    const total = sums.reduce((s, v) => s + v, 0);
    return { months: sums, yearTotal: total };
  }, [entries, branchId]);

  const branchLabel = {
    all: lang === 'en' ? 'All branches' : 'كل الفروع',
    toia: lang === 'en' ? 'Toia' : 'تويا',
    wardana: lang === 'en' ? 'Wardana' : 'وردانة',
  }[branchId] || (lang === 'en' ? 'All branches' : 'كل الفروع');

  const monthNames = lang === 'en' ? MONTHS_EN : MONTHS_AR;

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-tw-blue" size={32} />
      </div>
    );
  }

  return (
    <div
      className="relative min-h-full px-4 pt-4 pb-24 overflow-y-auto page-bg-soft md:max-w-[560px] md:mx-auto"
      dir={lang === 'en' ? 'ltr' : 'rtl'}
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* الفرع المختار + السنة */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 bg-white border border-tw-line rounded-xl py-2 px-3 shadow-sm">
          <MapPin size={14} className="text-tw-blue" />
          <span className="font-bold text-xs text-tw-navy">
            {lang === 'en' ? `Branch: ${branchLabel}` : `الفرع: ${branchLabel}`}
          </span>
        </div>
        <div className="flex items-center bg-white border border-tw-line rounded-xl py-2 px-3 shadow-sm">
          <span className="font-bold text-xs text-tw-navy">{year}</span>
        </div>
      </div>

      {error && (
        <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mb-3">
          {error}
        </p>
      )}

      {/* كرت الإجمالي السنوي */}
      <div className="bg-white p-4 rounded-2xl border border-tw-line text-center mb-4">
        <ShoppingBag size={18} className="mx-auto text-tw-blue mb-2" />
        <p className="text-[11px] text-tw-muted mb-1">
          {lang === 'en' ? 'Total buyers this year' : 'إجمالي المشترين هذه السنة'}
        </p>
        <p className="text-2xl font-extrabold text-tw-navy">{yearTotal.toLocaleString()}</p>
      </div>

      {/* قائمة الأشهر — صف واحد لكل شهر: اسم الشهر | إجمالي المشترين */}
      <div className="bg-white rounded-2xl border border-tw-line overflow-hidden">
        <div className="grid grid-cols-2 px-4 py-2.5 border-b border-tw-line bg-tw-soft/40 text-[11px] font-bold text-tw-muted">
          <div className="text-right">{lang === 'en' ? 'Month' : 'الشهر'}</div>
          <div className="text-center">{lang === 'en' ? 'Buyers' : 'عدد المشترين'}</div>
        </div>
        {monthNames.map((name, i) => (
          <div
            key={name}
            className="grid grid-cols-2 px-4 py-3 border-b border-tw-line/50 last:border-b-0 text-sm"
          >
            <div className="text-right font-bold text-tw-navy">{name}</div>
            <div className="text-center font-extrabold text-tw-blue">{months[i].toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
