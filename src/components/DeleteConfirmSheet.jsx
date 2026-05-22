// src/components/DeleteConfirmSheet.jsx
// Bottom sheet لتأكيد حذف سجل — يستخدم .tw-sheet-* (absolute, prototype-style)
import { useState, useEffect } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeleteConfirmSheet({
  open,
  title,
  message,
  onConfirm,
  onClose,
  lang = 'ar',
}) {
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape' && !deleting) onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, deleting]);

  useEffect(() => { if (!open) setDeleting(false); }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm?.();
      onClose?.();
    } catch {
      setDeleting(false);
    }
  };

  const defaultTitle = lang === 'en' ? 'Delete this record?' : 'حذف هذا السجل؟';
  const defaultMessage = lang === 'en'
    ? 'This action cannot be undone.'
    : 'لا يمكن التراجع عن هذا الإجراء.';

  return (
    <>
      <div className="tw-sheet-overlay show" onClick={() => !deleting && onClose?.()} />
      <div className="tw-sheet-panel show" role="alertdialog" aria-modal="true">
        <div className="tw-sheet-grab" />
        <div style={{ padding: '14px 0' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(240,68,68,.12)', color: 'var(--tw-red)',
            display: 'grid', placeItems: 'center', margin: '0 auto 14px',
          }}>
            <Trash2 size={28} />
          </div>
          <h4 style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--tw-navy)', margin: '0 0 6px' }}>
            {title || defaultTitle}
          </h4>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--tw-muted)', margin: '0 0 18px', fontWeight: 500 }}>
            {message || defaultMessage}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
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
              disabled={deleting}
              style={{
                flex: 1, padding: 12, borderRadius: 12,
                fontWeight: 800, fontSize: 13, cursor: deleting ? 'not-allowed' : 'pointer',
                background: 'var(--tw-red)', color: '#fff', border: 'none',
                opacity: deleting ? 0.6 : 1, fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              {deleting
                ? (lang === 'en' ? 'Deleting…' : 'جارٍ الحذف…')
                : (lang === 'en' ? 'Delete' : 'حذف')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
