// src/components/BranchPickerSheet.jsx
// ----------------------------------------------------------
// Bottom sheet لاختيار الفرع — مطابق للـ prototype (.tw-sheet-panel)
//
// الاستخدام:
//   const [open, setOpen] = useState(false);
//   <BranchPickerSheet
//     open={open}
//     branches={branches}             // [{id, name}, ...]
//     currentBranchId={branchId}
//     onPick={(id) => setBranchId(id)}
//     onClose={() => setOpen(false)}
//     lang="ar"
//   />
// ----------------------------------------------------------
import { useEffect } from 'react';

export default function BranchPickerSheet({
  open,
  branches = [],
  currentBranchId,
  onPick,
  onClose,
  lang = 'ar',
}) {
  // إغلاق بـ Escape (مفيد على الديسكتوب)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const title = lang === 'en' ? 'Select branch' : 'اختر الفرع';

  return (
    <>
      <div
        className={`tw-sheet-overlay${open ? ' show' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div className={`tw-sheet-panel${open ? ' show' : ''}`} role="dialog" aria-modal="true">
        <div className="tw-sheet-grab" />
        <h3>{title}</h3>
        {branches.map((b) => {
          const isActive = b.id === currentBranchId;
          const displayName = lang === 'en'
            ? (b.nameEn || b.name)
            : `فرع ${b.name}`;
          return (
            <div
              key={b.id}
              className={`tw-sheet-opt${isActive ? ' active' : ''}`}
              onClick={() => { onPick?.(b.id); onClose?.(); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onPick?.(b.id); onClose?.();
                }
              }}
            >
              <span>{displayName}</span>
              <span style={{ color: 'var(--tw-muted)' }}>{isActive ? '✓' : '›'}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
