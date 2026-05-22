// src/components/BottomSheet.jsx
// ----------------------------------------------------------
// قائمة منبثقة من الأسفل — تستخدم في pickers (الشهر، السنة، الفرع).
// تصميم مطابق لـ openSheet() في الـ prototype.
//
// FIX (Batch 12.5):
//   - z-index رُفع: overlay z-90, panel z-100 (فوق Bottom Nav)
//   - padding-bottom للـ panel = safe-area + 22px ليبقى المحتوى مرئياً
//     ولا يختفي خلف Bottom Nav (64px)
// ----------------------------------------------------------
export default function BottomSheet({ open, title, options = [], current, onPick, onClose }) {
  if (!open) return null;

  return (
    <>
      {/* خلفية شفافة قابلة للنقر للإغلاق */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.2s ease', zIndex: 90 }}
      />
      {/* اللوحة السفلية */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto"
        style={{
          animation: 'slideUp 0.25s ease',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
          zIndex: 100,
          // padding-bottom = safe-area + 22px ليتجاوز Bottom Nav (64px) + هامش
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)',
          overscrollBehavior: 'contain',
        }}
      >
        {/* مقبض السحب */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>
        {/* العنوان */}
        <div className="px-5 pb-3 border-b border-tw-line">
          <h3 className="font-bold text-base text-tw-navy text-center">{title}</h3>
        </div>
        {/* الخيارات */}
        <div className="p-3 space-y-1">
          {options.map((opt) => {
            const value = typeof opt === 'object' ? opt.value : opt;
            const label = typeof opt === 'object' ? opt.label : opt;
            const isCurrent = value === current;
            return (
              <div
                key={value}
                onClick={() => onPick(value)}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                  isCurrent
                    ? 'bg-tw-soft border border-tw-blue/40 text-tw-blue font-bold'
                    : 'hover:bg-tw-soft/40 text-tw-navy'
                }`}
              >
                <span>{label}</span>
                <span className="text-tw-muted/70">›</span>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}
