// src/components/ManageWhatsappBaseline.jsx
// ----------------------------------------------------------
// Batch 46.2: شاشة "عملاء الواتساب" للمدير - شاملة:
//   - تسجيل يومي (مثل شاشة الموظف) مع pill لتبديل الفرع
//   - إجمالي العملاء تاريخياً لكل فرع
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  Calendar, MapPin, Users, UserPlus, ShoppingBag, Loader2, ChevronDown, MessageCircle,
} from 'lucide-react';
import {
  addWhatsappEntry,
  updateWhatsappEntry,
  deleteWhatsappEntry,
  getBranches,
  getWhatsappBaseline,
  setWhatsappBaseline,
} from '../firebase';
import BranchPickerSheet from './BranchPickerSheet';
import DateSheet from './DateSheet';
import DeleteConfirmSheet from './DeleteConfirmSheet';
import WhatsappRecHistory from './WhatsappRecHistory';
import { useScreenHeader } from '../context/ScreenCtx';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLabelFor(dateStr, lang) {
  if (!dateStr) return '—';
  const T = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  if (dateStr === T) return lang === 'en' ? 'Today' : 'اليوم';
  if (dateStr === yStr) return lang === 'en' ? 'Yesterday' : 'أمس';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function ManageWhatsappBaseline({ onBack, lang = 'ar' }) {
  useScreenHeader(lang === 'en' ? 'WhatsApp Customers' : 'عملاء الواتساب', onBack);

  // الفرع المختار للتسجيل اليومي (افتراضي: تويا)
  const [chosenBranch, setChosenBranch] = useState('toia');
  const [date, setDate] = useState(todayStr());
  const [customers, setCustomers] = useState('');
  const [newCustomers, setNewCustomers] = useState('');
  const [buyers, setBuyers] = useState('');

  // Baseline لكل فرع
  const [toiaBaseline, setToiaBaseline] = useState('');
  const [wardanaBaseline, setWardanaBaseline] = useState('');

  // UI states
  const [branches, setBranches] = useState([]);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [doneEntry, setDoneEntry] = useState(false);
  const [doneBaseline, setDoneBaseline] = useState(false);
  const [error, setError] = useState('');
  // Batch 46.3: تعديل وحذف السجلات
  const [editingId, setEditingId] = useState(null);
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [brs, baselines] = await Promise.all([
          getBranches(),
          getWhatsappBaseline(),
        ]);
        if (cancelled) return;
        setBranches(brs);
        const t = baselines.find((b) => b.id === 'toia');
        const w = baselines.find((b) => b.id === 'wardana');
        setToiaBaseline(t ? String(t.totalCustomers || 0) : '');
        setWardanaBaseline(w ? String(w.totalCustomers || 0) : '');
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر التحميل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const branchName = chosenBranch === 'toia' ? 'تويا' : 'وردانة';

  const handleSaveEntry = async () => {
    if (savingEntry) return;
    setError('');
    const cN = Math.max(0, Math.floor(Number(customers) || 0));
    const nN = Math.max(0, Math.floor(Number(newCustomers) || 0));
    const bN = Math.max(0, Math.floor(Number(buyers) || 0));
    if (cN === 0 && nN === 0 && bN === 0) {
      setError(lang === 'en' ? 'Please enter at least one value' : 'يرجى إدخال قيمة واحدة على الأقل');
      return;
    }
    if (bN > cN) {
      setError(lang === 'en' ? 'Buyers cannot exceed customers' : 'عدد المشترين لا يمكن أن يتجاوز عدد العملاء');
      return;
    }
    setSavingEntry(true);
    try {
      if (editingId) {
        // Batch 46.3: تعديل سجل موجود
        await updateWhatsappEntry(editingId, {
          date,
          branchId: chosenBranch,
          customers: cN,
          newCustomers: nN,
          buyers: bN,
        });
      } else {
        await addWhatsappEntry({
          date,
          branchId: chosenBranch,
          customers: cN,
          newCustomers: nN,
          buyers: bN,
        });
      }
      setDoneEntry(true);
      // مسح الحقول
      setCustomers('');
      setNewCustomers('');
      setBuyers('');
      setEditingId(null);
      setDate(todayStr());
      setRefreshKey((k) => k + 1);
      setTimeout(() => setDoneEntry(false), 1500);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSavingEntry(false);
    }
  };

  // Batch 46.3: تعديل سجل موجود (يملأ النموذج بقيم السجل)
  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setDate(entry.date);
    setChosenBranch(entry.branchId);
    setCustomers(String(entry.customers || 0));
    setNewCustomers(String(entry.newCustomers || 0));
    setBuyers(String(entry.buyers || 0));
    // scroll لأعلى الصفحة
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setCustomers('');
    setNewCustomers('');
    setBuyers('');
    setDate(todayStr());
    setError('');
  };

  const handleDeleteRequest = (entry) => {
    setDeleteError('');
    setDeletingEntry(entry);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingEntry) return;
    setDeleteError('');
    try {
      await deleteWhatsappEntry(deletingEntry.id);
      setDeletingEntry(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setDeleteError(err?.message || 'تعذّر الحذف');
      throw err;
    }
  };

  const handleSaveBaseline = async () => {
    if (savingBaseline) return;
    setError('');
    setSavingBaseline(true);
    try {
      await Promise.all([
        setWhatsappBaseline('toia', toiaBaseline),
        setWhatsappBaseline('wardana', wardanaBaseline),
      ]);
      setDoneBaseline(true);
      setTimeout(() => setDoneBaseline(false), 1500);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSavingBaseline(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-tw-blue" size={32} />
      </div>
    );
  }

  return (
    <>
      <div className="relative min-h-full px-4 pt-4 pb-8 overflow-y-auto page-bg-soft"
        style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
      >
        {/* ============ القسم الأول: التسجيل اليومي ============ */}
        <p className="text-center text-tw-muted text-xs mb-3">
          {lang === 'en'
            ? "Record today's WhatsApp customers and buyers"
            : 'تسجيل عملاء واتساب والمشترين لليوم'}
        </p>

        <div className="flex gap-2 mb-3">
          <div
            className="tw-pill"
            onClick={() => setDateSheetOpen(true)}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer', flex: 1 }}
          >
            <Calendar size={14} />
            <span>{dateLabelFor(date, lang)}</span>
            <ChevronDown size={12} style={{ marginInlineStart: 'auto', opacity: 0.5 }} />
          </div>

          <div
            className="tw-pill"
            onClick={() => setBranchSheetOpen(true)}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer', flex: 1 }}
          >
            <MapPin size={14} />
            <span>{lang === 'en' ? branchName : `فرع ${branchName}`}</span>
            <ChevronDown size={12} style={{ marginInlineStart: 'auto', opacity: 0.5 }} />
          </div>
        </div>

        <div className="tw-form-card">
          <h4>{lang === 'en' ? "Today's WhatsApp data" : "تفاصيل الواتساب لليوم"}</h4>

          <div className="tw-payment-row">
            <label>
              <Users />
              <span>{lang === 'en' ? 'WhatsApp customers' : 'عدد عملاء واتساب'}</span>
            </label>
            <input type="number" inputMode="numeric" placeholder="0"
              value={customers} onChange={(e) => setCustomers(e.target.value)} dir="ltr" />
            <div className="unit" style={{ fontSize: 11 }}>{lang === 'en' ? 'cust.' : 'عميل'}</div>
          </div>

          <div className="tw-payment-row">
            <label>
              <UserPlus />
              <span>{lang === 'en' ? 'New customers' : 'العملاء الجدد'}</span>
            </label>
            <input type="number" inputMode="numeric" placeholder="0"
              value={newCustomers} onChange={(e) => setNewCustomers(e.target.value)} dir="ltr" />
            <div className="unit" style={{ fontSize: 11 }}>{lang === 'en' ? 'cust.' : 'عميل'}</div>
          </div>

          <div className="tw-payment-row">
            <label>
              <ShoppingBag />
              <span>{lang === 'en' ? 'Buyers' : 'عدد المشترين'}</span>
            </label>
            <input type="number" inputMode="numeric" placeholder="0"
              value={buyers} onChange={(e) => setBuyers(e.target.value)} dir="ltr" />
            <div className="unit" style={{ fontSize: 11 }}>{lang === 'en' ? 'cust.' : 'عميل'}</div>
          </div>
        </div>

        <div className="tw-btn-row mt-4">
          {editingId && (
            <button
              type="button"
              className="tw-btn secondary"
              onClick={handleCancelEdit}
              style={{ flex: 0.6 }}
            >
              {lang === 'en' ? 'Cancel edit' : 'إلغاء التعديل'}
            </button>
          )}
          <button
            type="button"
            className="tw-btn"
            onClick={handleSaveEntry}
            disabled={savingEntry || doneEntry}
            style={{ flex: 1 }}
          >
            {savingEntry && <Loader2 size={18} className="animate-spin inline-block ml-1" />}
            {doneEntry
              ? (lang === 'en' ? 'Saved!' : 'تم الحفظ!')
              : savingEntry
                ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
                : editingId
                  ? (lang === 'en' ? 'Update entry' : 'تحديث التسجيل')
                  : (lang === 'en' ? 'Save daily entry' : 'حفظ التسجيل اليومي')}
          </button>
        </div>

        {/* Batch 46.3: سجل آخر 7 أيام */}
        <div className="mt-5 mb-3">
          <p className="text-sm font-bold text-tw-navy mb-2 px-1">
            {lang === 'en' ? 'Last 7 days' : 'آخر 7 أيام'}
          </p>
          <WhatsappRecHistory
            branchId="all"
            lang={lang}
            refreshKey={refreshKey}
            editable={true}
            onEdit={handleEdit}
            onDelete={handleDeleteRequest}
          />
        </div>

        {deleteError && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mb-3">
            {deleteError}
          </p>
        )}

        {/* ============ القسم الثاني: الإجمالي التاريخي ============ */}
        <div className="mt-6 mb-3 flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          <span className="text-xs font-bold text-tw-muted">
            {lang === 'en' ? 'Historical Total' : 'الإجمالي التاريخي'}
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        </div>

        <p className="text-center text-tw-muted text-xs mb-3">
          {lang === 'en'
            ? 'Total historical WhatsApp customers per branch'
            : 'إجمالي عملاء واتساب التاريخي لكل فرع'}
        </p>

        {/* كرتين مربعين جنب بعض */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* فرع تويا - مربع صغير */}
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <MessageCircle size={14} className="text-tw-blue" />
              <h4 className="text-xs font-bold text-tw-navy">
                {lang === 'en' ? 'Toia' : 'فرع تويا'}
              </h4>
            </div>
            <label className="text-[10px] font-bold text-tw-muted mb-1 block leading-tight">
              {lang === 'en' ? 'Total historically' : 'إجمالي تاريخياً'}
            </label>
            <div className="flex items-center gap-1.5 bg-tw-soft/40 border border-tw-line rounded-xl p-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={toiaBaseline}
                onChange={(e) => setToiaBaseline(e.target.value)}
                className="flex-1 text-sm font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50 min-w-0"
                dir="ltr"
              />
              <span className="text-tw-muted/70 text-[10px] flex-shrink-0">{lang === 'en' ? 'cust.' : 'عميل'}</span>
            </div>
          </div>

          {/* فرع وردانة - مربع صغير */}
          <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <MessageCircle size={14} className="text-tw-blue" />
              <h4 className="text-xs font-bold text-tw-navy">
                {lang === 'en' ? 'Wardana' : 'فرع وردانة'}
              </h4>
            </div>
            <label className="text-[10px] font-bold text-tw-muted mb-1 block leading-tight">
              {lang === 'en' ? 'Total historically' : 'إجمالي تاريخياً'}
            </label>
            <div className="flex items-center gap-1.5 bg-tw-soft/40 border border-tw-line rounded-xl p-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={wardanaBaseline}
                onChange={(e) => setWardanaBaseline(e.target.value)}
                className="flex-1 text-sm font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50 min-w-0"
                dir="ltr"
              />
              <span className="text-tw-muted/70 text-[10px] flex-shrink-0">{lang === 'en' ? 'cust.' : 'عميل'}</span>
            </div>
          </div>
        </div>

        <div className="tw-btn-row">
          <button
            type="button"
            className="tw-btn"
            onClick={handleSaveBaseline}
            disabled={savingBaseline || doneBaseline}
            style={{ flex: 1 }}
          >
            {savingBaseline && <Loader2 size={18} className="animate-spin inline-block ml-1" />}
            {doneBaseline
              ? (lang === 'en' ? 'Saved!' : 'تم الحفظ!')
              : savingBaseline
                ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
                : (lang === 'en' ? 'Save historical total' : 'حفظ الإجمالي التاريخي')}
          </button>
        </div>

        {error && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mt-3">
            {error}
          </p>
        )}
      </div>

      <BranchPickerSheet
        open={branchSheetOpen}
        branches={branches}
        currentBranchId={chosenBranch}
        onPick={(bid) => {
          setChosenBranch(bid);
          setBranchSheetOpen(false);
        }}
        onClose={() => setBranchSheetOpen(false)}
        lang={lang}
      />
      <DateSheet
        open={dateSheetOpen}
        currentDate={date}
        onPick={(d) => { setDate(d); setDateSheetOpen(false); }}
        onClose={() => setDateSheetOpen(false)}
        lang={lang}
      />

      <DeleteConfirmSheet
        open={!!deletingEntry}
        title={lang === 'en' ? 'Delete this entry?' : 'حذف هذا السجل؟'}
        message={lang === 'en' ? 'This action cannot be undone.' : 'لا يمكن التراجع عن هذا الإجراء.'}
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeletingEntry(null)}
        lang={lang}
      />
    </>
  );
}
