// src/components/DeleteConfirmSheet.jsx
// ----------------------------------------------------------
// Bottom sheet لتأكيد حذف سجل (مبيعة أو مصروف)
// يستخدم نفس .tw-sheet-overlay و .tw-sheet-panel من index.css
// ----------------------------------------------------------
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

  // إعادة تعيين عند الإغلاق
  useEffect(() => {
    if (!open) setDeleting(false);
  }, [open]);

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
      <div
        className={`tw-sheet-overlay${open ? ' show' : ''}`}
        onClick={() => !deleting && onClose?.()}
        aria-hidden={!open}
      />
      <div className={`tw-sheet-panel${open ? ' show' : ''}`} role="alertdialog" aria-modal="true">
        <div className="tw-sheet-grab" />
        <div className="tw-confirm-dialog">
          <div className="icon">
            <Trash2 />
          </div>
          <h4>{title || defaultTitle}</h4>
          <p>{message || defaultMessage}</p>
          <div className="btns">
            <button
              type="button"
              className="cancel"
              onClick={onClose}
              disabled={deleting}
            >
              {lang === 'en' ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              type="button"
              className="delete"
              onClick={handleConfirm}
              disabled={deleting}
            >
              {deleting && <Loader2 size={14} className="animate-spin inline-block ml-1" />}
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
