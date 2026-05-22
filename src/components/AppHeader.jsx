// src/components/AppHeader.jsx
// ----------------------------------------------------------
// Header موحّد يطابق تصميم prototype:
//   - خلفية بيضاء، نص navy
//   - زر بروفايل دائري + جرس بنقطة حمراء على اليسار (RTL)
//   - عنوان مع subtitle في الوسط
//   - زر تنقّل اختياري على اليمين
// ----------------------------------------------------------
import { User, Bell, ChevronRight, ChevronLeft } from 'lucide-react';

export default function AppHeader({
  title = 'Toia & Wardana',
  subtitle,
  notifCount = 0,
  onProfileClick,
  onNotifClick,
  onNavRight,         // اختياري: للأمام
  onNavLeft,          // اختياري: للخلف
  hideProfileGroup = false,
  rtl = true,
}) {
  return (
    <header
      className="relative bg-white border-b border-tw-line"
      style={{ fontFamily: "'Almarai', 'IBM Plex Sans Arabic', sans-serif" }}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* مجموعة على اليسار (في RTL تظهر يسار) — profile + notif */}
        {!hideProfileGroup && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* زر البروفايل */}
            <button
              onClick={onProfileClick}
              className="w-11 h-11 rounded-full bg-white border border-tw-line grid place-items-center text-tw-navy2 hover:bg-tw-soft active:scale-[0.92] transition-all"
              aria-label="Profile"
            >
              <User size={18} strokeWidth={2.2} />
            </button>
            {/* زر الجرس مع badge */}
            <button
              onClick={onNotifClick}
              className="relative w-11 h-11 rounded-full bg-white border border-tw-line grid place-items-center text-tw-navy2 hover:bg-tw-soft active:scale-[0.92] transition-all"
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={2.2} />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-tw-red text-white text-[10px] font-extrabold grid place-items-center border-2 border-white">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* العنوان في الوسط */}
        <div className="flex-1 text-center">
          <h1 className="text-[15px] font-extrabold text-tw-navy leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-tw-muted font-medium mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* زر التنقّل على اليمين (في RTL يظهر يمين) */}
        <div className="flex-shrink-0">
          {onNavRight ? (
            <button
              onClick={onNavRight}
              className="w-11 h-11 rounded-full bg-white border border-tw-line grid place-items-center text-tw-navy2 hover:bg-tw-soft active:scale-[0.92] transition-all"
              aria-label="Next"
            >
              {rtl ? <ChevronLeft size={20} strokeWidth={2.4} /> : <ChevronRight size={20} strokeWidth={2.4} />}
            </button>
          ) : onNavLeft ? (
            <button
              onClick={onNavLeft}
              className="w-11 h-11 rounded-full bg-white border border-tw-line grid place-items-center text-tw-navy2 hover:bg-tw-soft active:scale-[0.92] transition-all"
              aria-label="Back"
            >
              {rtl ? <ChevronRight size={20} strokeWidth={2.4} /> : <ChevronLeft size={20} strokeWidth={2.4} />}
            </button>
          ) : (
            // مساحة فارغة لمحاذاة العنوان
            <div className="w-11 h-11" />
          )}
        </div>
      </div>
    </header>
  );
}
