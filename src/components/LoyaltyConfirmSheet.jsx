// src/components/LoyaltyConfirmSheet.jsx
// Bottom sheet تأكيد لعمليات الولاء (استبدال / عكس حركة) — على نمط
// DeleteConfirmSheet، مع دعم حقل سبب إلزامي اختياري (requireReason).
import { useState, useEffect } from 'react';
import { Gift, Undo2, Loader2 } from 'lucide-react';
import SheetPortal from './SheetPortal';
import { toLatinDigits } from '../utils/digits';

export default function LoyaltyConfirmSheet({
  open,
  variant = 'redeem',      // 'redeem' | 'reverse'
  title,
  message,
  confirmLabel,
  requireReason = false,   // عكس/تسوية: سبب إلزامي
  optionalReason = false,  // Batch 92.1: حقل السبب ظاهر ويُحفظ إن كُتب — بلا منع
  confirmText = '',        // المرحلة 5: تأكيد مزدوج — زر التأكيد معطّل
                           // حتى يُكتب هذا النص حرفياً (مثل رقم العضوية)
  onConfirm,               // async (reason) => void
  onClose,
  lang = 'ar',
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');

  // الإغلاق يعيد ضبط الحالة الداخلية — حتى تُفتح الـ sheet نظيفة في المرة التالية
  const close = () => {
    setBusy(false);
    setReason('');
    setTyped('');
    setError('');
    onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape' && !busy) close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // close تُعاد كل render — نكتفي بـ open/busy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  if (!open) return null;

  const isReverse = variant === 'reverse';
  const Icon = isReverse ? Undo2 : Gift;
  const color = isReverse ? 'var(--tw-red)' : 'var(--color-tw-blue, #005BFF)';
  const bg = isReverse ? 'rgba(240,68,68,.12)' : 'rgba(0,91,255,.12)';

  const confirmTextOk = !confirmText
    || typed.trim().toUpperCase() === String(confirmText).trim().toUpperCase();

  const handleConfirm = async () => {
    if (!confirmTextOk) return; // الزر معطّل أصلاً — حارس إضافي
    if (requireReason && !reason.trim()) {
      setError(lang === 'en' ? 'Reason is required' : 'السبب إلزامي');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // النص المكتوب يُمرَّر للمستدعي — التحقق الخادمي يستقبل ما كتبه
      // المدير فعلاً لا قيمة مبرمجة (تأكيد مزدوج حقيقي)
      await onConfirm?.(reason.trim(), typed.trim());
      close();
    } catch (err) {
      setError(err?.message || (lang === 'en' ? 'Operation failed' : 'تعذّر تنفيذ العملية'));
      setBusy(false);
    }
  };

  return (
    <SheetPortal>
      <div className="tw-sheet-overlay show" onClick={() => !busy && close()} />
      <div className="tw-sheet-panel show" role="alertdialog" aria-modal="true">
        <div className="tw-sheet-grab" />
        <div style={{ padding: '14px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: bg, color,
            display: 'grid', placeItems: 'center', margin: '0 auto 14px',
          }}>
            <Icon size={28} />
          </div>
          <h4 style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--tw-navy)', margin: '0 0 6px' }}>
            {title}
          </h4>
          {message && (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--tw-muted)', margin: '0 0 14px', fontWeight: 500, whiteSpace: 'pre-line' }}>
              {message}
            </p>
          )}
          {confirmText && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--tw-muted)', marginBottom: 6, textAlign: 'center' }}>
                {lang === 'en'
                  ? <>Type <b dir="ltr">{confirmText}</b> to confirm</>
                  : <>اكتب <b dir="ltr">{confirmText}</b> للتأكيد</>}
              </p>
              <input
                type="text"
                dir="ltr"
                value={typed}
                onChange={(e) => setTyped(toLatinDigits(e.target.value))}
                disabled={busy}
                className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue text-center font-mono"
                style={{ fontFamily: 'inherit' }}
              />
            </div>
          )}
          {(requireReason || optionalReason) && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={requireReason
                ? (lang === 'en' ? 'Reason (required)...' : 'السبب (إلزامي)...')
                : (lang === 'en' ? 'Reason (optional)...' : 'السبب (اختياري)...')}
              rows={2}
              disabled={busy}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue mb-3"
              style={{ fontFamily: 'inherit', resize: 'none' }}
            />
          )}
          {error && (
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--tw-red)', fontWeight: 700, margin: '0 0 10px' }}>
              {error}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              style={{
                flex: 1, padding: 12, borderRadius: 12,
                fontWeight: 800, fontSize: 13, cursor: 'pointer',
                background: '#fff', border: '1.5px solid var(--tw-line)',
                color: 'var(--tw-navy)', fontFamily: 'inherit',
              }}
            >
              {lang === 'en' ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || !confirmTextOk}
              style={{
                flex: 1, padding: 12, borderRadius: 12,
                fontWeight: 800, fontSize: 13, cursor: (busy || !confirmTextOk) ? 'not-allowed' : 'pointer',
                background: color, color: '#fff', border: 'none',
                opacity: (busy || !confirmTextOk) ? 0.5 : 1, fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              {busy
                ? (lang === 'en' ? 'Working…' : 'جارٍ التنفيذ…')
                : (confirmLabel || (lang === 'en' ? 'Confirm' : 'تأكيد'))}
            </button>
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
