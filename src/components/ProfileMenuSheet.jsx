// src/components/ProfileMenuSheet.jsx
// Bottom Sheet لقائمة الحساب: تغيير الرمز السري + تسجيل الخروج
import { Key, LogOut } from 'lucide-react';
import SheetPortal from './SheetPortal';

export default function ProfileMenuSheet({ open, onClose, onChangePin, onLogout, userName = 'المدير' }) {
  if (!open) return null;

  return (
    <SheetPortal>
      <div className="tw-sheet-overlay show" onClick={onClose} />
      <div className="tw-sheet-panel show" role="dialog" aria-modal="true">
        <div className="tw-sheet-grab" />
        <h3>الحساب</h3>

        <p style={{
          fontSize: 12, color: 'var(--tw-muted)', textAlign: 'center',
          margin: '0 0 14px', fontWeight: 600,
        }}>
          مرحباً، {userName}
        </p>

        <div
          className="tw-sheet-opt"
          onClick={() => { onClose?.(); onChangePin?.(); }}
          role="button"
          tabIndex={0}
          style={{ display: 'grid', gridTemplateColumns: '36px 1fr 14px', gap: 12, alignItems: 'center' }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'var(--tw-soft)', color: 'var(--tw-blue)',
            display: 'grid', placeItems: 'center',
          }}>
            <Key size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--tw-navy)' }}>تغيير الرمز السري</div>
            <div style={{ fontSize: 11, color: 'var(--tw-muted)', fontWeight: 500, marginTop: 2 }}>تحديث رمزك أنت</div>
          </div>
          <span style={{ color: 'var(--tw-muted)', fontWeight: 700 }}>›</span>
        </div>

        <div
          className="tw-sheet-opt"
          onClick={() => { onClose?.(); onLogout?.(); }}
          role="button"
          tabIndex={0}
          style={{
            display: 'grid', gridTemplateColumns: '36px 1fr 14px', gap: 12,
            alignItems: 'center',
            borderColor: 'rgba(240,68,68,.2)',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'rgba(240,68,68,.1)', color: 'var(--tw-red)',
            display: 'grid', placeItems: 'center',
          }}>
            <LogOut size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--tw-red)' }}>تسجيل الخروج</div>
            <div style={{ fontSize: 11, color: 'var(--tw-muted)', fontWeight: 500, marginTop: 2 }}>إنهاء الجلسة الحالية</div>
          </div>
          <span style={{ color: 'var(--tw-muted)', fontWeight: 700 }}>›</span>
        </div>
      </div>
    </SheetPortal>
  );
}
