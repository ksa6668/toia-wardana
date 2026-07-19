import { useState, useEffect } from 'react';
import { ChevronRight, Bell, Loader2, X } from 'lucide-react';

// مركز الإشعارات — يعرض الإشعارات الحديثة من localStorage + إشعارات النظام التلقائية
// التصميم مطابق للـ prototype: قائمة بطاقات مع X للحذف + "تعليم الكل" + "مسح الكل"

const NOTIFS_KEY = 'tw_notifications_v1';
const WELCOME_SESSION_KEY = 'tw_welcome_shown_session'; // Batch 35: علم الجلسة الحالية

// قراءة الإشعارات المحفوظة محلياً
function readStoredNotifs() {
  try {
    const raw = localStorage.getItem(NOTIFS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveStoredNotifs(arr) {
  try {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

// Batch 35: تُحسب عدد الإشعارات غير المقروءة — يستخدمه الـ bell badge
export function getUnreadCount() {
  const list = readStoredNotifs();
  return list.filter((n) => !n.read).length;
}

// Helper: إضافة إشعار جديد (يُستدعى من خارج المكون)
export function addNotification({ title, body, emoji = '🔔', type = 'info' }) {
  const list = readStoredNotifs();
  const newNotif = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title,
    body,
    emoji,
    type,
    read: false,
    createdAt: new Date().toISOString(),
  };
  // أحدث أولاً، ونحتفظ بآخر 50 فقط
  const updated = [newNotif, ...list].slice(0, 50);
  saveStoredNotifs(updated);
}

// تنسيق التاريخ النسبي — Batch 83: يدعم اللغتين
function formatRelative(iso, lang = 'ar') {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000; // ثواني

    if (diff < 60) return lang === 'en' ? 'Now' : 'الآن';
    if (diff < 3600) return lang === 'en' ? `${Math.floor(diff / 60)} min` : `${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) {
      const hours = d.getHours();
      const mins = d.getMinutes();
      const period = hours >= 12 ? (lang === 'en' ? 'PM' : 'م') : (lang === 'en' ? 'AM' : 'ص');
      const h12 = hours % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${period}`;
    }
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-SA');
  } catch {
    return '';
  }
}

// تجميع الإشعارات حسب اليوم
function groupByDay(notifs) {
  // Batch 46.10: التاريخ المحلي (وليس UTC)
  const localDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const today = localDate(new Date());
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return localDate(d);
  })();

  // Batch 83: مفاتيح محايدة — التسمية المعروضة تُترجم عند العرض حسب اللغة
  const groups = { today: [], yesterday: [], older: [] };
  for (const n of notifs) {
    // n.createdAt هو ISO UTC string - نحوّله لـ Date محلي ثم نأخذ التاريخ المحلي
    const day = n.createdAt ? localDate(new Date(n.createdAt)) : '';
    if (day === today) groups.today.push(n);
    else if (day === yesterday) groups.yesterday.push(n);
    else groups.older.push(n);
  }
  return groups;
}

// تسميات مجموعات الأيام (Batch 83)
const GROUP_LABELS = {
  today:     { ar: 'اليوم', en: 'Today' },
  yesterday: { ar: 'أمس',   en: 'Yesterday' },
  older:     { ar: 'أقدم',  en: 'Older' },
};

