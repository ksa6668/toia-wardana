// src/components/AppHeader.jsx
// ----------------------------------------------------------
// Header مع 3 أوضاع:
// 1) home mode (admin/employee الرئيسية): "Toia & Wardana" + رسالة الترحيب
// 2) screen mode (باقي الشاشات): "اسم الشاشة" + "Toia & Wardana" تحته بنفس مقاسات
// 3) hideProfileGroup (شاشات الدخول): العنوان فقط
//
// زر العودة (screen mode): أقصى يمين الشاشة (RTL) — مكان langButton
// langButton: يمين الشاشة لشاشة الموظف الرئيسية فقط
// notif+profile: يسار الشاشة (RTL) — للمدير
// ----------------------------------------------------------
import { ChevronRight } from 'lucide-react';

const APP_NAME = 'Toia & Wardana';

export default function AppHeader({
  mode = 'home',
  screenTitle,
  greeting,
  onBack,
  notifCount = 0,
  onProfileClick,
  onNotifClick,
  hideProfileGroup = false,
  langButton = null,
}) {
  const rightGroupWidth = hideProfileGroup ? '36px' : '88px';
  const leftSlotWidth = (onBack || langButton) ? '36px' : rightGroupWidth;

  return (
    <header className="tw-phone-head">
      <div style={{ width: leftSlotWidth, flexShrink: 0, display: 'flex', justifyContent: 'flex-start' }}>
        {onBack ? (
          <button onClick={onBack} className="tw-circle-btn" aria-label="رجوع" type="button">
            <ChevronRight size={18} strokeWidth={2} style={{ transform: 'scaleX(-1)' }} />
          </button>
        ) : langButton}
      </div>

      <div style={{ flex: 1, textAlign: 'center' }}>
        {mode === 'home' || mode === 'login' ? (
          <>
            <h3>{APP_NAME}</h3>
            {greeting && <p>{greeting}</p>}
          </>
        ) : (
          <>
            <h3>{screenTitle || APP_NAME}</h3>
            <p style={{ fontWeight: 600, color: 'var(--tw-muted)' }}>{APP_NAME}</p>
          </>
        )}
      </div>

      {!hideProfileGroup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button onClick={onNotifClick} className="tw-circle-btn" aria-label="Notifications" type="button">
            <svg viewBox="0 0 24 24">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {notifCount > 0 && (
              <span className="tw-notif-badge">{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </button>
          <button onClick={onProfileClick} className="tw-circle-btn" aria-label="Profile" type="button">
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
