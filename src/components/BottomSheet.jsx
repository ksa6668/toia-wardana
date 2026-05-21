// src/components/BottomSheet.jsx
// ----------------------------------------------------------
// قائمة منبثقة من الأسفل — تستخدم في pickers (الشهر، السنة، الفرع).
// تصميم مطابق لـ openSheet() في الـ prototype.
//
// الاستخدام:
//   const [sheet, setSheet] = useState(null);
//   ...
//   <BottomSheet
//     open={!!sheet}
//     title={sheet?.title}
//     options={sheet?.options}
//     current={sheet?.current}
//     onPick={(value) => { ... ; setSheet(null); }}
//     onClose={() => setSheet(null)}
//   />
// ----------------------------------------------------------
export default function BottomSheet({ open, title, options = [], current, onPick, onClose }) {
  if (!open) return null;

  return (
    <>
      {/* خلفية شفافة قابلة للنقر للإغلاق */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.2s ease' }}
      />
      {/* اللوحة السفلية */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[70vh] overflow-y-auto"
        style={{
          animation: 'slideUp 0.25s ease',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.15)',
        }}
      >
        {/* مقبض السحب */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>
        {/* العنوان */}
        <div className="px-5 pb-3 border-b border-gray-100">
          <h3 className="font-bold text-base text-slate-800 text-center">{title}</h3>
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
                    ? 'bg-blue-50 border border-blue-300 text-blue-700 font-bold'
                    : 'hover:bg-gray-50 text-slate-700'
                }`}
              >
                <span>{label}</span>
                <span className="text-gray-400">›</span>
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
