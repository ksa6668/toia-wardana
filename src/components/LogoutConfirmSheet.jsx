import React from 'react';

// Bottom Sheet لتأكيد تسجيل الخروج — يطابق التصميم في prototype
// الاستخدام: <LogoutConfirmSheet onConfirm={...} onCancel={...} />

export default function LogoutConfirmSheet({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
      style={{ fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif' }}
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-3xl p-5 space-y-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        {/* مقبض السحب */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto"></div>

        {/* السؤال */}
        <h3 className="text-lg font-bold text-tw-navy text-center py-2">
          تسجيل الخروج؟
        </h3>

        {/* الأزرار: تأكيد بالأحمر + إلغاء بالأبيض */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onConfirm}
            className="flex-1 bg-tw-red hover:bg-tw-red text-white font-bold py-3.5 rounded-2xl transition-colors text-base"
          >
            تأكيد
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-white border border-tw-line hover:bg-tw-soft/40 text-tw-navy font-bold py-3.5 rounded-2xl transition-colors text-base"
          >
            إلغاء
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
