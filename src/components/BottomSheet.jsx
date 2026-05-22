// src/components/BottomSheet.jsx
// ----------------------------------------------------------
// قائمة منبثقة من الأسفل — مطابقة لـ openSheet() في الـ prototype.
//
// تصميم البروتوتايب 1:1:
//   .sheet-bg → position:absolute; inset:0; z-index:30; rgba(6,23,66,.55)
//   .sheet    → position:absolute; bottom:0; z-index:31; border-radius:24px 24px 0 0
//                padding:18px 18px 26px; max-height:80%; overflow-y:auto
//
// يستخدم Portal للـ phone-frame عشان يطلع فوق Bottom Nav
// ولا يتأثر بـ overflow-hidden للمكوّن الأب.
// ----------------------------------------------------------
import { useEffect } from 'react';
import SheetPortal from './SheetPortal';

export default function BottomSheet({ open, title, options = [], current, onPick, onClose }) {
  // إغلاق بـ Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <SheetPortal>
      {/* Overlay (sheet-bg) */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(6, 23, 66, 0.55)',
          zIndex: 50,
          animation: 'twSheetFadeIn 0.2s ease',
        }}
      />
      {/* Panel (sheet) */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          padding: '18px 18px 26px',
          zIndex: 51,
          maxHeight: '80%',
          overflowY: 'auto',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
          animation: 'twSheetSlideUp 0.25s ease',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Grab handle */}
        <div style={{ width: 40, height: 4, background: '#D6DEEB', borderRadius: 99, margin: '0 auto 12px' }} />

        {/* Title */}
        <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, textAlign: 'center', color: 'var(--tw-navy)' }}>
          {title}
        </h3>

        {/* Options */}
        <div>
          {options.map((opt) => {
            const value = typeof opt === 'object' ? opt.value : opt;
            const label = typeof opt === 'object' ? opt.label : opt;
            const isCurrent = value === current;
            return (
              <div
                key={value}
                onClick={() => onPick(value)}
                style={{
                  padding: 14,
                  border: '1.5px solid',
                  borderColor: isCurrent ? 'var(--tw-blue)' : 'var(--tw-line)',
                  borderRadius: 12,
                  marginBottom: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: isCurrent ? 'var(--tw-blue)' : 'var(--tw-navy)',
                  background: isCurrent ? 'var(--tw-soft)' : '#fff',
                  transition: 'background .15s, border-color .15s',
                }}
              >
                <span>{label}</span>
                <span style={{ color: isCurrent ? 'var(--tw-blue)' : 'var(--tw-muted)', opacity: 0.7 }}>
                  {isCurrent ? '✓' : '›'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes twSheetFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes twSheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </SheetPortal>
  );
}
