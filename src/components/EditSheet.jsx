// src/components/EditSheet.jsx
// ----------------------------------------------------------
// Bottom Sheet modal للنماذج الكاملة (تعديل المستخدم، تعديل الفرع، إلخ)
// أكبر من BottomSheet العادي ويدعم scroll داخلي.
//
// الاستخدام:
//   <EditSheet open={!!editing} onClose={() => setEditing(null)} title="تعديل المستخدم">
//     <form ...>...</form>
//   </EditSheet>
// ----------------------------------------------------------
import React, { useEffect } from 'react';

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
    <>
      {/* خلفية شفافة قابلة للنقر للإغلاق */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-[55] backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.2s ease' }}
      />
      {/* اللوحة السفلية - أكبر، لـ form كامل */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[60] max-h-[92vh] overflow-y-auto md:max-w-md md:left-1/2 md:-translate-x-1/2"
        style={{
          animation: 'slideUpSheet 0.28s ease',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
          fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
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
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpSheet { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}