export default function NotificationsCenter({ onBack, userName = 'أحمد', lang = 'ar' }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Batch 35: إشعار الترحيب يظهر مرة واحدة فقط لكل جلسة (sessionStorage يُمسح عند إغلاق التبويب)
    // هذا يمنع تكرار الترحيب كلما تمسح الإشعارات وتعود.
    let initial = readStoredNotifs();
    const welcomeShown = sessionStorage.getItem(WELCOME_SESSION_KEY) === '1';
    if (initial.length === 0 && !welcomeShown) {
      addNotification({
        title: 'مرحباً بعودتك',
        body: `أهلاً ${userName}، نتمنى لك يوماً موفقاً`,
        emoji: '👋',
        type: 'welcome',
      });
      sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
      initial = readStoredNotifs();
    }
    // Batch 35: عند فتح الشاشة، نُعلّم الكل كمقروء تلقائياً (لتختفي علامة العدد)
    const allRead = initial.map((n) => ({ ...n, read: true }));
    saveStoredNotifs(allRead);
    setNotifs(allRead);
    // إخطار المكوّن الأب أن العدد تغيّر
    window.dispatchEvent(new Event('tw-notifs-changed'));
    setLoading(false);
  }, [userName]);

  const dismissOne = (id) => {
    const updated = notifs.filter((n) => n.id !== id);
    setNotifs(updated);
    saveStoredNotifs(updated);
    window.dispatchEvent(new Event('tw-notifs-changed'));
  };

  const markAllRead = () => {
    const updated = notifs.map((n) => ({ ...n, read: true }));
    setNotifs(updated);
    saveStoredNotifs(updated);
    window.dispatchEvent(new Event('tw-notifs-changed'));
  };

  const clearAll = () => {
    if (!confirm(lang === 'en' ? 'Clear all notifications?' : 'مسح جميع الإشعارات؟')) return;
    setNotifs([]);
    saveStoredNotifs([]);
    window.dispatchEvent(new Event('tw-notifs-changed'));
  };

  const groups = groupByDay(notifs);

  return (
    <div
      className="min-h-full relative overflow-hidden pb-20"
      style={{
        background: 'var(--color-page-background)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >

      {/* شريط العنوان */}
      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button onClick={onBack} className="p-2 text-tw-muted bg-tw-soft rounded-full hover:bg-slate-200 transition-colors">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="flex-1 text-center px-8">
          <h2 className="text-lg font-bold text-tw-navy">{lang === 'en' ? 'Notifications' : 'الإشعارات'}</h2>
          <p className="text-xs text-tw-muted/70 mt-0.5">{lang === 'en' ? 'All alerts and reminders' : 'كل التنبيهات والتذكيرات'}</p>
        </div>
      </div>

      {/* شريط الإجراءات: تعليم الكل + مسح الكل */}
      {notifs.length > 0 && (
        <div className="relative z-10 px-4 pt-4 flex items-center justify-between">
          <button
            onClick={clearAll}
            className="text-tw-red font-bold text-sm hover:underline"
          >
            {lang === 'en' ? 'Clear all' : 'مسح الكل'}
          </button>
          <button
            onClick={markAllRead}
            className="text-tw-blue font-bold text-sm hover:underline"
          >
            {lang === 'en' ? 'Mark all as read' : 'تعليم الكل كمقروء'}
          </button>
        </div>
      )}

      <div className="relative z-10 p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-tw-muted/50" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto rounded-full bg-tw-soft flex items-center justify-center mb-4">
              <Bell size={32} className="text-blue-300" />
            </div>
            <p className="text-tw-muted font-bold">{lang === 'en' ? 'No notifications yet' : 'لا توجد إشعارات حالياً'}</p>
            <p className="text-tw-muted/70 text-xs mt-1">{lang === 'en' ? 'Alerts and reminders will appear here' : 'سيظهر هنا أي تنبيه أو تذكير'}</p>
          </div>
        ) : (
          Object.entries(groups).map(([groupKey, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={groupKey} className="space-y-3">
                <h3 className={`text-sm font-bold text-tw-muted ${lang === 'en' ? 'text-left' : 'text-right'}`}>
                  {GROUP_LABELS[groupKey]?.[lang] || GROUP_LABELS[groupKey]?.ar || groupKey}
                </h3>
                {items.map((n) => (
                  <NotificationCard key={n.id} notif={n} onDismiss={() => dismissOne(n.id)} lang={lang} />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NotificationCard({ notif, onDismiss, lang = 'ar' }) {
  return (
    <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 flex items-center gap-3 relative">
      {/* زر الإغلاق X على اليسار */}
      <button
        onClick={onDismiss}
        className="p-1.5 text-tw-muted/70 hover:bg-tw-soft rounded-lg flex-shrink-0 transition-colors"
        title={lang === 'en' ? 'Delete notification' : 'حذف الإشعار'}
      >
        <X size={16} />
      </button>

      {/* المحتوى — العنوان/النص محتوى مخزَّن يُعرض كما هو، والاتجاه يتبع اللغة */}
      <div className={`flex-1 min-w-0 ${lang === 'en' ? 'text-left' : 'text-right'}`}>
        <p className="font-bold text-sm text-tw-navy mb-1">{notif.title}</p>
        {notif.body && (
          <p className="text-xs text-tw-muted leading-relaxed">{notif.body}</p>
        )}
        <p className="text-[11px] text-tw-muted/70 mt-1.5">{formatRelative(notif.createdAt, lang)}</p>
      </div>

      {/* أيقونة الإيموجي + النقطة الزرقاء */}
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-xl bg-tw-soft flex items-center justify-center text-xl">
          {notif.emoji || '🔔'}
        </div>
        {!notif.read && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-tw-soft0 rounded-full border-2 border-white"></span>
        )}
      </div>
    </div>
  );
}
