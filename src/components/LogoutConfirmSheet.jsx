// src/components/LogoutConfirmSheet.jsx
// Bottom Sheet لتأكيد تسجيل الخروج — يستخدم Portal
import SheetPortal from './SheetPortal';

export default function LogoutConfirmSheet({ onConfirm, onCancel }) {
  return (
    <SheetPortal>
      <div
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 60,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
          animation: 'fadeInLogout 0.2s ease',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff',
            width: '100%',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            animation: 'slideUpLogout 0.25s ease-out',
          }}
        >
          {/* مقبض السحب */}
          <div style={{ width: 48, height: 6, background: '#D6DEEB', borderRadius: 99, margin: '0 auto 14px' }} />

          {/* السؤال */}
          <h3 style={{
            fontSize: 18, fontWeight: 800, color: 'var(--tw-navy)',
            textAlign: 'center', margin: '0 0 18px',
          }}>
            تسجيل الخروج؟
          </h3>

          {/* الأزرار */}
          <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
            <button
              onClick={onConfirm}
              style={{
                flex: 1, padding: '14px',
                background: 'var(--tw-red)', color: '#fff',
                fontWeight: 800, fontSize: 15,
                borderRadius: 16, border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              تأكيد
            </button>
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: '14px',
                background: '#fff', color: 'var(--tw-navy)',
                fontWeight: 800, fontSize: 15,
                borderRadius: 16,
                border: '1.5px solid var(--tw-line)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeInLogout { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpLogout { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </SheetPortal>
  );
}
