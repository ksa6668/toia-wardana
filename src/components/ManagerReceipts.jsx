import { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, MapPin, Receipt, Image as ImageIcon, X, Settings, FileText, ExternalLink } from 'lucide-react';
import { getExpenses } from '../firebase';
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

const PERIOD_OPTIONS = [
  { id: '7days', label: 'آخر 7 أيام', days: 7 },
  { id: '30days', label: 'آخر 30 يوماً', days: 30 },
  { id: 'all', label: 'الكل', days: 365 },
];

const BRANCH_OPTIONS = [
  { id: 'all', label: 'الكل' },
  { id: 'toia', label: 'فرع تويا' },
  { id: 'wardana', label: 'فرع وردانة' },
];

function dateStr(date) {
  // Batch 46.10: التاريخ المحلي (وليس UTC)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-SA', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function ManagerReceipts({ onBack, onOpenCategories }) {
  useScreenHeader('الإيصالات والفواتير', onBack);
  const [period, setPeriod] = useState('7days');
  const [branch, setBranch] = useState('toia');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null); // modal viewer (صورة أو PDF)

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const days = PERIOD_OPTIONS.find((p) => p.id === period)?.days || 7;
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - days + 1);
        const data = await getExpenses(dateStr(from), dateStr(to));
        if (!cancelled) setExpenses(data || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر التحميل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [period]);

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

  const currentBranchLabel = BRANCH_OPTIONS.find((b) => b.id === branch)?.label || 'الكل';
  const currentPeriodLabel = PERIOD_OPTIONS.find((p) => p.id === period)?.label || 'آخر 7 أيام';

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
              title="إعدادات التصنيفات"
              aria-label="إعدادات التصنيفات"
            >
              <Settings size={18} className="text-tw-muted" />
            </button>
          )}
        </div>

        {/* بطاقات الإحصائيات */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 text-center">
            <p className="text-xs text-tw-muted mb-1">عدد الفواتير</p>
            <p className="text-2xl font-extrabold text-tw-blue">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 text-center">
            <p className="text-xs text-tw-muted mb-1">الإجمالي</p>
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
              لا توجد فواتير {branch !== 'all' ? `لـ${currentBranchLabel}` : ''} خلال {currentPeriodLabel.toLowerCase()}.
            </p>
            <p className="text-tw-muted/70 text-xs mt-1">
              الفواتير التي يرفع الموظف صورتها ستظهر هنا
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((exp) => (
              <ReceiptCard
                key={exp.id}
                expense={exp}
                onViewImage={() => setSelectedReceipt(exp)}
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
                dir="rtl"
              >
                <div className="w-16 h-16 rounded-2xl bg-tw-soft flex items-center justify-center text-tw-red">
                  <FileText size={30} />
                </div>
                <p className="text-sm font-bold text-tw-navy text-center">ملف الفاتورة بصيغة PDF</p>
                <a
                  href={selectedReceipt.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tw-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
                >
                  <ExternalLink size={16} />
                  عرض PDF
                </a>
              </div>
            ) : (
              <img
                src={selectedReceipt.invoiceUrl}
                alt="فاتورة"
                className="max-w-full max-h-full rounded-xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </SheetPortal>
      )}
    </div>
  );
}

function ReceiptCard({ expense, onViewImage }) {
  const branchLabel = expense.branchId === 'wardana' ? 'فرع وردانة' : expense.branchId === 'toia' ? 'فرع تويا' : '—';
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
          <img
            src={expense.invoiceUrl}
            alt="فاتورة"
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={20} className="text-tw-muted/70" />
          </div>
        )}
      </button>

      {/* التفاصيل */}
      <div className="flex-1 min-w-0 text-right">
        <p className="font-bold text-sm text-tw-navy truncate">
          {expense.category || 'مصروف'}
        </p>
        <p className="text-xs text-tw-muted mt-0.5">
          {branchLabel} · {formatDate(expense.date)}
        </p>
        {expense.notes && (
          <p className="text-[11px] text-tw-muted/70 truncate mt-1">{expense.notes}</p>
        )}
      </div>

      {/* المبلغ */}
      <div className="text-left flex-shrink-0">
        <p className="font-extrabold text-base text-tw-red flex items-center gap-1">
          {Number(expense.amount || 0).toLocaleString()} <SarSymbol className="text-xs" />
        </p>
      </div>
    </div>
  );
}

function FiltersSheet({ period, setPeriod, branch, setBranch, onClose }) {
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

        <h3 className="text-lg font-bold text-tw-navy text-center" style={{ marginBottom: 14 }}>تصفية الفواتير</h3>

        {/* الفترة */}
        <div style={{ marginBottom: 14 }}>
          <label className="text-xs font-bold text-tw-muted mb-2 block">الفترة</label>
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
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* الفرع */}
        <div style={{ marginBottom: 18 }}>
          <label className="text-xs font-bold text-tw-muted mb-2 block">الفرع</label>
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
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full text-white font-bold py-3.5 rounded-xl"
          style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)' }}
        >
          تطبيق
        </button>
      </div>
    </SheetPortal>
  );
}
