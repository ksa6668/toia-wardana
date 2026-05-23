// src/components/ManagerNotifications.jsx
// ----------------------------------------------------------
// إعدادات التنبيهات والإشعارات — مطابقة لتصميم prototype:
//   - toggle: الإشعارات داخل التطبيق
//   - toggle: إشعارات النظام (خارج التطبيق) — placeholder حتى نضيف FCM
//   - زر إرسال إشعار تجريبي
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Bell, Loader2, AlertCircle } from 'lucide-react';
import { getAppSettings, setAppSettings } from '../firebase';
import { useScreenHeader } from '../App';

// مكون toggle مخصص بتصميم prototype
function ToggleSwitch({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`w-12 h-6 rounded-full relative transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${value ? 'bg-tw-green' : 'bg-gray-300'}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
          value ? 'right-0.5' : 'right-[26px]'
        }`}
      />
    </button>
  );
}

// صف إعداد واحد
function SettingRow({ title, desc, value, onChange, disabled }) {
  return (
    <div className={`p-4 bg-white rounded-2xl border border-tw-line shadow-sm flex items-center justify-between gap-3 ${
      disabled ? 'opacity-70' : ''
    }`}>
      <ToggleSwitch value={value} onChange={onChange} disabled={disabled} />
      <div className="flex-1 text-right min-w-0">
        <h5 className="text-sm font-bold text-tw-navy mb-0.5">{title}</h5>
        <p className="text-xs text-tw-muted truncate">{desc}</p>
      </div>
    </div>
  );
}

export default function ManagerNotifications({ onBack, lang = 'ar' }) {
  useScreenHeader(lang === 'en' ? 'Notifications' : 'التنبيهات والإشعارات', onBack);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifInApp, setNotifInApp] = useState(true);
  const [notifSystem, setNotifSystem] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getAppSettings();
        if (cancelled) return;
        setNotifInApp(s.notifInApp !== false); // افتراضياً true
        setNotifSystem(s.notifSystem === true); // افتراضياً false
      } catch {
        // تجاهل الخطأ — استخدم defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // حفظ تلقائي عند تغيير toggle
  const updateAndSave = async (changes) => {
    setSaving(true);
    setError('');
    try {
      const newSettings = {
        notifInApp: changes.notifInApp !== undefined ? changes.notifInApp : notifInApp,
        notifSystem: changes.notifSystem !== undefined ? changes.notifSystem : notifSystem,
      };
      if (changes.notifInApp !== undefined) setNotifInApp(changes.notifInApp);
      if (changes.notifSystem !== undefined) setNotifSystem(changes.notifSystem);
      await setAppSettings(newSettings);
    } catch (err) {
      setError(err?.message || 'تعذّر حفظ الإعداد');
    } finally {
      setSaving(false);
    }
  };

  const handleInAppToggle = (v) => updateAndSave({ notifInApp: v });

  const handleSystemToggle = (v) => {
    if (v) {
      // تفعيل إشعارات النظام يحتاج FCM + إذن المتصفح
      setInfo(
        lang === 'en'
          ? 'System notifications require FCM setup. Coming in a future update.'
          : 'إشعارات النظام تحتاج إعداد FCM. ستتوفر في تحديث قادم.'
      );
      setTimeout(() => setInfo(''), 4000);
      return;
    }
    updateAndSave({ notifSystem: v });
  };

  const handleTestNotification = () => {
    if (!notifInApp) {
      setError(
        lang === 'en'
          ? 'Enable in-app notifications first'
          : 'فعّل إشعارات داخل التطبيق أولاً'
      );
      setTimeout(() => setError(''), 3000);
      return;
    }
    // إشعار تجريبي داخل التطبيق - alert بسيط
    setInfo(
      lang === 'en'
        ? '🔔 Test notification: System is working correctly!'
        : '🔔 إشعار تجريبي: النظام يعمل بشكل صحيح!'
    );
    setTimeout(() => setInfo(''), 4000);
  };

  return (
    <div
      className="min-h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* وصف القسم */}
      <div className="relative z-10 px-4 pt-4 pb-2">
        <p className="text-xs text-tw-muted text-center">
          {lang === 'en'
            ? 'Enable and manage system and goal notifications'
            : 'تفعيل وإدارة تنبيهات النظام والأهداف'}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-tw-muted/70">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {!loading && (
        <div className="relative z-10 px-4 pb-8 space-y-4">
          {/* قسم إعدادات التنبيهات */}
          <div>
            <h4 className="text-sm font-bold text-tw-navy mb-1">
              {lang === 'en' ? 'Notification Settings' : 'إعدادات التنبيهات'}
            </h4>
            <p className="text-xs text-tw-muted mb-3">
              {lang === 'en'
                ? 'Control notifications that appear inside the app.'
                : 'تحكّم في الإشعارات التي تظهر داخل التطبيق.'}
            </p>

            <div className="space-y-3">
              <SettingRow
                title={lang === 'en' ? 'In-app notifications' : 'الإشعارات داخل التطبيق'}
                desc={lang === 'en'
                  ? 'Show goal, sales, and expense alerts'
                  : 'عرض تنبيهات الأهداف والمبيعات والمصاريف'}
                value={notifInApp}
                onChange={handleInAppToggle}
              />
              <SettingRow
                title={lang === 'en' ? 'System notifications' : 'إشعارات النظام'}
                desc={lang === 'en'
                  ? 'Notifications outside the app (requires permission)'
                  : 'إشعارات تظهر خارج التطبيق (يتطلب إذن)'}
                value={notifSystem}
                onChange={handleSystemToggle}
              />
            </div>
          </div>

          {/* الرسائل */}
          {info && (
            <p className="text-tw-blue text-sm font-bold bg-tw-soft border border-tw-line rounded-lg p-3 text-center flex items-center justify-center gap-2">
              <AlertCircle size={18} /> {info}
            </p>
          )}
          {error && (
            <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
              {error}
            </p>
          )}
          {saving && (
            <p className="text-xs text-tw-muted text-center flex items-center justify-center gap-2">
              <Loader2 size={12} className="animate-spin" /> {lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...'}
            </p>
          )}

          {/* فاصل */}
          <div className="border-t border-tw-line my-2" />

          {/* اختبار التنبيهات */}
          <div>
            <h4 className="text-sm font-bold text-tw-navy mb-1">
              {lang === 'en' ? 'Test Notifications' : 'اختبار التنبيهات'}
            </h4>
            <p className="text-xs text-tw-muted mb-3">
              {lang === 'en'
                ? 'Send a test notification to verify the system works.'
                : 'إرسال إشعار تجريبي للتأكد من عمل النظام.'}
            </p>
            <button
              onClick={handleTestNotification}
              className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #061742 0%, #082765 100%)',
                boxShadow: '0 6px 16px rgba(8, 39, 101, 0.25)',
              }}
            >
              <Bell size={16} />
              {lang === 'en' ? 'Send Test Notification' : 'إرسال إشعار تجريبي'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
