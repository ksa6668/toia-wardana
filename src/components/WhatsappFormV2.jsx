// src/components/WhatsappFormV2.jsx
// ----------------------------------------------------------
// Batch 46: نموذج تسجيل/تعديل عملاء واتساب اليومي
// تصميم مطابق لـ SalesFormV2 بدون رسوم/تحويل (حقول صحيحة فقط)
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  Calendar, MapPin, Users, UserPlus, ShoppingBag, CheckCircle2, Loader2, ChevronDown,
} from 'lucide-react';
import {
  addWhatsappEntry, updateWhatsappEntry, getBranches,
} from '../firebase';
import BranchPickerSheet from './BranchPickerSheet';
import DateSheet from './DateSheet';
import { useScreenHeader } from '../App';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLabelFor(dateStr, lang) {
  if (!dateStr) return '—';
  const T = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  const t2 = new Date(); t2.setDate(t2.getDate() - 2);
  const t2Str = `${t2.getFullYear()}-${String(t2.getMonth() + 1).padStart(2, '0')}-${String(t2.getDate()).padStart(2, '0')}`;
  if (dateStr === T) return lang === 'en' ? 'Today' : 'اليوم';
  if (dateStr === yStr) return lang === 'en' ? 'Yesterday' : 'أمس';
  if (dateStr === t2Str) return lang === 'en' ? '2 days ago' : 'قبل يومين';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function WhatsappFormV2({
  setView,
  branch,
  branchId,
  lang = 'ar',
  allowBranchSwitch = false,
  onBranchChange,
  existingRecord = null,
  onBack,
}) {
  const isEdit = !!existingRecord;
  const screenTitle = isEdit
    ? (lang === 'en' ? 'Edit WhatsApp Entry' : 'تعديل عملاء واتساب')
    : (lang === 'en' ? 'WhatsApp Customers' : 'عملاء واتساب');
  useScreenHeader(screenTitle, onBack || (() => setView && setView('employeeHome')));

  const [date, setDate] = useState(existingRecord?.date || todayStr());
  const [customers, setCustomers] = useState(existingRecord?.customers != null ? String(existingRecord.customers) : '');
  const [newCustomers, setNewCustomers] = useState(existingRecord?.newCustomers != null ? String(existingRecord.newCustomers) : '');
  const [buyers, setBuyers] = useState(existingRecord?.buyers != null ? String(existingRecord.buyers) : '');
  const [branches, setBranches] = useState([]);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getBranches()
      .then((bs) => { if (!cancelled) setBranches(bs); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    if (saving) return;
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
    setSaving(true);
    try {
      if (isEdit) {
        await updateWhatsappEntry(existingRecord.id, {
          date, branchId, customers: cN, newCustomers: nN, buyers: bN,
        });
      } else {
        await addWhatsappEntry({
          date, branchId, customers: cN, newCustomers: nN, buyers: bN,
        });
      }
      setDone(true);
      setTimeout(() => {
        setDone(false);
        if (setView) setView('employeeHome');
        else if (onBack) onBack();
      }, 1200);
    } catch (err) {
      setError(err?.message || (lang === 'en' ? 'Save failed' : 'تعذّر الحفظ'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="relative min-h-full px-4 pt-4 pb-8 overflow-hidden page-bg-soft"
        style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
      >
        <p className="text-center text-tw-muted text-xs mb-3">
          {lang === 'en'
            ? "Record today's WhatsApp customers and buyers"
            : 'تسجيل عملاء واتساب والمشترين لليوم'}
        </p>

        <div className="flex gap-2 mb-3">
          <div
            className="tw-pill"
            onClick={() => !isEdit && setDateSheetOpen(true)}
            role={!isEdit ? 'button' : undefined}
            tabIndex={!isEdit ? 0 : undefined}
            style={{ cursor: !isEdit ? 'pointer' : 'default', flex: 1 }}
          >
            <Calendar size={14} />
            <span>{dateLabelFor(date, lang)}</span>
            {!isEdit && <ChevronDown size={12} style={{ marginInlineStart: 'auto', opacity: 0.5 }} />}
          </div>

          <div
            className="tw-pill"
            onClick={() => allowBranchSwitch && setBranchSheetOpen(true)}
            role={allowBranchSwitch ? 'button' : undefined}
            tabIndex={allowBranchSwitch ? 0 : undefined}
            style={{ cursor: allowBranchSwitch ? 'pointer' : 'default', flex: 1 }}
          >
            <MapPin size={14} />
            <span>{lang === 'en' ? branch : `فرع ${branch}`}</span>
            {allowBranchSwitch && <ChevronDown size={12} style={{ marginInlineStart: 'auto', opacity: 0.5 }} />}
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

        {error && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mt-3">
            {error}
          </p>
        )}

        <div className="tw-btn-row mt-4">
          <button
            type="button"
            className="tw-btn-cancel"
            onClick={() => {
              if (setView) setView('employeeHome');
              else if (onBack) onBack();
            }}
            disabled={saving}
          >
            {lang === 'en' ? 'Cancel' : 'إلغاء'}
          </button>
          <button
            type="button"
            className="tw-btn-save"
            onClick={handleSave}
            disabled={saving || done}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : done ? <CheckCircle2 size={16} /> : null}
            <span>
              {done
                ? (lang === 'en' ? 'Saved!' : 'تم الحفظ!')
                : saving
                  ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
                  : (isEdit ? (lang === 'en' ? 'Update' : 'تعديل') : (lang === 'en' ? 'Save' : 'حفظ'))}
            </span>
          </button>
        </div>
      </div>

      <BranchPickerSheet
        open={branchSheetOpen}
        branches={branches}
        currentBranchId={branchId}
        onPick={(bid) => {
          if (onBranchChange) onBranchChange(bid);
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
    </>
  );
}
