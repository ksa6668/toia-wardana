import { useState, useMemo } from 'react';
import { Loader2, Calendar, MapPin, Receipt, Image as ImageIcon, X, Settings, FileText, ExternalLink } from 'lucide-react';
import { getExpenses } from '../firebase';
import { t, translateCategory } from '../i18n';
import { useCachedQuery } from '../hooks/useCachedQuery';
import SarSymbol from './SarSymbol';
import SheetPortal from './SheetPortal';
import { useScreenHeader } from '../context/ScreenCtx';

// شاشة الإيصالات والفواتير — تعرض المصاريف اللي عليها صورة فاتورة
// الفلاتر: الفترة (آخر 7 أيام / آخر 30 يوم / الكل) + الفرع (تويا / وردانة / الكل)

// نوع المرفق: توافق خلفي — غياب attachmentType يُعامَل كصورة
function isPdfAttachment(exp) {
  const type = exp?.attachmentType;
  if (type) return type === 'pdf';
  return /\.pdf($|\?)/i.test(exp?.invoiceUrl || '');
}

// Batch 85: تسميات ثنائية {ar,en} — المعرّفات والمنطق كما هي
const PERIOD_OPTIONS = [
  { id: '7days', label: { ar: 'آخر 7 أيام', en: 'Last 7 days' }, days: 7 },
  { id: '30days', label: { ar: 'آخر 30 يوماً', en: 'Last 30 days' }, days: 30 },
  { id: 'all', label: { ar: 'الكل', en: 'All' }, days: 365 },
];

const BRANCH_OPTIONS = [
  { id: 'all', label: { ar: 'الكل', en: 'All' } },
  { id: 'toia', label: { ar: 'فرع تويا', en: 'Toia branch' } },
  { id: 'wardana', label: { ar: 'فرع وردانة', en: 'Wardana branch' } },
];

