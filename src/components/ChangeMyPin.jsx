// src/components/ChangeMyPin.jsx
// ----------------------------------------------------------
// شاشة تغيير رمز المدير لنفسه (تحقّق من الرمز الحالي ثم التحديث).
// مُستخرَجة من App.jsx.
// ----------------------------------------------------------
import { useState } from 'react';
import { Loader2, Key, CheckCircle2 } from 'lucide-react';
import { changeMyPin } from '../firebase';
import { useScreenHeader } from '../context/ScreenCtx';

export default function ChangeMyPin({ onBack }) {
  useScreenHeader('تغيير الرمز السري', onBack);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError(''); setDone(false);
    if (!/^\d{4}$/.test(currentPin)) { setError('الرمز الحالي يجب أن يكون 4 أرقام'); return; }
    if (!/^\d{4}$/.test(newPin)) { setError('الرمز الجديد يجب أن يكون 4 أرقام'); return; }
    if (newPin !== confirmPin) { setError('الرمز الجديد لا يطابق التأكيد'); return; }
    if (newPin === currentPin) { setError('الرمز الجديد يجب أن يختلف عن الحالي'); return; }
    setSaving(true);
    try {
      await changeMyPin(currentPin, newPin);
      setDone(true);
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setError('الرمز الحالي غير صحيح');
      } else if (code.includes('too-many-requests')) {
        setError('محاولات كثيرة، حاول بعد قليل');
      } else {
        setError(err?.message || 'تعذّر تغيير الرمز');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white pb-20">
      <div className="p-6 space-y-4 flex-1">
        <div className="bg-tw-soft border border-tw-line rounded-xl p-3 text-center">
          <Key size={20} className="text-tw-blue mx-auto mb-2" />
          <p className="text-tw-navy2 font-bold text-sm">تحديث الرمز السري لحسابك</p>
          <p className="text-tw-blue text-[11px] mt-1">سيتم التحقق من الرمز الحالي قبل التغيير</p>
        </div>

        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">الرمز الحالي</label>
          <input type="password" inputMode="numeric" maxLength={4} value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            className="w-full p-4 bg-tw-soft/40 border border-tw-line rounded-xl text-center tracking-[0.5em] font-mono text-lg outline-none focus:border-tw-blue" />
        </div>
        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">الرمز الجديد</label>
          <input type="password" inputMode="numeric" maxLength={4} value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            className="w-full p-4 bg-tw-soft/40 border border-tw-line rounded-xl text-center tracking-[0.5em] font-mono text-lg outline-none focus:border-tw-blue" />
        </div>
        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">تأكيد الرمز الجديد</label>
          <input type="password" inputMode="numeric" maxLength={4} value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            className="w-full p-4 bg-tw-soft/40 border border-tw-line rounded-xl text-center tracking-[0.5em] font-mono text-lg outline-none focus:border-tw-blue" />
        </div>

        {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم تغيير الرمز بنجاح
          </p>
        )}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-tw-blue text-white font-bold py-4 rounded-xl shadow-md hover:bg-tw-blue disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'جارٍ التحديث...' : 'حفظ الرمز الجديد'}
        </button>
      </div>
    </div>
  );
}
