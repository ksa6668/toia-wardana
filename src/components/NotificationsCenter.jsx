import React, { useState, useEffect } from 'react';
import { ChevronRight, Bell, Loader2, X, CheckCircle2, Calendar } from 'lucide-react';

// مركز الإشعارات — يعرض الإشعارات الحديثة من localStorage + إشعارات النظام التلقائية
// التصميم مطابق للـ prototype: قائمة بطاقات مع X للحذف + "تعليم الكل" + "مسح الكل"

const NOTIFS_KEY = 'tw_notifications_v1';

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

// تنسيق التاريخ النسبي
function formatRelative(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000; // ثواني

    if (diff < 60) return 'الآن';
    if (diff < 3600) return `${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) {
      const hours = d.getHours();
      const mins = d.getMinutes();
      const period = hours >= 12 ? 'م' : 'ص';
      const h12 = hours % 12 || 12;
      return `${h12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${period}`;
    }
    return d.toLocaleDateString('ar-SA');
  } catch {
    return '';
  }
}

// تجميع الإشعارات حسب اليوم
function groupByDay(notifs) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const groups = { اليوم: [], أمس: [], أقدم: [] };
  for (const n of notifs) {
    const day = n.createdAt?.slice(0, 10);
    if (day === today) groups['اليوم'].push(n);
    else if (day === yesterday) groups['أمس'].push(n);
    else groups['أقدم'].push(n);
  }
  return groups;
}

export default function NotificationsCenter({ onBack, userName = 'أحمد' }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // إضافة إشعار ترحيب تلقائي إذا لم يوجد إشعارات سابقة
    let initial = readStoredNotifs();
    if (initial.length === 0) {
      addNotification({
        title: 'مرحباً بعودتك',
        body: `أهلاً ${userName}، نتمنى لك يوماً موفقاً`,
        emoji: '👋',
        type: 'welcome',
      });
      initial = readStoredNotifs();
    }
    setNotifs(initial);
    setLoading(false);
  }, [userName]);

  const dismissOne = (id) => {
    const updated = notifs.filter((n) => n.id !== id);
    setNotifs(updated);
    saveStoredNotifs(updated);
  };

  const markAllRead = () => {
    const updated = notifs.map((n) => ({ ...n, read: true }));
    setNotifs(updated);
    saveStoredNotifs(updated);
  };

  const clearAll = () => {
    if (!confirm('مسح جميع الإشعارات؟')) return;
    setNotifs([]);
    saveStoredNotifs([]);
  };

  const groups = groupByDay(notifs);

  return (
    <div
      className="min-h-full relative overflow-hidden pb-20"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"Almarai", "IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* شريط العنوان */}
      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button onClick={onBack} className="p-2 text-tw-muted bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <div className="flex-1 text-center px-8">
          <h2 className="text-lg font-bold text-tw-navy">الإشعارات</h2>
          <p className="text-xs text-tw-muted/70 mt-0.5">كل التنبيهات والتذكيرات</p>
        </div>
      </div>

      {/* شريط الإجراءات: تعليم الكل + مسح الكل */}
      {notifs.length > 0 && (
        <div className="relative z-10 px-4 pt-4 flex items-center justify-between">
          <button
            onClick={clearAll}
            className="text-red-500 font-bold text-sm hover:underline"
          >
            مسح الكل
          </button>
          <button
            onClick={markAllRead}
            className="text-tw-blue font-bold text-sm hover:underline"
          >
            تعليم الكل كمقروء
          </button>
        </div>
      )}

      <div className="relative z-10 p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto rounded-full bg-tw-soft flex items-center justify-center mb-4">
              <Bell size={32} className="text-blue-300" />
            </div>
            <p className="text-tw-muted font-bold">لا توجد إشعارات حالياً</p>
            <p className="text-tw-muted/70 text-xs mt-1">سيظهر هنا أي تنبيه أو تذكير</p>
          </div>
        ) : (
          Object.entries(groups).map(([groupName, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={groupName} className="space-y-3">
                <h3 className="text-sm font-bold text-tw-muted text-right">{groupName}</h3>
                {items.map((n) => (
                  <NotificationCard key={n.id} notif={n} onDismiss={() => dismissOne(n.id)} />
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function NotificationCard({ notif, onDismiss }) {
  return (
    <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 flex items-center gap-3 relative">
      {/* زر الإغلاق X على اليسار */}
      <button
        onClick={onDismiss}
        className="p-1.5 text-tw-muted/70 hover:bg-gray-100 rounded-lg flex-shrink-0 transition-colors"
        title="حذف الإشعار"
      >
        <X size={16} />
      </button>

      {/* المحتوى */}
      <div className="flex-1 min-w-0 text-right">
        <p className="font-bold text-sm text-tw-navy mb-1">{notif.title}</p>
        {notif.body && (
          <p className="text-xs text-tw-muted leading-relaxed">{notif.body}</p>
        )}
        <p className="text-[11px] text-tw-muted/70 mt-1.5">{formatRelative(notif.createdAt)}</p>
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
