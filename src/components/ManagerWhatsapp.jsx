// src/components/ManagerWhatsapp.jsx
// ----------------------------------------------------------
// Batch 46: شاشة عرض إحصائيات عملاء واتساب للمدير
// Batch 72: كرت واحد فقط (إجمالي عملاء واتساب) بعرض كامل،
//           وإجماليات الفترة (عملاء/جدد/مشترين/النسبة) مدمجة في رأس الجدول
// - جدول يومي
// - تبويبات شهري/سنوي مثل ManagerMonthly
// ----------------------------------------------------------
import { useState, useMemo } from 'react';
import { Calendar, ChevronDown, MapPin, Loader2, Users, UserPlus, ShoppingBag } from 'lucide-react';
import {
  getWhatsappEntries, getWhatsappBaseline, updateWhatsappEntry, deleteWhatsappEntry,
} from '../firebase';
import BottomSheet from './BottomSheet';
import EditSheet from './EditSheet';
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

export default function ManagerWhatsapp({ lang = 'ar', onOpenBuyersMonthly }) {
  // Batch 45/46: حفظ اختيارات المستخدم
  const [period, setPeriod] = usePersistedState('whatsapp.period', 'month');
  const [selectedMonth, setSelectedMonth] = usePersistedState('whatsapp.month', () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = usePersistedState('whatsapp.year', new Date().getFullYear());
  const [branchFilter, setBranchFilter] = usePersistedState('whatsapp.branch', 'all');
  const [sheet, setSheet] = useState(null);

  // Batch 67: تعديل سجل يوم معيّن مباشرةً من الجدول (Modal)
  const [editRow, setEditRow] = useState(null);   // { date, branchId, items, customers, newCustomers, buyers }
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [multiBranchHint, setMultiBranchHint] = useState(false);

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

  const { data: entries = [], loading, error, refresh: refreshEntries } = useCachedQuery(
    ['whatsapp', from, to],
    () => getWhatsappEntries(from, to),
    { ttl, defaultData: [] }
  );

  // Batch 58.1: إصلاح الإجمالي التراكمي — نجلب كل العملاء الجدد منذ البداية
  // وحتى نهاية الفترة المعروضة (to)، لأن الإجمالي يتراكم عبر الأشهر وليس داخل الشهر فقط.
  const { data: cumulativeEntries = [], refresh: refreshCumulative } = useCachedQuery(
    ['whatsapp', '2024-01-01', to],
    () => getWhatsappEntries('2024-01-01', to),
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
  // - إجمالي عملاء واتساب = baseline + كل العملاء الجدد التراكمي حتى نهاية الفترة
  // - العملاء الجدد (الكرت) = مجموع newCustomers في الفترة المختارة فقط
  // - عدد المشترين = مجموع buyers في الفترة
  // - نسبة المشترين = buyers / customers (من الكشف فقط، بدون baseline)
  const totals = useMemo(() => {
    // مجموع baseline (مفلتر بالفرع)
    const filteredBaseline = branchFilter === 'all'
      ? baselines
      : baselines.filter((b) => b.branchId === branchFilter);
    const totalBaseline = filteredBaseline.reduce((sum, b) => sum + (b.totalCustomers || 0), 0);

    // Batch 58.1: العملاء الجدد التراكمي (منذ البداية حتى نهاية الفترة) — للإجمالي
    const cumByBranch = branchFilter === 'all'
      ? cumulativeEntries
      : cumulativeEntries.filter((e) => e.branchId === branchFilter);
    const cumulativeNew = cumByBranch.reduce((sum, e) => sum + (e.newCustomers || 0), 0);

    // جدد الفترة المختارة فقط — لكرت "العملاء الجدد"
    const totalNew = filteredEntries.reduce((sum, e) => sum + (e.newCustomers || 0), 0);
    const totalBuyers = filteredEntries.reduce((sum, e) => sum + (e.buyers || 0), 0);
    const dailyCustomers = filteredEntries.reduce((sum, e) => sum + (e.customers || 0), 0);

    // إجمالي العملاء = baseline + الجدد التراكمي (عبر كل الأشهر السابقة + الحالي)
    const totalCustomers = totalBaseline + cumulativeNew;
    // نسبة المشترين من سجل الكشف فقط
    const buyersPct = dailyCustomers > 0 ? Math.round((totalBuyers / dailyCustomers) * 100) : 0;
    // Batch 72: نُرجع dailyCustomers (مجموع «عدد عملاء واتساب» اليومي للفترة)
    // لعرضه في رأس الجدول — هو نفسه مقام النسبة أعلاه.
    return { totalCustomers, totalNew, totalBuyers, dailyCustomers, buyersPct };
  }, [filteredEntries, cumulativeEntries, baselines, branchFilter]);

  // جدول مجمع باليوم
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of filteredEntries) {
      const cur = map.get(e.date) || { date: e.date, customers: 0, newCustomers: 0, buyers: 0, items: [] };
      cur.customers += e.customers || 0;
      cur.newCustomers += e.newCustomers || 0;
      cur.buyers += e.buyers || 0;
      cur.items.push(e);   // Batch 67: نحتفظ بالوثائق الخام للصف لتعديلها مباشرة
      map.set(e.date, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredEntries]);

  // Batch 67: فتح modal تعديل صف يوم معيّن
  const openEditRow = (row) => {
    // الوثائق الخام للصف مفلترة أصلاً بالفرع المختار في الأعلى.
    const branchIds = [...new Set(row.items.map((i) => i.branchId))];
    if (branchIds.length !== 1) {
      // وضع "الكل" واليوم يضم أكثر من فرع → لا نُعدّل لتفادي استهداف فرع خاطئ
      setMultiBranchHint(true);
      return;
    }
    setMultiBranchHint(false);
    setEditError('');
    setEditRow({
      date: row.date,
      branchId: branchIds[0],
      items: row.items,
      customers: String(row.customers),
      newCustomers: String(row.newCustomers),
      buyers: String(row.buyers),
    });
  };

  // Batch 67: حفظ تعديل الصف — تحديث نفس الوثيقة (لا تكرار)، وإعادة تحميل فوري
  const handleSaveEdit = async () => {
    if (savingEdit || !editRow) return;
    setEditError('');
    const cN = Math.max(0, Math.floor(Number(editRow.customers) || 0));
    const nN = Math.max(0, Math.floor(Number(editRow.newCustomers) || 0));
    const bN = Math.max(0, Math.floor(Number(editRow.buyers) || 0));
    setSavingEdit(true);
    try {
      const items = editRow.items;
      // نُحدّث الوثيقة الأولى لنفس (اليوم+الفرع)
      await updateWhatsappEntry(items[0].id, {
        date: editRow.date,
        branchId: editRow.branchId,
        customers: cN,
        newCustomers: nN,
        buyers: bN,
      });
      // دمج أي وثائق مكررة لنفس اليوم والفرع (نادر) كي يبقى المجموع مطابقاً للمُدخَل
      for (let i = 1; i < items.length; i++) {
        await deleteWhatsappEntry(items[i].id);
      }
      // إعادة تحميل فوري للجدول والكروت (نفس بيانات الشهر)
      refreshEntries();
      refreshCumulative();
      setEditRow(null);
    } catch (err) {
      setEditError(err?.message || (lang === 'en' ? 'Save failed' : 'تعذّر الحفظ'));
    } finally {
      setSavingEdit(false);
    }
  };

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
      onPick: (v) => { setBranchFilter(v); setMultiBranchHint(false); setSheet(null); },
    });
  };

  const branchLabel = {
    all: lang === 'en' ? 'All' : 'الكل',
    toia: lang === 'en' ? 'Toia' : 'تويا',
    wardana: lang === 'en' ? 'Wardana' : 'وردانة',
  }[branchFilter];

  // Batch 67: نعرض اللودر الكامل فقط عند التحميل الأولي (لا توجد بيانات بعد)،
  // كي لا يومض عند إعادة التحميل الفوري بعد حفظ تعديل.
  if ((loading && entries.length === 0) || (baselineLoading && baselines.length === 0)) {
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

      {/* Batch 72: كرت واحد فقط بعرض كامل — إجمالي عملاء واتساب.
          كروت الجدد/المشترين/النسبة انتقلت إجمالياتها إلى رأس الجدول أدناه. */}
      <div className="bg-white p-4 rounded-2xl border border-tw-line text-center mb-4">
        <Users size={18} className="mx-auto text-tw-blue mb-2" />
        <p className="text-[11px] text-tw-muted mb-1">{lang === 'en' ? 'Total customers' : 'إجمالي عملاء واتساب'}</p>
        <p className="text-lg font-extrabold text-tw-navy">{totals.totalCustomers.toLocaleString()}</p>
      </div>

      {/* Batch 67: تنبيه عند ضغط يوم يضم أكثر من فرع في وضع "الكل" */}
      {multiBranchHint && (
        <p className="text-amber-700 text-xs font-bold bg-amber-50 border border-amber-100 rounded-lg p-3 text-center mb-3">
          {lang === 'en'
            ? 'This day has entries for more than one branch — pick a specific branch above to edit it.'
            : 'هذا اليوم يضم سجلات لأكثر من فرع — اختر فرعاً محدداً من الأعلى لتعديله.'}
        </p>
      )}

      {/* جدول يومي - Batch 46.7: إضافة عمود النسبة
          Batch 72: إجمالي الفترة أسفل عنوان كل عمود رقمي (مدمج في الرأس، ليس صف بيانات)
          بنفس ألوان أعمدة الصفوف، ونسبة الإجمالي بنفس منطق تلوين الصفوف اليومية. */}
      <div className="bg-white rounded-2xl border border-tw-line overflow-hidden">
        <div className="grid grid-cols-5 px-3 py-2 border-b border-tw-line bg-tw-soft/40 items-center">
          <div className="text-right text-[11px] font-bold text-tw-muted">{lang === 'en' ? 'Day' : 'اليوم'}</div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-tw-muted/80 leading-tight">{lang === 'en' ? 'Customers' : 'عملاء'}</p>
            <p className="text-sm font-extrabold text-tw-navy leading-tight">{totals.dailyCustomers.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold text-tw-muted/80 leading-tight">{lang === 'en' ? 'New' : 'جدد'}</p>
            <p className="text-sm font-extrabold text-tw-green leading-tight">{totals.totalNew.toLocaleString()}</p>
          </div>
          {/* Batch 64/72: الضغط على «مشترين» يفتح إحصائيات المشترين الشهرية (كان على الكرت المحذوف) */}
          <button
            type="button"
            onClick={() => onOpenBuyersMonthly && onOpenBuyersMonthly(branchFilter, new Date().getFullYear())}
            className="text-center cursor-pointer transition-transform active:scale-[0.97] focus:outline-none"
            aria-label={lang === 'en' ? 'Open monthly buyers stats' : 'فتح إحصائيات المشترين الشهرية'}
          >
            <p className="text-[10px] font-bold text-tw-muted/80 leading-tight">{lang === 'en' ? 'Buyers' : 'مشترين'}</p>
            <p className="text-sm font-extrabold text-tw-blue leading-tight">{totals.totalBuyers.toLocaleString()}</p>
          </button>
          <div className="text-center">
            <p className="text-[10px] font-bold text-tw-muted/80 leading-tight">{lang === 'en' ? 'Ratio' : 'النسبة'}</p>
            <p className={`text-sm font-extrabold leading-tight ${
              totals.dailyCustomers === 0
                ? 'text-tw-muted'
                : totals.buyersPct >= 20
                  ? 'text-tw-green'
                  : 'text-tw-red'
            }`}>{totals.buyersPct}%</p>
          </div>
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
              <div
                key={d.date}
                onClick={() => openEditRow(d)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditRow(d); } }}
                className="grid grid-cols-5 px-3 py-2.5 border-b border-tw-line/50 last:border-b-0 text-xs cursor-pointer hover:bg-tw-soft/30 active:bg-tw-soft/50 transition-colors focus:outline-none focus:bg-tw-soft/40"
                title={lang === 'en' ? 'Tap to edit this day' : 'اضغط لتعديل هذا اليوم'}
              >
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

      {/* Batch 67: modal تعديل سجل يوم معيّن */}
      <EditSheet
        open={!!editRow}
        onClose={() => { if (!savingEdit) setEditRow(null); }}
        title={editRow
          ? `${lang === 'en' ? 'Edit' : 'تعديل سجل'} ${formatDayShort(editRow.date, lang)} · ${lang === 'en' ? 'branch' : 'فرع'} ${
              editRow.branchId === 'toia' ? (lang === 'en' ? 'Toia' : 'تويا')
              : editRow.branchId === 'wardana' ? (lang === 'en' ? 'Wardana' : 'وردانة')
              : editRow.branchId
            }`
          : ''}
      >
        {editRow && (
          <>
            <div className="tw-form-card">
              <div className="tw-payment-row">
                <label>
                  <Users />
                  <span>{lang === 'en' ? 'WhatsApp customers' : 'عدد عملاء واتساب'}</span>
                </label>
                <input type="number" inputMode="numeric" placeholder="0" dir="ltr"
                  value={editRow.customers}
                  onChange={(e) => setEditRow((r) => ({ ...r, customers: e.target.value }))} />
                <div className="unit" style={{ fontSize: 11 }}>{lang === 'en' ? 'cust.' : 'عميل'}</div>
              </div>

              <div className="tw-payment-row">
                <label>
                  <UserPlus />
                  <span>{lang === 'en' ? 'New customers' : 'العملاء الجدد'}</span>
                </label>
                <input type="number" inputMode="numeric" placeholder="0" dir="ltr"
                  value={editRow.newCustomers}
                  onChange={(e) => setEditRow((r) => ({ ...r, newCustomers: e.target.value }))} />
                <div className="unit" style={{ fontSize: 11 }}>{lang === 'en' ? 'cust.' : 'عميل'}</div>
              </div>

              <div className="tw-payment-row">
                <label>
                  <ShoppingBag />
                  <span>{lang === 'en' ? 'Buyers' : 'عدد المشترين'}</span>
                </label>
                <input type="number" inputMode="numeric" placeholder="0" dir="ltr"
                  value={editRow.buyers}
                  onChange={(e) => setEditRow((r) => ({ ...r, buyers: e.target.value }))} />
                <div className="unit" style={{ fontSize: 11 }}>{lang === 'en' ? 'cust.' : 'عميل'}</div>
              </div>
            </div>

            {editError && (
              <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mt-3">
                {editError}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setEditRow(null)}
                disabled={savingEdit}
                className="flex-1 py-3 rounded-xl border border-tw-line bg-white text-tw-navy font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {lang === 'en' ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 py-3 rounded-xl bg-tw-blue text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-1"
              >
                {savingEdit && <Loader2 size={16} className="animate-spin" />}
                {savingEdit
                  ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
                  : (lang === 'en' ? 'Save changes' : 'حفظ التعديل')}
              </button>
            </div>
          </>
        )}
      </EditSheet>
    </div>
  );
}
