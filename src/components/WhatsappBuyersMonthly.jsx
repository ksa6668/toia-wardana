// src/components/WhatsappBuyersMonthly.jsx
// ----------------------------------------------------------
// Batch 64: صفحة "إحصائيات المشترين الشهرية"
// تُفتح من كرت "عدد المشترين" في تبويب واتساب (ManagerWhatsapp).
// Batch 65: مقارنة الفرعين معاً — لكل شهر من السنة المختارة (يناير → ديسمبر)
// أعمدة: الشهر | تويا | وردانة | الإجمالي (تويا + وردانة)، مع كرت علوي بالإجمالي
// السنوي لكل الفروع مجتمعة. لا محدد فرع — تُعرض المقارنة دائماً.
// نقرأ من نفس مصدر البيانات (getWhatsappEntries / مجموعة whatsapp، حقل buyers)
// ونجمّع حسب (الشهر × الفرع) فقط — بدون أي تفصيل يومي أو عملاء أو نسبة.
// ----------------------------------------------------------
import { useMemo } from 'react';
import { Loader2, ShoppingBag } from 'lucide-react';
import { getWhatsappEntries } from '../firebase';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { useScreenHeader } from '../context/ScreenCtx';
import { yearRange } from '../utils/periodHelpers';

// أسماء الأشهر — تقويم ميلادي صراحةً (مبنية يدوياً لضمان الميلادي على كل الأجهزة،
// نفس النمط المعتمد في periodHelpers/dateHelpers لتفادي الهجري الافتراضي في 'ar-SA').
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function WhatsappBuyersMonthly({
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

  // تجميع المشترين حسب (الشهر × الفرع) للسنة المختارة (يناير → ديسمبر)
  // toia[12] / wardana[12] / totals[12]=toia+wardana — كلها تبدأ بصفر لضمان عرض 0.
  const { toia, wardana, totals, yearTotal } = useMemo(() => {
    const t = new Array(12).fill(0);
    const w = new Array(12).fill(0);
    for (const e of entries) {
      if (!e.date) continue;
      const m = Number(e.date.slice(5, 7)); // YYYY-MM-DD → الشهر
      if (m < 1 || m > 12) continue;
      const b = e.buyers || 0;
      if (e.branchId === 'toia') t[m - 1] += b;
      else if (e.branchId === 'wardana') w[m - 1] += b;
    }
    const tot = t.map((v, i) => v + w[i]);
    const yt = tot.reduce((s, v) => s + v, 0);
    return { toia: t, wardana: w, totals: tot, yearTotal: yt };
  }, [entries]);

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
      {/* السنة فقط — لا محدد فرع (الصفحة تعرض مقارنة الفرعين دائماً) */}
      <div className="flex items-center justify-center mb-3">
        <div className="flex items-center bg-white border border-tw-line rounded-xl py-2 px-4 shadow-sm">
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

      {/* جدول مقارنة الفرعين — RTL: الشهر | تويا | وردانة | الإجمالي
          (4 أعمدة → حشو أصغر قليلاً ليتسع الأرقام بدون كسر التخطيط) */}
      <div className="bg-white rounded-2xl border border-tw-line overflow-hidden">
        <div className="grid grid-cols-4 px-3 py-2.5 border-b border-tw-line bg-tw-soft/40 text-[11px] font-bold text-tw-muted">
          <div className="text-right">{lang === 'en' ? 'Month' : 'الشهر'}</div>
          <div className="text-center">{lang === 'en' ? 'Toia' : 'تويا'}</div>
          <div className="text-center">{lang === 'en' ? 'Wardana' : 'وردانة'}</div>
          <div className="text-center">{lang === 'en' ? 'Total' : 'الإجمالي'}</div>
        </div>
        {monthNames.map((name, i) => (
          <div
            key={name}
            className="grid grid-cols-4 px-3 py-2.5 border-b border-tw-line/50 last:border-b-0 text-sm"
          >
            <div className="text-right font-bold text-tw-navy">{name}</div>
            <div className="text-center font-bold text-tw-blue">{toia[i].toLocaleString()}</div>
            <div className="text-center font-bold text-tw-blue">{wardana[i].toLocaleString()}</div>
            <div className="text-center font-extrabold text-tw-navy">{totals[i].toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
