// src/components/BranchPickerSheet.jsx
// Bottom sheet لاختيار الفرع — يستخدم Portal للـ phone-frame
import { useEffect } from 'react';
import SheetPortal from './SheetPortal';

export default function BranchPickerSheet({
  open,
  branches = [],
  currentBranchId,
  onPick,
  onClose,
  lang = 'ar',
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const title = lang === 'en' ? 'Select branch' : 'اختر الفرع';

  return (
    <SheetPortal>
      <div className="tw-sheet-overlay show" onClick={onClose} />
      <div className="tw-sheet-panel show" role="dialog" aria-modal="true">
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
    </SheetPortal>
  );
}
