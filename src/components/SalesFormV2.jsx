// src/components/SalesFormV2.jsx
// ----------------------------------------------------------
// نموذج تسجيل/تعديل المبيعات — تصميم 1:1 مع الـ prototype (screen-addSale)
//
// Batch 12.6 — مطابق للبروتوتايب 100%:
//   - pill التاريخ يفتح DateSheet (اليوم/أمس/قبل يومين/مخصص) — مثل openSheet('date')
//   - pill الفرع يفتح BranchPickerSheet (للمدير)
//   - .tw-payment-row للـ 3 طرق دفع
//   - .tw-total-strip
//   - .tw-btn-row (إلغاء + حفظ)
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  Calendar, MapPin, Wallet, CreditCard, Send, CheckCircle2, Loader2, ChevronDown,
} from 'lucide-react';
import {
  addDailySales, updateDailySales, getPaymentMethods, getBranches,
  madaFees, madaNet, MADA_FEE_RATE,
} from '../firebase';
import { t, translatePM } from '../i18n';
import SarSymbol from './SarSymbol';
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
  // تنسيق التاريخ المخصص
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function SalesFormV2({
  setView,
  branch,
  branchId,
  lang = 'ar',
  allowBranchSwitch = false,
  onBranchChange,
  existingRecord = null,
  onBack, // Batch 38: callback للعودة — لو موجود، نستخدم header الموحّد
}) {
  const isEdit = !!existingRecord;
  
  // Batch 38: استخدام الـ header الموحّد (AppHeader) لمنع تكرار الزر والعنوان
  // - لو فيه onBack callback (لوحة المدير): نسجّل header مع العنوان + زر العودة الموحّد
  // - لو لا (الموظف القديم): نُسجّله بـ setView('employeeHome')
  const screenTitle = isEdit
    ? (lang === 'en' ? 'Edit sales' : 'تعديل المبيعات')
    : t(lang, 'sales.title');
  useScreenHeader(screenTitle, onBack || (() => setView && setView('employeeHome')));

  const [date, setDate] = useState(existingRecord?.date || todayStr());
  const [cash, setCash] = useState(existingRecord?.cash != null ? String(existingRecord.cash) : '');
  const [mada, setMada] = useState(existingRecord?.mada != null ? String(existingRecord.mada) : '');
  const [transfer, setTransfer] = useState(existingRecord?.transfer != null ? String(existingRecord.transfer) : '');
  const [methods, setMethods] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setMethods(await getPaymentMethods()); } catch { /* ignore */ }
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

  const saveBtnLabel = isEdit
    ? (lang === 'en' ? 'Save changes' : 'حفظ التعديلات')
    : t(lang, 'sales.save');

  return (
    <div className="tw-page-bg">
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* Batch 38: تم حذف الـ inline header — العنوان وزر العودة في AppHeader الموحّد */}

      <div className="relative z-10 p-4 pb-8">
        {/* Pills: التاريخ + الفرع — كلاهما يفتح bottom sheet */}
        <div className="tw-controls-row">
          <div
            className="tw-pill"
            onClick={() => setDateSheetOpen(true)}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer', flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDateSheetOpen(true); }
            }}
          >
            <Calendar size={14} />
            <span>{dateLabelFor(date, lang)}</span>
            <ChevronDown size={12} style={{ marginInlineStart: 'auto', opacity: 0.5 }} />
          </div>

          <div
            className="tw-pill"
            onClick={() => allowBranchSwitch && setBranchSheetOpen(true)}
            role={allowBranchSwitch ? 'button' : undefined}
            tabIndex={allowBranchSwitch ? 0 : undefined}
            style={{ cursor: allowBranchSwitch ? 'pointer' : 'default', flex: 1 }}
            onKeyDown={(e) => {
              if (allowBranchSwitch && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setBranchSheetOpen(true);
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
            <input type="number" inputMode="decimal" placeholder="0"
              value={cash} onChange={(e) => setCash(e.target.value)} dir="ltr" />
            <div className="unit">{t(lang, 'sales.currency')}</div>
          </div>

          <div className="tw-payment-row">
            <label>
              <CreditCard />
              <span>{labelFor('Mada', t(lang, 'sales.mada'))}</span>
            </label>
            <input type="number" inputMode="decimal" placeholder="0"
              value={mada} onChange={(e) => setMada(e.target.value)} dir="ltr" />
            <div className="unit">{t(lang, 'sales.currency')}</div>
          </div>

          <div className="tw-payment-row">
            <label>
              <Send />
              <span>{labelFor('Transfer', t(lang, 'sales.transfer'))}</span>
            </label>
            <input type="number" inputMode="decimal" placeholder="0"
              value={transfer} onChange={(e) => setTransfer(e.target.value)} dir="ltr" />
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
          <div className="mt-3 rounded-2xl p-4" style={{ background: '#FFF6E6', border: '1px solid #FFD980', fontSize: 12, fontWeight: 700 }}>
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
          <button onClick={() => setView('employeeHome')} className="tw-btn secondary" type="button" style={{ flex: 0.6 }}>
            {lang === 'en' ? 'Cancel' : 'إلغاء'}
          </button>
          <button onClick={handleSave} disabled={saving || done} className="tw-btn" type="button" style={{ flex: 1 }}>
            {saving && <Loader2 size={18} className="animate-spin inline-block ml-1" />}
            {saving ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...') : saveBtnLabel}
          </button>
        </div>
      </div>

      {/* DateSheet — يفتح من pill التاريخ */}
      <DateSheet
        open={dateSheetOpen}
        currentDate={date}
        onPick={(newDate) => setDate(newDate)}
        onClose={() => setDateSheetOpen(false)}
        lang={lang}
      />

      {/* BranchPickerSheet — للمدير فقط */}
      {allowBranchSwitch && (
        <BranchPickerSheet
          open={branchSheetOpen}
          branches={branches}
          currentBranchId={branchId}
          onPick={(id) => onBranchChange?.(id)}
          onClose={() => setBranchSheetOpen(false)}
          lang={lang}
        />
      )}
    </div>
  );
}
