import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Loader2, Calendar, MapPin, Receipt, Image as ImageIcon, FileText, X, Settings } from 'lucide-react';
import { getExpenses } from '../firebase';
import SarSymbol from './SarSymbol';

// شاشة الإيصالات والفواتير — تعرض المصاريف اللي عليها صورة فاتورة
// الفلاتر: الفترة (آخر 7 أيام / آخر 30 يوم / الكل) + الفرع (تويا / وردانة / الكل)

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
  return date.toISOString().slice(0, 10);
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
  const [period, setPeriod] = useState('7days');
  const [branch, setBranch] = useState('toia');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); // modal viewer

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
      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button onClick={onBack} className="p-2 text-tw-muted bg-tw-soft rounded-full hover:bg-slate-200 transition-colors">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="flex-1 text-center px-8">
          <h2 className="text-lg font-bold text-tw-navy">الإيصالات والفواتير</h2>
          <p className="text-xs text-tw-muted/70 mt-0.5">Toia &amp; Wardana</p>
        </div>
      </div>

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
                onViewImage={() => setSelectedImage(exp.invoiceUrl)}
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

      {/* Modal عرض الصورة */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 left-4 p-2 bg-white/10 backdrop-blur rounded-full text-white hover:bg-white/20"
          >
            <X size={24} />
          </button>
          <img
            src={selectedImage}
            alt="فاتورة"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function ReceiptCard({ expense, onViewImage }) {
  const branchLabel = expense.branchId === 'wardana' ? 'فرع وردانة' : expense.branchId === 'toia' ? 'فرع تويا' : '—';

  return (
    <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 flex items-center gap-3">
      {/* صورة الفاتورة (thumbnail) */}
      <button
        onClick={onViewImage}
        className="w-16 h-16 rounded-xl bg-tw-soft overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
      >
        {expense.invoiceUrl ? (
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl p-5 space-y-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* مقبض السحب */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto"></div>

        <h3 className="text-lg font-bold text-tw-navy text-center">تصفية الفواتير</h3>

        {/* الفترة */}
        <div>
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
        <div>
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
    </div>
  );
}
