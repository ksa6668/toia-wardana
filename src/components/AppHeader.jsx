// src/components/AppHeader.jsx
// Header مطابق لـ .phone-head في الـ prototype:
//   - notif+profile في DOM على اليمين → في RTL يظهر يسار بصرياً
//   - langButton (Batch 17) في DOM على اليسار → في RTL يظهر يمين بصرياً (الجهة العكسية للتنبيهات والمستخدم)
// ----------------------------------------------------------
export default function AppHeader({
  title = 'Toia & Wardana',
  subtitle,
  notifCount = 0,
  onProfileClick,
  onNotifClick,
  hideProfileGroup = false,
  langButton = null, // عنصر React اختياري — يُعرض في الجهة العكسية للتنبيهات (للموظف)
}) {
  // عرض المجموعة اليمنى من DOM (تظهر يسار في RTL)
  const rightWidth = hideProfileGroup ? '36px' : '88px';
  // العرض اليسرى من DOM (تظهر يمين في RTL) — إذا langButton موجود نحجز نفس العرض، وإلا 0
  const leftWidth = langButton ? '36px' : rightWidth;

  return (
    <header className="tw-phone-head">
      {/* Left in DOM = Right in RTL — مكان زر اللغة للموظف */}
      <div style={{ width: leftWidth, flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
        {langButton}
      </div>

      {/* Title centered */}
      <div style={{ flex: 1 }}>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {/* Right in DOM = Left in RTL — مجموعة التنبيهات والمستخدم */}
      {!hideProfileGroup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