function dateStr(date) {
  // Batch 46.10: التاريخ المحلي (وليس UTC)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(iso, lang = 'ar') {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-SA', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function ManagerReceipts({ onBack, onOpenCategories, lang = 'ar' }) {
  // نفس نص label في ITEMS بشاشة الإعدادات (Batch 85)
  useScreenHeader(lang === 'en' ? 'Receipts & Invoices' : 'الإيصالات والفواتير', onBack);
  const [period, setPeriod] = useState('7days');
  const [branch, setBranch] = useState('toia');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null); // modal viewer (صورة أو PDF)

  // Batch 74: نطاق التواريخ حسب الفترة المختارة (محلي، لا UTC)
  const { from, to } = useMemo(() => {
    const days = PERIOD_OPTIONS.find((p) => p.id === period)?.days || 7;
    const toD = new Date();
    const fromD = new Date();
    fromD.setDate(fromD.getDate() - days + 1);
    return { from: dateStr(fromD), to: dateStr(toD) };
  }, [period]);

  // Batch 74: استعلام مع cache بنفس نمط بقية الشاشات (بدل useEffect خام يعيد
  // الجلب عند كل فتح). المفتاح يتضمن النطاق + الفرع، والاستعلام يضيق على الفرع
  // المختار في Firestore بدل جلب كل الفروع ثم الفلترة في JS ("الكل" يبقى شاملاً).
  const { data: expenses = [], loading, error } = useCachedQuery(
    ['expenses', from, to, branch],
    () => getExpenses(from, to, branch === 'all' ? null : branch),
    { ttl: 30 * 1000, defaultData: [] }
  );

  // تصفية حسب الفرع + الفواتير اللي عليها صورة فقط
  const filtered = useMemo(() => {
    return expenses
      .filter((e) => branch === 'all' || e.branchId === branch)
      .filter((e) => e.invoiceUrl) // فقط اللي معها فاتورة
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [expenses, branch]);

  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filtered]);

  const currentBranchLabel = BRANCH_OPTIONS.find((b) => b.id === branch)?.label[lang] || (lang === 'en' ? 'All' : 'الكل');
  const currentPeriodLabel = PERIOD_OPTIONS.find((p) => p.id === period)?.label[lang] || (lang === 'en' ? 'Last 7 days' : 'آخر 7 أيام');

  return (
    <div
      className="min-h-full relative overflow-hidden pb-20"
      style={{
        background: 'transparent',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >

      <div className="relative z-10 p-4 space-y-4">
        {/* شريط الفلاتر */}
        <div className="flex items-center gap-2">
          {/* فلتر الفترة */}
          <button
            onClick={() => setShowFilters(true)}
            className="flex-1 bg-white rounded-xl border border-tw-line p-3 flex items-center justify-between hover:bg-tw-soft/40 transition-colors"
          >
            <Calendar size={16} className="text-tw-blue" />
            <span className="text-sm font-bold text-tw-navy">{currentPeriodLabel}</span>
          </button>
          {/* فلتر الفرع */}
          <button
            onClick={() => setShowFilters(true)}
            className="flex-1 bg-white rounded-xl border border-tw-line p-3 flex items-center justify-between hover:bg-tw-soft/40 transition-colors"
          >
            <MapPin size={16} className="text-tw-blue" />
            <span className="text-sm font-bold text-tw-navy">{currentBranchLabel}</span>
          </button>
          {/* زر إعدادات التصنيفات */}
          {onOpenCategories && (
            <button
              onClick={onOpenCategories}
              className="bg-white rounded-xl border border-tw-line p-3 hover:bg-tw-soft/40 transition-colors"
              title={lang === 'en' ? 'Category settings' : 'إعدادات التصنيفات'}
              aria-label={lang === 'en' ? 'Category settings' : 'إعدادات التصنيفات'}
            >
              <Settings size={18} className="text-tw-muted" />
            </button>
          )}
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 text-center">
            <p className="text-xs text-tw-muted mb-1">{lang === 'en' ? 'Invoices count' : 'عدد الفواتير'}</p>
            <p className="text-2xl font-extrabold text-tw-blue">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 text-center">
            <p className="text-xs text-tw-muted mb-1">{lang === 'en' ? 'Total' : 'الإجمالي'}</p>
            <p className="text-2xl font-extrabold text-tw-red flex items-center justify-center gap-1">
              {totalAmount.toLocaleString()} <SarSymbol className="text-base" />
            </p>
          </div>
        </div>

        {/* قائمة الفواتير */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-tw-muted/50" />
          </div>
        ) : error ? (
          <p className="text-tw-red text-sm font-bold bg-red-50 border border-red-100 rounded-xl p-4 text-center">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto rounded-full bg-tw-soft flex items-center justify-center mb-4">
              <Receipt size={32} className="text-blue-300" />
            </div>
            <p className="text-tw-muted font-bold text-sm">
              {lang === 'en'
                ? `No invoices ${branch !== 'all' ? `for ${currentBranchLabel} ` : ''}in ${currentPeriodLabel.toLowerCase()}.`
                : `لا توجد فواتير ${branch !== 'all' ? `لـ${currentBranchLabel}` : ''} خلال ${currentPeriodLabel}.`}
            </p>
            <p className="text-tw-muted/70 text-xs mt-1">
              {lang === 'en' ? 'Invoices photographed by employees will appear here' : 'الفواتير التي يرفع الموظف صورتها ستظهر هنا'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((exp) => (
              <ReceiptCard
                key={exp.id}
                expense={exp}
                onViewImage={() => setSelectedReceipt(exp)}
                lang={lang}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet للفلاتر */}
      {showFilters && (
        <FiltersSheet
          period={period}
          setPeriod={setPeriod}
          branch={branch}
          setBranch={setBranch}
          onClose={() => setShowFilters(false)}
          lang={lang}
        />
      )}

      {/* Modal عرض المرفق (صورة أو PDF) */}
      {selectedReceipt && (
        <SheetPortal>
          <div
            className="absolute inset-0 bg-black/80 flex items-center justify-center p-4"
            style={{ zIndex: 70 }}
            onClick={() => setSelectedReceipt(null)}
          >
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 left-4 p-2 bg-white/10 backdrop-blur rounded-full text-white hover:bg-white/20"
            >
              <X size={24} />
            </button>
            {isPdfAttachment(selectedReceipt) ? (
              /* PDF لا يُعرض كصورة — نعرض بطاقة برابط «عرض PDF» يفتح في تبويب جديد */
              <div
                className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 max-w-xs w-full"
                onClick={(e) => e.stopPropagation()}
                dir={lang === 'en' ? 'ltr' : 'rtl'}
              >
                <div className="w-16 h-16 rounded-2xl bg-tw-soft flex items-center justify-center text-tw-red">
                  <FileText size={30} />
                </div>
                <p className="text-sm font-bold text-tw-navy text-center">
                  {lang === 'en' ? 'Invoice file (PDF)' : 'ملف الفاتورة بصيغة PDF'}
                </p>
                <a
                  href={selectedReceipt.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tw-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
                >
                  <ExternalLink size={16} />
                  {t(lang, 'expense.pdf.view')}
                </a>
              </div>
            ) : (
              <img
                src={selectedReceipt.invoiceUrl}
                alt={lang === 'en' ? 'Invoice' : 'فاتورة'}
                className="max-w-full max-h-full rounded-xl shadow-2xl"
                decoding="async"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </SheetPortal>
      )}
    </div>
  );
}

function ReceiptCard({ expense, onViewImage, lang = 'ar' }) {
  const branchLabel = expense.branchId === 'wardana'
    ? (lang === 'en' ? 'Wardana branch' : 'فرع وردانة')
    : expense.branchId === 'toia'
      ? (lang === 'en' ? 'Toia branch' : 'فرع تويا')
      : '—';
  const isPdf = isPdfAttachment(expense);

  return (
    <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 flex items-center gap-3">
      {/* مرفق الفاتورة (thumbnail) — أيقونة PDF أو صورة مصغّرة */}
      <button
        onClick={onViewImage}
        className="w-16 h-16 rounded-xl bg-tw-soft overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity flex items-center justify-center"
      >
        {expense.invoiceUrl && isPdf ? (
          <FileText size={22} className="text-tw-red" />
        ) : expense.invoiceUrl ? (
          /* Batch 74: تحميل كسول للمصغّرات — نطاق R2 مباشر (r2.dev) لا يدعم
             /cdn-cgi/image للتحجيم، فالتخفيف المتاح هو lazy + فك ترميز غير حاجب */
          <img
            src={expense.invoiceUrl}
            alt={lang === 'en' ? 'Invoice' : 'فاتورة'}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={20} className="text-tw-muted/70" />
          </div>
        )}
      </button>

      {/* التفاصيل */}
      <div className={`flex-1 min-w-0 ${lang === 'en' ? 'text-left' : 'text-right'}`}>
        <p className="font-bold text-sm text-tw-navy truncate">
          {expense.category ? translateCategory(lang, expense.category) : (lang === 'en' ? 'Expense' : 'مصروف')}
        </p>
        <p className="text-xs text-tw-muted mt-0.5">
          {branchLabel} · {formatDate(expense.date, lang)}
        </p>
        {expense.notes && (
          <p className="text-[11px] text-tw-muted/70 truncate mt-1">{expense.notes}</p>
        )}
      </div>

      {/* المبلغ */}
      <div className={`${lang === 'en' ? 'text-right' : 'text-left'} flex-shrink-0`}>
        <p className="font-extrabold text-base text-tw-red flex items-center gap-1">
          {Number(expense.amount || 0).toLocaleString()} <SarSymbol className="text-xs" />
        </p>
      </div>
    </div>
  );
}

function FiltersSheet({ period, setPeriod, branch, setBranch, onClose, lang = 'ar' }) {
  return (
    <SheetPortal>
      <div
        className="tw-sheet-overlay show"
        onClick={onClose}
      />
      <div
        className="tw-sheet-panel show"
        style={{ padding: '18px 18px 26px' }}
      >
        <div className="tw-sheet-grab"></div>

        <h3 className="text-lg font-bold text-tw-navy text-center" style={{ marginBottom: 14 }}>
          {lang === 'en' ? 'Filter invoices' : 'تصفية الفواتير'}
        </h3>

        {/* الفترة */}
        <div style={{ marginBottom: 14 }}>
          <label className="text-xs font-bold text-tw-muted mb-2 block">{lang === 'en' ? 'Period' : 'الفترة'}</label>
          <div className="grid grid-cols-3 gap-2">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`py-3 rounded-xl text-sm font-bold border ${
                  period === p.id
                    ? 'bg-tw-blue text-white border-blue-600'
                    : 'bg-tw-soft/40 text-tw-muted border-tw-line'
                }`}
              >
                {p.label[lang]}
              </button>
            ))}
          </div>
        </div>

        {/* الفرع */}
        <div style={{ marginBottom: 18 }}>
          <label className="text-xs font-bold text-tw-muted mb-2 block">{lang === 'en' ? 'Branch' : 'الفرع'}</label>
          <div className="grid grid-cols-3 gap-2">
            {BRANCH_OPTIONS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBranch(b.id)}
                className={`py-3 rounded-xl text-sm font-bold border ${
                  branch === b.id
                    ? 'bg-tw-blue text-white border-blue-600'
                    : 'bg-tw-soft/40 text-tw-muted border-tw-line'
                }`}
              >
                {b.label[lang]}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full text-white font-bold py-3.5 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)' }}
        >
          {lang === 'en' ? 'Apply' : 'تطبيق'}
        </button>
      </div>
    </SheetPortal>
  );
}
