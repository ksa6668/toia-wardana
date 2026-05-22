// src/components/EditSheet.jsx
// ----------------------------------------------------------
// Bottom Sheet modal كبير للنماذج الكاملة (تعديل المستخدم، تعديل الفرع، إلخ)
// يستخدم Portal للـ phone-frame عشان لا يتقص بـ overflow-hidden للمكوّن الأب
// ----------------------------------------------------------
import { useEffect } from 'react';
import SheetPortal from './SheetPortal';

export default function EditSheet({ open, onClose, title, children }) {
  // قفل التمرير في الخلفية عند الفتح
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <SheetPortal>
      {/* خلفية شفافة قابلة للنقر للإغلاق */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 55,
          animation: 'fadeInEdit 0.2s ease',
        }}
      />
      {/* اللوحة السفلية — كبيرة، لـ form كامل */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          zIndex: 60,
          maxHeight: '92%',
          overflowY: 'auto',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
          animation: 'slideUpEdit 0.28s ease',
          fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
          overscrollBehavior: 'contain',
        }}
      >
        {/* مقبض السحب */}
        <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-white z-10">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        {/* العنوان */}
        {title && (
          <div className="px-5 pb-3 sticky top-3 bg-white z-10">
            <h3 className="font-bold text-lg text-tw-navy text-center">{title}</h3>
          </div>
        )}
        {/* المحتوى */}
        <div className="px-5 pb-6 pt-2">
          {children}
        </div>
      </div>
      <style>{`
        @keyframes fadeInEdit { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpEdit { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </SheetPortal>
  );
}
