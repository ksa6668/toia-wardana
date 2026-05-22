// src/components/SalesFormV2.jsx
// ----------------------------------------------------------
// نموذج تسجيل المبيعات — تصميم مطابق للـ prototype (screen-addSale)
//
// المنطق محفوظ كاملاً من النسخة القديمة:
//   - addDailySales من firebase.js
//   - حسبة Mada fees من firebase.js
//   - i18n
//
// التغييرات البصرية:
//   - خلفية radial gradient ناعمة
//   - pills للتاريخ والفرع (مثل prototype)
//   - كارت form-card بـ payment-row صفوف
//   - شريط total-strip (gradient navy)
//   - أزرار صف (إلغاء + حفظ)
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  Calendar, MapPin, Wallet, CreditCard, Send, CheckCircle2, Loader2, ChevronRight,
} from 'lucide-react';
import {
  addDailySales, getPaymentMethods, madaFees, madaNet, MADA_FEE_RATE,
} from '../firebase';
import { t, translatePM } from '../i18n';
import SarSymbol from './SarSymbol';

// اليوم بصيغة YYYY-MM-DD
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// صف دفع واحد (label + input + unit)
function PaymentRow({ icon: Icon, label, value, onChange, color = 'blue' }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-500 font-bold mb-0.5">{label}</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 text-xl font-bold text-slate-800 outline-none bg-transparent placeholder:text-gray-300"
            dir="ltr"
          />
          <SarSymbol className="text-slate-400 text-base" />
        </div>
      </div>
    </div>
  );
}

export default function SalesFormV2({ setView, branch, branchId, lang = 'ar' }) {
  const [date, setDate] = useState(todayStr());
  const [cash, setCash] = useState('');
  const [mada, setMada] = useState('');
  const [transfer, setTransfer] = useState('');
  const [methods, setMethods] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try { setMethods(await getPaymentMethods()); }
      catch { /* تسميات افتراضية */ }
    })();
  }, []);

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
      await addDailySales({ date, branchId, cash, mada, transfer });
      setDone(true);
      setTimeout(() => setView('employeeHome'), 1200);
    } catch (err) {
      setError(err?.message || t(lang, 'sales.err.save'));
      setSaving(false);
    }
  };

  // عرض التاريخ بصيغة قصيرة
  const dateLabel = date === todayStr()
    ? (lang === 'en' ? 'Today' : 'اليوم')
    : date;

  return (
    <div
      className="min-h-full relative overflow-hidden"
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
      <div className="relative z-10 flex items-center p-4 border-b border-gray-100 bg-white/60 backdrop-blur-sm">
        <button
          onClick={() => setView('employeeHome')}
          className="p-2 text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
        >
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-slate-800 px-8">
          {t(lang, 'sales.title')}
        </h2>
      </div>

      <div className="relative z-10 p-4 space-y-4 pb-8">
        {/* Pills: التاريخ + الفرع */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <div className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-2.5 px-3 shadow-sm">
              <Calendar size={14} className="text-blue-600" />
              <span className="font-bold text-xs text-slate-700">{dateLabel}</span>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-2.5 px-3 shadow-sm">
            <MapPin size={14} className="text-blue-600" />
            <span className="font-bold text-xs text-slate-700">
              {lang === 'en' ? branch : `فرع ${branch}`}
            </span>
          </div>
        </div>

        {/* كارت تفاصيل المبيعات */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h4 className="text-sm font-bold text-slate-800 mb-3">
            {lang === 'en'
              ? "Today's sales by payment method"
              : 'إجمالي مبيعات اليوم حسب طريقة الدفع'}
          </h4>
          <PaymentRow
            icon={Wallet}
            label={labelFor('Cash', t(lang, 'sales.cash'))}
            value={cash}
            onChange={setCash}
            color="emerald"
          />
          <PaymentRow
            icon={CreditCard}
            label={labelFor('Mada', t(lang, 'sales.mada'))}
            value={mada}
            onChange={setMada}
            color="amber"
          />
          <PaymentRow
            icon={Send}
            label={labelFor('Transfer', t(lang, 'sales.transfer'))}
            value={transfer}
            onChange={setTransfer}
            color="blue"
          />
        </div>

        {/* شريط الإجمالي - navy gradient */}
        <div
          className="text-white p-4 rounded-2xl flex items-center justify-between relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #082765 0%, #061742 60%, #1E3A8A 100%)',
            boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
          }}
        >
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
          />
          <small className="relative text-xs opacity-95 font-bold">
            {t(lang, 'sales.total')}
          </small>
          <b className="relative text-2xl font-extrabold flex items-center gap-1.5">
            {total.toLocaleString()} <SarSymbol className="text-lg" />
          </b>
        </div>

        {/* حسبة رسوم مدى — نفس المنطق القديم */}
        {Number(mada) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <p className="text-amber-900 font-bold text-xs flex items-center gap-1">
              💳 {t(lang, 'sales.madaFees')} ({(MADA_FEE_RATE * 100).toFixed(2)}%)
            </p>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-amber-800">{t(lang, 'sales.madaGross')}</span>
              <span className="font-mono text-amber-900">{Number(mada).toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-red-700">{t(lang, 'sales.madaFeesLine')}</span>
              <span className="font-mono text-red-700">{madaFeesAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-amber-200">
              <span className="text-emerald-800">{t(lang, 'sales.madaNet')}</span>
              <span className="font-mono text-emerald-800">{madaNetAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-amber-300">
              <span className="text-slate-900">{t(lang, 'sales.totalAfter')}</span>
              <span className="font-mono text-slate-900">{netTotal.toLocaleString()} <SarSymbol /></span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
            {error}
          </p>
        )}
        {done && (
          <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {t(lang, 'sales.saved')}
          </p>
        )}

        {/* أزرار الإجراءات - row */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setView('employeeHome')}
            className="flex-1 bg-white border border-gray-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {lang === 'en' ? 'Cancel' : 'إلغاء'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || done}
            className="flex-1 text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
              boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
            }}
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? t(lang, 'sales.saving') : t(lang, 'sales.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
