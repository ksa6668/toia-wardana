// src/components/SalesFormV2.jsx
// ----------------------------------------------------------
// نموذج تسجيل/تعديل المبيعات — تصميم 1:1 مع الـ prototype (screen-addSale)
//
// المنطق المحفوظ:
//   - addDailySales / updateDailySales من firebase.js
//   - حسبة Mada fees (MADA_FEE_RATE, madaFees, madaNet)
//   - i18n
//
// التصميم (Batch 12):
//   - .tw-controls-row pills للتاريخ والفرع
//   - pill التاريخ يفتح date picker (مُصلَح في هذا الـ batch)
//   - pill الفرع قابل للنقر → bottom sheet (للمدير)
//   - .tw-form-card مع .tw-payment-row لكل طريقة دفع
//   - .tw-total-strip (gradient navy → blue)
//
// وضع التعديل:
//   - إذا existingRecord موجود → يعبّئ القيم القديمة + يحفظ بـ updateDailySales
//   - عنوان الشاشة يصير "تعديل المبيعات"
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  Calendar, MapPin, Wallet, CreditCard, Send, CheckCircle2, Loader2, ChevronRight, ChevronDown,
} from 'lucide-react';
import {
  addDailySales, updateDailySales, getPaymentMethods, getBranches,
  madaFees, madaNet, MADA_FEE_RATE,
} from '../firebase';
import { t, translatePM } from '../i18n';
import SarSymbol from './SarSymbol';
import BranchPickerSheet from './BranchPickerSheet';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SalesFormV2({
  setView,
  branch,
  branchId,
  lang = 'ar',
  allowBranchSwitch = false,
  onBranchChange,
  existingRecord = null,
}) {
  const isEdit = !!existingRecord;

  const [date, setDate] = useState(existingRecord?.date || todayStr());
  const [cash, setCash] = useState(existingRecord?.cash != null ? String(existingRecord.cash) : '');
  const [mada, setMada] = useState(existingRecord?.mada != null ? String(existingRecord.mada) : '');
  const [transfer, setTransfer] = useState(existingRecord?.transfer != null ? String(existingRecord.transfer) : '');
  const [methods, setMethods] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setMethods(await getPaymentMethods()); }
      catch { /* تسميات افتراضية */ }
    })();
  }, []);

  useEffect(() => {
    if (!allowBranchSwitch) return;
    (async () => {
      try { setBranches(await getBranches()); }
      catch {
        setBranches([{ id: 'toia', name: 'تويا' }, { id: 'wardana', name: 'وردانة' }]);
      }
    })();
  }, [allowBranchSwitch]);

  const labelFor = (id, fallback) => {
    const tr = translatePM(lang, id);
    if (tr && !tr.startsWith('pm.')) return tr;
    return methods.find((m) => m.id === id)?.labelAr || fallback;
  };

  const total = (Number(cash) || 0) + (Number(mada) || 0) + (Number(transfer) || 0);
  const madaFeesAmt = madaFees(mada);
  const madaNetAmt = madaNet(mada);
  const netTotal = (Number(cash) || 0) + madaNetAmt + (Number(transfer) || 0);

  const handleSave = async () => {
    setError('');
    if (total <= 0) { setError(t(lang, 'sales.err.amount')); return; }
    setSaving(true);
    try {
      if (isEdit) {
        await updateDailySales(existingRecord.id, { date, branchId, cash, mada, transfer });
      } else {
        await addDailySales({ date, branchId, cash, mada, transfer });
      }
      setDone(true);
      setTimeout(() => setView('employeeHome'), 1200);
    } catch (err) {
      setError(err?.message || t(lang, 'sales.err.save'));
      setSaving(false);
    }
  };

  const dateLabel = date === todayStr()
    ? (lang === 'en' ? 'Today' : 'اليوم')
    : date;

  const screenTitle = isEdit
    ? (lang === 'en' ? 'Edit sales' : 'تعديل المبيعات')
    : t(lang, 'sales.title');

  const saveBtnLabel = isEdit
    ? (lang === 'en' ? 'Save changes' : 'حفظ التعديلات')
    : t(lang, 'sales.save');

  return (
    <div className="tw-page-bg">
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button
          onClick={() => setView('employeeHome')}
          className="tw-circle-btn"
          type="button"
          aria-label="Back"
        >
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">
          {screenTitle}
        </h2>
        <div style={{ width: 36 }} />
      </div>

      <div className="relative z-10 p-4 pb-8">
        {/* Pills: التاريخ + الفرع — التاريخ مُصلَح */}
        <div className="tw-controls-row">
          {/* Pill التاريخ — label يحوي input فوقه opacity:0 */}
          <label className="tw-pill" style={{ position: 'relative', cursor: 'pointer', flex: 1 }}>
            <Calendar size={14} />
            <span>{dateLabel}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                border: 0,
                padding: 0,
                margin: 0,
              }}
              aria-label={lang === 'en' ? 'Select date' : 'اختر التاريخ'}
            />
          </label>

          {/* Pill الفرع */}
          <div
            className="tw-pill"
            onClick={() => allowBranchSwitch && setSheetOpen(true)}
            role={allowBranchSwitch ? 'button' : undefined}
            tabIndex={allowBranchSwitch ? 0 : undefined}
            style={{ cursor: allowBranchSwitch ? 'pointer' : 'default', flex: 1 }}
            onKeyDown={(e) => {
              if (allowBranchSwitch && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setSheetOpen(true);
              }
            }}
          >
            <MapPin size={14} />
            <span>{lang === 'en' ? branch : `فرع ${branch}`}</span>
            {allowBranchSwitch && (
              <ChevronDown size={12} style={{ marginInlineStart: 'auto', opacity: 0.5 }} />
            )}
          </div>
        </div>

        <div className="tw-form-card">
          <h4>
            {lang === 'en'
              ? "Today's sales by payment method"
              : 'إجمالي مبيعات اليوم حسب طريقة الدفع'}
          </h4>

          <div className="tw-payment-row">
            <label>
              <Wallet />
              <span>{labelFor('Cash', t(lang, 'sales.cash'))}</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              dir="ltr"
            />
            <div className="unit">{t(lang, 'sales.currency')}</div>
          </div>

          <div className="tw-payment-row">
            <label>
              <CreditCard />
              <span>{labelFor('Mada', t(lang, 'sales.mada'))}</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={mada}
              onChange={(e) => setMada(e.target.value)}
              dir="ltr"
            />
            <div className="unit">{t(lang, 'sales.currency')}</div>
          </div>

          <div className="tw-payment-row">
            <label>
              <Send />
              <span>{labelFor('Transfer', t(lang, 'sales.transfer'))}</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={transfer}
              onChange={(e) => setTransfer(e.target.value)}
              dir="ltr"
            />
            <div className="unit">{t(lang, 'sales.currency')}</div>
          </div>
        </div>

        <div className="tw-total-strip">
          <small>{t(lang, 'sales.total')}</small>
          <b>
            <span dir="ltr">{total.toLocaleString('en-US')}</span>
            <SarSymbol />
          </b>
        </div>

        {Number(mada) > 0 && (
          <div
            className="mt-3 rounded-2xl p-4"
            style={{
              background: '#FFF6E6',
              border: '1px solid #FFD980',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            <p className="text-amber-900 mb-2 flex items-center gap-1.5">
              💳 {t(lang, 'sales.madaFees')} ({(MADA_FEE_RATE * 100).toFixed(2)}%)
            </p>
            <div className="flex justify-between mb-1.5">
              <span style={{ color: '#7A5300' }}>{t(lang, 'sales.madaGross')}</span>
              <span className="font-num" style={{ color: '#7A5300' }} dir="ltr">
                {Number(mada).toLocaleString('en-US')} <SarSymbol />
              </span>
            </div>
            <div className="flex justify-between mb-1.5">
              <span className="text-tw-red">{t(lang, 'sales.madaFeesLine')}</span>
              <span className="text-tw-red font-num" dir="ltr">
                {madaFeesAmt.toLocaleString('en-US')} <SarSymbol />
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t" style={{ borderColor: '#FFD980' }}>
              <span className="text-tw-green">{t(lang, 'sales.madaNet')}</span>
              <span className="text-tw-green font-num" dir="ltr">
                {madaNetAmt.toLocaleString('en-US')} <SarSymbol />
              </span>
            </div>
            <div className="flex justify-between pt-2 mt-1.5 border-t" style={{ borderColor: '#FFD980' }}>
              <span className="text-tw-navy" style={{ fontSize: 13 }}>{t(lang, 'sales.totalAfter')}</span>
              <span className="text-tw-navy font-num" style={{ fontSize: 13 }} dir="ltr">
                {netTotal.toLocaleString('en-US')} <SarSymbol />
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mt-3">
            {error}
          </p>
        )}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center mt-3 flex items-center justify-center gap-2">
            <CheckCircle2 size={18} />
            {isEdit
              ? (lang === 'en' ? 'Updated successfully' : 'تم التعديل بنجاح')
              : t(lang, 'sales.saved')}
          </p>
        )}

        <div className="tw-btn-row" style={{ marginTop: 14 }}>
          <button
            onClick={() => setView('employeeHome')}
            className="tw-btn secondary"
            type="button"
            style={{ flex: 0.6 }}
          >
            {lang === 'en' ? 'Cancel' : 'إلغاء'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || done}
            className="tw-btn"
            type="button"
            style={{ flex: 1 }}
          >
            {saving && <Loader2 size={18} className="animate-spin inline-block ml-1" />}
            {saving
              ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
              : saveBtnLabel}
          </button>
        </div>
      </div>

      {allowBranchSwitch && (
        <BranchPickerSheet
          open={sheetOpen}
          branches={branches}
          currentBranchId={branchId}
          onPick={(id) => onBranchChange?.(id)}
          onClose={() => setSheetOpen(false)}
          lang={lang}
        />
      )}
    </div>
  );
}
