// src/components/AppHeader.jsx
// Header مطابق 100% لـ .phone-head في الـ prototype:
//   padding 8px 16px 12px, h3 15px/700, p 11px/500, circle-btn 36×36 radius:12
//   ترتيب DOM: notif+profile على اليمين في الـ HTML → في RTL يظهر يسار بصرياً
// ----------------------------------------------------------
export default function AppHeader({
  title = 'Toia & Wardana',
  subtitle,
  notifCount = 0,
  onProfileClick,
  onNotifClick,
  hideProfileGroup = false,
}) {
  return (
    <header className="tw-phone-head">
      {/* Spacer left — same width as right group for centered title */}
      <div style={{ width: hideProfileGroup ? '36px' : '88px', flexShrink: 0 }} />

      {/* Title centered */}
      <div style={{ flex: 1 }}>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {/* Notif + profile group — في DOM على اليمين، يقلبه RTL ليظهر يسار */}
      {!hideProfileGroup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Bell */}
          <button
            onClick={onNotifClick}
            className="tw-circle-btn"
            aria-label="Notifications"
            type="button"
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {notifCount > 0 && (
              <span className="tw-notif-badge">{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </button>

          {/* Profile */}
          <button
            onClick={onProfileClick}
            className="tw-circle-btn"
            aria-label="Profile"
            type="button"
          >
            <svg viewBox="0 0 24 24">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
}
