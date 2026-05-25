import React, { useState, useEffect, createContext, useContext } from 'react';
import {
  Receipt, TrendingUp,
  Settings, ChevronRight, ChevronDown,
  Calendar, Activity,
  Loader2, Users, Plus, CheckCircle2,
  Key, Trash2,
  Home, List, GripVertical, MapPin, MessageCircle
} from 'lucide-react';
import {
  login, logout, watchAuth,
  getSales, getFixedExpenses, setFixedExpense,
  getUsers, createStaffUser,
  getCategories, setCategoryRequiresImage, addCategory, deleteCategory, reorderCategories,
  changeMyPin, setUserActive, adminChangeUserPin, adminDeleteUser, adminUpdateUserProfile,
  getBranches,
  salesNet,
  saveUserLanguage,
  getMonthlyGoal,
  // Batch 12: admin edit/delete for sales & expenses
  deleteDailySales, deleteExpense,
  // Batch 46: WhatsApp
  getWhatsappEntries,
} from './firebase';
import { t, translateCategory, translateBranch, dirFor, readSavedLang, saveLangLocal } from './i18n';
import { useDragSort } from './hooks/useDragSort';
import { clearAllPersistedState } from './hooks/usePersistedState';
import { clearAllCache } from './hooks/useCachedQuery';
import { getAvailableMonths, formatMonthLabel } from './utils/periodHelpers';
import SarSymbol from './components/SarSymbol';
import BottomSheet from './components/BottomSheet';
import ManagerHome from './components/ManagerHome';
import ManagerMonthly from './components/ManagerMonthly';
import ManagerWhatsapp from './components/ManagerWhatsapp';
import ManagerKpis from './components/ManagerKpis';
import SalesFormV2 from './components/SalesFormV2';
import ExpenseFormV2 from './components/ExpenseFormV2';
import WhatsappFormV2 from './components/WhatsappFormV2';
import EmployeeWhatsappTable from './components/EmployeeWhatsappTable';
import ManageWhatsappBaseline from './components/ManageWhatsappBaseline';
import ReviewsExplain from './components/ReviewsExplain';
import WhatsappExplain from './components/WhatsappExplain';
import EmployeeHistory from './components/EmployeeHistory';
// Batch 12
import RecHistorySection from './components/RecHistorySection';
import DeleteConfirmSheet from './components/DeleteConfirmSheet';
// Batch 13
import ProfileMenuSheet from './components/ProfileMenuSheet';
// Admin settings + Goals + Branches (Batch 3)
import AdminSettingsV2 from './components/AdminSettingsV2';
// Batch 5: Notifications + Receipts + Logout confirm
import NotificationsCenter, { getUnreadCount } from './components/NotificationsCenter';
import ManagerReceipts from './components/ManagerReceipts';
import LogoutConfirmSheet from './components/LogoutConfirmSheet';
// Batch 6: Generic edit sheet for full forms
import EditSheet from './components/EditSheet';
// Batch 7: New unified white header
import AppHeader from './components/AppHeader';

// ==========================================
// أدوات تواريخ مساعدة
// Batch 46.10: استخدام التاريخ المحلي بدل UTC (السعودية UTC+3)
// ==========================================
const _localDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const _localMonth = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};
const todayStr = () => _localDate(new Date());
const monthStr = (d = new Date()) => _localMonth(d); // YYYY-MM

// يحسب نطاق التاريخ حسب الفترة المختارة
// يدعم: يومي / أسبوعي / شهري / ربع سنوي / سنوي / مخصص
function periodRange(period, customFrom, customTo) {
  const now = new Date();
  // Batch 46.10: التاريخ المحلي (وليس UTC) لتجنّب فرق المنطقة الزمنية
  const iso = (d) => _localDate(d);
  const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

  if (period === 'مخصص' && customFrom && customTo) {
    const f = new Date(customFrom);
    const t = new Date(customTo);
    const days = Math.max(1, Math.round((t - f) / 86400000) + 1);
    return { from: customFrom, to: customTo, days, daysInMonth: daysInMonth(now), periodKind: 'custom' };
  }

  if (period === 'يومي') {
    const d = iso(now);
    return { from: d, to: d, days: 1, daysInMonth: daysInMonth(now), periodKind: 'daily' };
  }

  if (period === 'أسبوعي') {
    // الأسبوع الجاري: من الأحد إلى اليوم الحالي (في السعودية الأسبوع يبدأ الأحد)
    const day = now.getDay(); // 0=Sun
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    return {
      from: iso(start),
      to: iso(now),
      days: day + 1,
      daysInMonth: daysInMonth(now),
      periodKind: 'weekly',
    };
  }

  if (period === 'شهري') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: iso(first),
      to: iso(last),
      days: now.getDate(),
      daysInMonth: last.getDate(),
      periodKind: 'monthly',
    };
  }

  if (period === 'ربع سنوي') {
    // الربع الحالي: يحتوي 3 أشهر
    const quarter = Math.floor(now.getMonth() / 3);
    const first = new Date(now.getFullYear(), quarter * 3, 1);
    const last = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    const days = Math.round((now - first) / 86400000) + 1;
    return {
      from: iso(first),
      to: iso(last),
      days,
      daysInMonth: daysInMonth(now),
      periodKind: 'quarterly',
    };
  }

  // سنوي (افتراضي)
  const first = new Date(now.getFullYear(), 0, 1);
  const last = new Date(now.getFullYear(), 11, 31);
  const dayOfYear = Math.floor((now - first) / 86400000) + 1;
  return {
    from: iso(first),
    to: iso(last),
    days: dayOfYear,
    daysInMonth: 30,
    periodKind: 'yearly',
  };
}

// ==========================================
// Batch 18: Context للهيدر — تنشره الشاشات الفرعية لإظهار العنوان وزر العودة
// ==========================================
export const ScreenCtxContext = createContext({ setScreenCtx: () => {} });

/**
 * Hook لاستخدامه في أي شاشة فرعية:
 *   useScreenHeader('عنوان الشاشة', () => onBackHandler);
 * عند unmount: يُمسح تلقائياً.
 *
 * Batch 41: نعتمد على title فقط في deps (onBack دالة جديدة كل render)
 * لكن نُسجّل أحدث onBack دائماً عبر ref لتجنّب stale closures.
 */
export function useScreenHeader(title, onBack) {
  const { setScreenCtx } = useContext(ScreenCtxContext);
  // نحتفظ بـ ref للـ onBack حتى نقدر نمرّر أحدث نسخة دائماً
  const onBackRef = React.useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; }, [onBack]);
  
  useEffect(() => {
    if (title) {
      setScreenCtx({
        title,
        onBack: () => onBackRef.current && onBackRef.current(),
      });
    }
    return () => setScreenCtx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
}

// ==========================================
// التطبيق الرئيسي
// ==========================================
export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminTab, setAdminTab] = useState('home');
  // ✨ اللغة — تخص شاشات الموظف فقط، لكن نقرأها للجميع لاتساق شاشة الدخول
  const [lang, setLang] = useState(readSavedLang());
  // Batch 5: حالات الإشعارات + تأكيد الخروج + الإيصالات
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const [showReceiptsCategories, setShowReceiptsCategories] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  // Batch 18: عنوان الشاشة الفرعية + handler العودة (للهيدر)
  const [screenCtx, setScreenCtx] = useState(null); // { title, onBack } | null
  
  // Batch 35: عداد الإشعارات غير المقروءة — يقرأ من localStorage ويستمع لـ events
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());
  useEffect(() => {
    const handler = () => setUnreadCount(getUnreadCount());
    window.addEventListener('tw-notifs-changed', handler);
    // أيضاً نُحدّث عند تغيّر تبويب المتصفح
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('tw-notifs-changed', handler);
      window.removeEventListener('focus', handler);
    };
  }, []);

  const userRole = user?.role || null;
  const branchId = user?.branchId || 'toia';
  const isAdmin = userRole === 'admin';
  // اسم الفرع: للموظف يترجم حسب اللغة، للمدير يبقى عربي
  const branch = isAdmin
    ? (branchId === 'wardana' ? 'وردانة' : 'تويا')
    : translateBranch(lang, branchId, branchId === 'wardana' ? 'وردانة' : 'تويا');

  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setAuthLoading(false);
      setCurrentView(u ? (u.role === 'admin' ? 'adminHome' : 'employeeHome') : 'login');
      // عند الدخول، طبّق لغة المستخدم المحفوظة في Firestore (إن وجدت)
      if (u && u.language && (u.language === 'ar' || u.language === 'en')) {
        setLang(u.language);
        saveLangLocal(u.language);
      }
    });
    return () => unsub();
  }, []);

  const handleLoginSuccess = (u) => {
    setUser(u);
    setCurrentView(u.role === 'admin' ? 'adminHome' : 'employeeHome');
    if (u.language && (u.language === 'ar' || u.language === 'en')) {
      setLang(u.language);
      saveLangLocal(u.language);
    }
  };

  const handleLogout = async () => {
    await logout();
    // Batch 45: مسح كل state وcache المحفوظ في sessionStorage
    clearAllPersistedState();
    clearAllCache();
    setUser(null);
    setCurrentView('login');
    setAdminTab('home');
  };

  // تبديل لغة الموظف (يحفظ محلياً + في Firestore)
  const changeLang = async (newLang) => {
    setLang(newLang);
    saveLangLocal(newLang);
    if (user?.uid && !isAdmin) {
      try { await saveUserLanguage(user.uid, newLang); } catch { /* ignore */ }
    }
  };

  // اتجاه الصفحة: للموظف حسب لغته، للمدير دائماً RTL
  const pageDir = isAdmin ? 'rtl' : dirFor(lang);
  const pageAlign = pageDir === 'rtl' ? 'text-right' : 'text-left';

  return (
    <ScreenCtxContext.Provider value={{ setScreenCtx }}>
    <div className={`md:flex md:items-center md:justify-center md:p-4 ${pageAlign}`}
         dir={pageDir}
         style={{
           fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif",
           background: '#F2F6FC', // Batch 21: نفس لون التطبيق — يغطي notch/status bar
           minHeight: '100dvh',
           height: '100dvh',
           overflow: 'hidden',
         }}>
      <div
        id="tw-app-frame"
        className="tw-app-frame w-full overflow-hidden flex flex-col relative
                   md:max-w-md md:rounded-[2.5rem]
                   md:shadow-[0_20px_50px_rgba(8,_112,_184,_0.25)]
                   md:border-8 md:border-slate-900
                   md:!h-[850px]"
        style={{
          /* Batch 20: ارتفاع ديناميكي ثابت — يحل خلل صعود/نزول الهيدر والبوتوم على iOS */
          height: '100dvh',
          /* Batch 21: خلفية موحّدة — نفس لون status bar فوق + bottom safe area تحت */
          background: '#F2F6FC',
        }}
      >

        {currentView !== 'login' && !authLoading && (() => {
          // Batch 21: تحديد عنوان الهيدر بناءً على adminTab أو screenCtx
          // أولوية: screenCtx (شاشة فرعية) > adminTab title > home mode
          const adminTabTitles = {
            monthly: 'الكشف الشامل',
            whatsapp: 'عملاء واتساب',
            kpis: 'المؤشرات',
            settings: 'الإعدادات',
            // home: لا يوجد title → home mode
          };
          const tabTitle = isAdmin && currentView === 'adminHome' && adminTab !== 'home'
            ? adminTabTitles[adminTab]
            : null;

          // الـ effective mode + title
          const effectiveMode = screenCtx
            ? 'screen'
            : (tabTitle ? 'screen' : 'home');
          const effectiveTitle = screenCtx?.title || tabTitle;
          const effectiveBack = screenCtx?.onBack; // العودة فقط في الشاشات الفرعية

          return (
            <AppHeader
              mode={effectiveMode}
              screenTitle={effectiveTitle}
              onBack={effectiveBack}
              greeting={
                isAdmin
                  ? `مرحباً، ${user?.displayName || user?.username || 'المدير'}`
                  : `مرحباً، ${branchId === 'wardana' ? 'وردانة' : 'تويا'}`
              }
              notifCount={isAdmin ? unreadCount : 0}
              onProfileClick={() => isAdmin ? setShowProfileMenu(true) : setShowLogoutConfirm(true)}
              onNotifClick={() => isAdmin && setShowNotifications(true)}
              langButton={
                (!isAdmin && !screenCtx) ? (
                  <button
                    onClick={() => changeLang(lang === 'ar' ? 'en' : 'ar')}
                    className="tw-circle-btn"
                    aria-label={lang === 'en' ? 'Change language' : 'تغيير اللغة'}
                    type="button"
                    title={lang === 'en' ? 'العربية' : 'English'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </button>
                ) : null
              }
            />
          );
        })()}

        <main
          className="flex-1 overflow-y-auto"
          style={{ background: 'transparent', minHeight: 0 }}
        >
          {authLoading && (
            <div className="h-full flex flex-col items-center justify-center text-tw-muted/70 gap-3 pt-20">
              <Loader2 size={32} className="animate-spin" />
              <p className="text-sm font-bold">{lang === 'en' ? 'Loading...' : 'جارٍ التحميل...'}</p>
            </div>
          )}
          {!authLoading && currentView === 'login' && (
            <LoginView onLoginSuccess={handleLoginSuccess} lang={lang} setLang={changeLang} />
          )}
          {!authLoading && currentView === 'employeeHome' && (
            <EmployeeHome setView={setCurrentView} branch={branch} branchId={branchId} lang={lang} setLang={changeLang} />
          )}
          {!authLoading && currentView === 'salesForm' && (
            <SalesFormV2 setView={setCurrentView} branch={branch} branchId={branchId} lang={lang} />
          )}
          {!authLoading && currentView === 'expenseForm' && (
            <ExpenseFormV2 setView={setCurrentView} branch={branch} branchId={branchId} lang={lang} isAdmin={isAdmin} />
          )}
          {!authLoading && currentView === 'whatsappForm' && (
            <WhatsappFormV2 setView={setCurrentView} branch={branch} branchId={branchId} lang={lang} />
          )}
          {!authLoading && currentView === 'reviewsExplain' && (
            <ReviewsExplain onBack={() => setCurrentView('employeeHome')} lang={lang} />
          )}
          {!authLoading && currentView === 'whatsappExplain' && (
            <WhatsappExplain onBack={() => setCurrentView('employeeHome')} lang={lang} />
          )}
          {!authLoading && currentView === 'employeeHistory' && (
            <EmployeeHistory setView={setCurrentView} branchId={branchId} lang={lang} />
          )}
          {/* ====== شاشات المدير ====== */}
          {!authLoading && currentView === 'adminHome' && adminTab === 'home' && <ManagerHome lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'monthly' && <ManagerMonthly lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'whatsapp' && <ManagerWhatsapp lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'kpis' && <ManagerKpis lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'settings' && (
            <AdminSettingsV2
              lang="ar"
              ManageUsersComponent={ManageUsers}
              ManageFixedExpensesComponent={ManageFixedExpenses}
              ManageCategoriesComponent={ManageCategories}
              AdminDataEntryComponent={AdminDataEntry}
            />
          )}
        </main>

        {userRole === 'admin' && currentView === 'adminHome' && !authLoading && (
          <nav
            className="flex items-center px-2 z-10 flex-shrink-0"
            style={{
              /* Batch 23: ارتفاع مناسب لإظهار الأيقونة + النص + safe-area للـ iPhone */
              background: '#F2F6FC',
              borderTop: '1px solid rgba(230, 236, 246, 0.8)',
              fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif",
              paddingTop: '8px',
              paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/*
              في RTL، أول عنصر بالـ array يظهر يمين.
              ترتيب جديد (يمين → يسار):
                كشف / واتساب / الرئيسية / المؤشرات / الإعدادات
            */}
            {[
              { key: 'monthly',  icon: List,           label: 'كشف' },
              { key: 'whatsapp', icon: MessageCircle,  label: 'واتساب' },
              { key: 'home',     icon: Home,           label: 'الرئيسية' },
              { key: 'kpis',     icon: Activity,       label: 'المؤشرات' },
              { key: 'settings', icon: Settings,       label: 'الإعدادات' },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = adminTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setAdminTab(tab.key)}
                  className={`flex flex-col items-center justify-center flex-1 py-1 gap-1.5 transition-colors ${
                    active ? 'text-tw-blue' : 'text-[#8A96AA] hover:text-tw-navy2'
                  }`}
                  style={{ minHeight: 48 }}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  <span className="text-[11px] font-bold leading-none whitespace-nowrap">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Batch 5: مركز الإشعارات (overlay) */}
        {showNotifications && (
          <div className="absolute inset-0 z-40 bg-white overflow-y-auto">
            <NotificationsCenter
              onBack={() => setShowNotifications(false)}
              userName={user?.displayName || user?.username || 'أحمد'}
            />
          </div>
        )}

        {/* Batch 5: شاشة الإيصالات والفواتير (overlay) */}
        {showReceipts && (
          <div className="absolute inset-0 z-40 bg-white overflow-y-auto">
            <ManagerReceipts
              onBack={() => setShowReceipts(false)}
              onOpenCategories={() => setShowReceiptsCategories(true)}
            />
          </div>
        )}

        {/* Batch 11: شاشة التصنيفات المفتوحة من داخل الإيصالات */}
        {showReceiptsCategories && (
          <div className="absolute inset-0 z-50 bg-white overflow-y-auto">
            <ManageCategories onBack={() => setShowReceiptsCategories(false)} />
          </div>
        )}

        {/* Batch 5: bottom sheet تأكيد الخروج */}
        {showLogoutConfirm && (
          <LogoutConfirmSheet
            onConfirm={async () => {
              setShowLogoutConfirm(false);
              await handleLogout();
            }}
            onCancel={() => setShowLogoutConfirm(false)}
          />
        )}

        {/* Batch 13: قائمة الحساب (تغيير الرمز + الخروج) */}
        <ProfileMenuSheet
          open={showProfileMenu}
          onClose={() => setShowProfileMenu(false)}
          onChangePin={() => setShowChangePinModal(true)}
          onLogout={() => setShowLogoutConfirm(true)}
          userName={user?.displayName || user?.username || 'المدير'}
        />

        {/* Batch 13: شاشة تغيير الرمز السري كـ overlay */}
        {showChangePinModal && (
          <div className="absolute inset-0 z-40 bg-white overflow-y-auto">
            <ChangeMyPin onBack={() => setShowChangePinModal(false)} />
          </div>
        )}
      </div>
    </div>
    </ScreenCtxContext.Provider>
  );
}

function LoginView({ onLoginSuccess, lang, setLang }) {
  const [username, setUsername] = useState(() => {
    try { return localStorage.getItem('tw_remember_user') || ''; } catch { return ''; }
  });
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(() => {
    try { return !!localStorage.getItem('tw_remember_user'); } catch { return false; }
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!username.trim()) { setError(t(lang, 'login.err.username')); return; }
    if (!/^\d{4}$/.test(pin)) { setError(t(lang, 'login.err.pin')); return; }
    setLoading(true);
    try {
      const u = await login(username, pin);
      try {
        if (remember) localStorage.setItem('tw_remember_user', username.trim());
        else localStorage.removeItem('tw_remember_user');
      } catch { /* ignore */ }
      onLoginSuccess(u);
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setError(t(lang, 'login.err.invalid'));
      } else if (code.includes('too-many-requests')) {
        setError(t(lang, 'login.err.tooMany'));
      } else if (code.includes('network')) {
        setError(t(lang, 'login.err.network'));
      } else {
        setError(err?.message || t(lang, 'login.err.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  return (
    <div
      className="relative min-h-full flex flex-col px-6 pt-8 pb-10 overflow-hidden"
      style={{
        // Batch 37: التدرج يبدأ من أعلى الشاشة ويمتد ليصل لقعر شاشة الجوال
        // عملياً status-bar (إن كان شفافاً) سيظهر فوق نفس التدرج الناعم
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية ناعمة */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,91,255,0.25), transparent 70%)' }}
      />

      {/* زر اللغة في الزاوية */}
      <div className={`relative z-10 flex ${lang === 'en' ? 'justify-end' : 'justify-start'} mb-3`}>
        <button
          onClick={toggleLang}
          className="bg-white/80 backdrop-blur-sm border border-tw-line text-tw-navy px-3.5 py-1.5 rounded-xl shadow-sm hover:bg-white hover:shadow-md transition-all"
          style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.5px' }}
        >
          {lang === 'ar' ? 'EN' : 'ع'}
        </button>
      </div>

      {/* Batch 37: الشعار — مساحة محدودة لا تأخذ كل الفراغ، ليرتفع النموذج للأعلى */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center mt-4 mb-6">
        <div
          className="w-40 h-40 mx-auto mb-5 flex items-center justify-center rounded-[2.5rem] shadow-xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #082765 0%, #061742 60%, #1E3A8A 100%)',
            boxShadow: '0 20px 50px -10px rgba(8, 39, 101, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset',
          }}
        >
          {/* تأثير لمعة */}
          <div
            className="absolute inset-0 opacity-40"
            style={{ background: 'radial-gradient(circle at 30% 20%, rgba(40,223,255,0.4), transparent 50%)' }}
          />
          {/* رمز الزهرة (شعار) */}
          <svg width="82" height="82" viewBox="0 0 100 100" className="relative z-10" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
            {/* 4 بتلات */}
            <ellipse cx="50" cy="28" rx="14" ry="22" fill="white" opacity="0.92" />
            <ellipse cx="50" cy="72" rx="14" ry="22" fill="white" opacity="0.92" />
            <ellipse cx="28" cy="50" rx="22" ry="14" fill="#28DFFF" opacity="0.85" />
            <ellipse cx="72" cy="50" rx="22" ry="14" fill="#168BFF" opacity="0.85" />
            <circle cx="50" cy="50" r="6" fill="white" />
          </svg>
        </div>
        <h1
          className="text-3xl mb-1"
          style={{
            fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif',
            fontWeight: 800,
            color: '#061742',
            letterSpacing: '-0.5px',
          }}
        >
          Toia &amp; Wardana
        </h1>
        <p className="text-sm font-medium" style={{ color: '#7E8AA3' }}>
          {t(lang, 'login.subtitle')}
        </p>
      </div>

      {/* Batch 37: النموذج - يأخذ المساحة المتبقية بـ flex-1 */}
      <div className="relative z-10 space-y-4 flex-1 flex flex-col justify-start">
        <div>
          <label
            className="block mb-2 text-xs"
            style={{ color: '#071A3D', fontWeight: 700 }}
          >
            {t(lang, 'login.username')}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t(lang, 'login.usernameHint')}
            autoCapitalize="off"
            className="w-full px-4 py-3.5 rounded-2xl outline-none transition-all"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E6ECF6',
              boxShadow: '0 1px 3px rgba(8, 39, 101, 0.04)',
              fontSize: '15px',
              color: '#071A3D',
              fontWeight: 600,
            }}
            onFocus={(e) => (e.target.style.borderColor = '#005BFF')}
            onBlur={(e) => (e.target.style.borderColor = '#E6ECF6')}
          />
        </div>

        <div>
          <label
            className="block mb-2 text-xs"
            style={{ color: '#071A3D', fontWeight: 700 }}
          >
            {t(lang, 'login.pin')}
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="••••"
            className="w-full px-4 py-3.5 rounded-2xl outline-none text-center transition-all"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E6ECF6',
              boxShadow: '0 1px 3px rgba(8, 39, 101, 0.04)',
              fontSize: '18px',
              letterSpacing: '0.5em',
              fontFamily: 'monospace',
              color: '#061742',
              fontWeight: 700,
            }}
            onFocus={(e) => (e.target.style.borderColor = '#005BFF')}
            onBlur={(e) => (e.target.style.borderColor = '#E6ECF6')}
          />
        </div>

        {/* Checkbox تذكّرني */}
        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4"
            style={{ accentColor: '#005BFF' }}
          />
          <span className="text-xs" style={{ color: '#7E8AA3', fontWeight: 600 }}>
            {t(lang, 'login.remember')}
          </span>
        </label>

        {error && (
          <div
            className="rounded-xl px-3 py-2.5 text-center"
            style={{
              background: 'rgba(240, 68, 68, 0.08)',
              border: '1px solid rgba(240, 68, 68, 0.2)',
              color: '#F04444',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {/* زر تسجيل دخول بتدرّج فاخر */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{
            background: loading
              ? 'linear-gradient(135deg, #4A5568, #2D3748)'
              : 'linear-gradient(135deg, #1E3A8A 0%, #005BFF 50%, #168BFF 100%)',
            fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif',
            fontSize: '16px',
            fontWeight: 700,
            boxShadow: '0 10px 25px -5px rgba(0, 91, 255, 0.5), 0 4px 10px -2px rgba(0, 91, 255, 0.3)',
            letterSpacing: '0.3px',
          }}
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? t(lang, 'login.loading') : t(lang, 'login.submit')}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// الصفحة الرئيسية للموظف
// ==========================================
function EmployeeHome({ setView, branch, branchId, lang, setLang }) {
  const align = lang === 'en' ? 'text-left' : 'text-right';
  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  // اسم الشهر الحالي — Batch 39: نستخدم نفس formatMonthLabel الذي يستخدمه المدير
  // لضمان تطابق التنسيق (مايو 2026 بأرقام إنجليزية في كل الشاشات)
  const monthLabel = (() => {
    const d = new Date();
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return formatMonthLabel(monthStr, lang);
  })();

  // ====== KPIs الحقيقية من Firestore ======
  const [kpis, setKpis] = useState({ budgetPct: 0, reviewsPct: 0, whatsappPct: 0, whatsappSubtext: '', loaded: false });
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    (async () => {
      try {
        const d = new Date();
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const from = `${monthStr}-01`;
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const to = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
        // Batch 39: نمرر branchId لـ getSales ليُفلتر في Firestore (يتوافق مع Rules الموظف)
        // Batch 46: + WhatsApp data
        const [goal, branchSales, branchWa] = await Promise.all([
          getMonthlyGoal(branchId, monthStr),
          getSales(from, to, branchId),
          getWhatsappEntries(from, to, branchId),
        ]);
        const totalSales = branchSales.reduce((sum, s) => sum + salesNet(s), 0);
        const budgetPct = goal.budget > 0
          ? Math.min(100, Math.round((totalSales / goal.budget) * 100))
          : 0;
        // التقييمات المُحقّقة من Firestore (Batch 16)
        const reviewsAchieved = Number(goal.reviewsAchieved) || 0;
        const reviewsTarget = Number(goal.reviewsTarget) || 0;
        const reviewsPct = reviewsTarget > 0
          ? Math.min(100, Math.round((reviewsAchieved / reviewsTarget) * 100))
          : 0;
        // Batch 46: نسبة تحقيق واتساب (20% من المشترين = 100% تحقيق)
        const totalCustomers = branchWa.reduce((sum, w) => sum + (w.customers || 0), 0);
        const totalBuyers = branchWa.reduce((sum, w) => sum + (w.buyers || 0), 0);
        const actualPct = totalCustomers > 0 ? (totalBuyers / totalCustomers) * 100 : 0;
        const whatsappPct = Math.min(100, Math.round((actualPct / 20) * 100));
        // Batch 46.5: لا نعرض 0/0 — فقط إذا فيه بيانات
        const whatsappSubtext = totalCustomers > 0 ? `${totalBuyers} / ${totalCustomers}` : '';
        if (!cancelled) {
          setKpis({ budgetPct, reviewsPct, whatsappPct, whatsappSubtext, loaded: true, hasGoal: goal.exists });
        }
      } catch (err) {
        // Batch 39: نسجّل الخطأ بدل ابتلاعه — مفيد للتشخيص في Console
        console.error('EmployeeHome KPIs error:', err);
        if (!cancelled) setKpis({ budgetPct: 0, reviewsPct: 0, loaded: true, error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [branchId]);

  return (
    <div
      className="relative min-h-full flex flex-col px-5 pt-3 pb-8"
      style={{
        background: 'transparent',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* بطاقة الترحيب */}
      <div className="relative z-10 bg-white p-4 rounded-2xl shadow-sm border border-tw-line text-center mb-3">
        <p className="text-tw-muted text-sm mb-1">{t(lang, 'home.greeting')}</p>
        <h2 className="text-xl font-bold" style={{ color: '#061742' }}>
          {lang === 'en' ? branch : `فرع ${branch}`}
        </h2>
      </div>

      {/* شريط الشهر — ميلادي */}
      <div className="relative z-10 flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-2.5 px-4 mb-3 shadow-sm">
        <Calendar size={16} className="text-tw-blue" />
        <span className="font-bold text-sm text-tw-navy">{monthLabel}</span>
      </div>

      {/* الكروت الكثيرة — توزيع متوازن بمقاس صفحة واحدة (Batch 46) */}
      <div className="relative z-10 flex-1 flex flex-col gap-2.5">
        {/* صف الميزانية + التقييمات (جنباً إلى جنب) */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* كارت تحقيق الميزانية */}
          <div
            className="text-white p-3 rounded-2xl overflow-hidden relative"
            style={{
              background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
              boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
              minHeight: 105,
            }}
          >
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
            />
            <div className="relative flex flex-col items-center text-center gap-1.5 h-full justify-center">
              <p className="text-[10px] font-semibold opacity-95 leading-tight">
                {t(lang, 'home.kpiBudget') || 'تحقيق الميزانية'}
              </p>
              <p className="text-2xl font-extrabold leading-none">
                {kpis.budgetPct}%
              </p>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${kpis.budgetPct}%`,
                    background: 'linear-gradient(90deg, #28DFFF 0%, #22D08A 100%)',
                    boxShadow: '0 0 8px rgba(40,223,255,0.5)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* كارت تقييمات قوقل ماب - قابل للضغط (Batch 46.9) */}
          <div
            onClick={() => setView('reviewsExplain')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('reviewsExplain'); } }}
            className="text-white p-3 rounded-2xl overflow-hidden relative active:scale-95 transition-transform"
            style={{
              background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
              boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
              minHeight: 105,
              cursor: 'pointer',
            }}
          >
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
            />
            <div className="relative flex flex-col items-center text-center gap-1 h-full justify-center">
              <p className="text-[10px] font-semibold opacity-95 leading-tight">
                {t(lang, 'home.kpiReviews') || 'تقييمات قوقل ماب'}
              </p>
              <p className="text-2xl font-extrabold leading-none">
                {kpis.reviewsPct}%
              </p>
              <p className="text-[10px] tracking-[0.1em] opacity-90">⭐⭐⭐⭐⭐</p>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${kpis.reviewsPct}%`,
                    background: 'linear-gradient(90deg, #28DFFF 0%, #22D08A 100%)',
                    boxShadow: '0 0 8px rgba(40,223,255,0.5)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Batch 46: كرت تحقيق واتساب رفيع - قابل للضغط (Batch 46.9) */}
        <div
          onClick={() => setView('whatsappExplain')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setView('whatsappExplain'); } }}
          className="text-white px-3 py-2.5 rounded-2xl overflow-hidden relative active:scale-95 transition-transform"
          style={{
            background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
            boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
            cursor: 'pointer',
          }}
        >
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
          />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-shrink-0">
              <MessageCircle size={16} />
              <p className="text-[11px] font-bold opacity-95 leading-tight">
                {lang === 'en' ? 'WhatsApp Sales' : 'تحقيق مبيعات واتساب'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-1 max-w-[55%]">
              <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${kpis.whatsappPct}%`,
                    background: 'linear-gradient(90deg, #28DFFF 0%, #22D08A 100%)',
                    boxShadow: '0 0 8px rgba(40,223,255,0.5)',
                  }}
                />
              </div>
              <p className="text-base font-extrabold leading-none whitespace-nowrap">{kpis.whatsappPct}%</p>
            </div>
          </div>
        </div>

        {/* كارت تسجيل المبيعات — موحّد بنفس تصميم تسجيل المصروفات (أبيض ناعم) */}
        <button
          onClick={() => setView('salesForm')}
          className="bg-white p-3 rounded-2xl shadow-sm border border-tw-line flex items-center gap-3 active:scale-95 transition-transform"
          style={{ minHeight: 68 }}
        >
          <div className="bg-tw-soft text-tw-blue p-2.5 rounded-xl flex-shrink-0">
            <TrendingUp size={22} />
          </div>
          <div className={`flex-1 ${align}`}>
            <h3 className="font-bold text-tw-navy text-base mb-0.5">{t(lang, 'home.recordSales')}</h3>
            <p className="text-tw-muted text-xs">{t(lang, 'home.recordSalesD')}</p>
          </div>
        </button>

        {/* كارت تسجيل المصروفات — أبيض ناعم */}
        <button
          onClick={() => setView('expenseForm')}
          className="bg-white p-3 rounded-2xl shadow-sm border border-tw-line flex items-center gap-3 active:scale-95 transition-transform"
          style={{ minHeight: 68 }}
        >
          <div className="bg-tw-soft text-tw-blue p-2.5 rounded-xl flex-shrink-0">
            <Receipt size={22} />
          </div>
          <div className={`flex-1 ${align}`}>
            <h3 className="font-bold text-tw-navy text-base mb-0.5">{t(lang, 'home.recordExpense')}</h3>
            <p className="text-tw-muted text-xs">{t(lang, 'home.recordExpenseD')}</p>
          </div>
        </button>

        {/* Batch 46: كارت تسجيل عملاء واتساب */}
        <button
          onClick={() => setView('whatsappForm')}
          className="bg-white p-3 rounded-2xl shadow-sm border border-tw-line flex items-center gap-3 active:scale-95 transition-transform"
          style={{ minHeight: 68 }}
        >
          <div className="bg-tw-soft text-tw-blue p-2.5 rounded-xl flex-shrink-0">
            <MessageCircle size={22} />
          </div>
          <div className={`flex-1 ${align}`}>
            <h3 className="font-bold text-tw-navy text-base mb-0.5">
              {lang === 'en' ? 'WhatsApp customers' : 'تسجيل عملاء واتساب'}
            </h3>
            <p className="text-tw-muted text-xs">
              {lang === 'en' ? 'Today\'s customers and buyers' : 'عدد العملاء والمشترين لليوم'}
            </p>
          </div>
        </button>

        {/* Batch 48: جدول كشف عملاء واتساب - آخر 3 أيام */}
        <EmployeeWhatsappTable branchId={branchId} lang={lang} />
      </div>
    </div>
  );
}

function AdminSettings() {
  const [screen, setScreen] = useState('menu');

  if (screen === 'users') return <ManageUsers onBack={() => setScreen('menu')} />;
  if (screen === 'fixed') return <ManageFixedExpenses onBack={() => setScreen('menu')} />;
  if (screen === 'categories') return <ManageCategories onBack={() => setScreen('menu')} />;
  if (screen === 'myPin') return <ChangeMyPin onBack={() => setScreen('menu')} />;
  if (screen === 'adminEntry') return <AdminDataEntry onBack={() => setScreen('menu')} />;

  const items = [
    { key: 'adminEntry', label: 'تسجيل مبيعات/مصاريف', desc: 'إدخال لأي فرع كمدير', enabled: true },
    { key: 'users', label: 'المستخدمون والصلاحيات', desc: 'إضافة، تعطيل، حذف، تغيير الرمز', enabled: true },
    { key: 'myPin', label: 'تغيير رمزي السري', desc: 'تحديث رمزك أنت', enabled: true },
    { key: 'categories', label: 'التصنيفات والفواتير', desc: 'تحديد التصنيفات وإلزامية الصورة', enabled: true },
    { key: 'fixed', label: 'المصاريف الثابتة', desc: 'إيجار ورواتب — شهري لكل فرع', enabled: true },
    { key: 'branches', label: 'الفروع', desc: 'تويا، وردانة', enabled: false },
  ];

  return (
    <div className="p-4 space-y-4 pb-20">
      <h2 className="text-xl font-bold text-tw-navy px-1 mb-2">إعدادات النظام</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
        {items.map((item) => (
          <button key={item.key} disabled={!item.enabled}
            onClick={() => item.enabled && setScreen(item.key)}
            className={`w-full p-4 border-b border-tw-line/60 last:border-0 flex items-center justify-between text-right transition-colors ${item.enabled ? 'hover:bg-tw-soft/40 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
            <div>
              <span className="font-bold text-sm text-tw-navy block">{item.label}</span>
              <span className="text-[11px] text-tw-muted/70">{item.desc}{!item.enabled && ' (قريباً)'}</span>
            </div>
            <ChevronRight size={18} className="text-tw-muted/70" />
          </button>
        ))}
      </div>
    </div>
  );
}

// شاشة إدارة المستخدمين
function ManageUsers({ onBack }) {
  useScreenHeader('المستخدمون والصلاحيات', onBack);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPinUid, setEditPinUid] = useState(null); // أي مستخدم نغيّر رمزه (للوضع القديم)
  const [busyUid, setBusyUid] = useState(null);

  // Batch 6: edit modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editRole, setEditRole] = useState('employee');
  const [editBranch, setEditBranch] = useState('toia');
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // حقول نموذج الإضافة
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('employee');
  const [branchId, setBranchId] = useState('toia');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // حقل تغيير الرمز (legacy inline)
  const [editPinValue, setEditPinValue] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(err?.message || 'تعذّر تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  // فتح modal التعديل لمستخدم
  const openEdit = (u) => {
    setEditingUser(u);
    setEditName(u.displayName || u.username || '');
    setEditPin(''); // فارغ = لا تغيير
    setEditRole(u.role || 'employee');
    setEditBranch(u.branchId || 'toia');
    setEditActive(u.active !== false);
    setEditError('');
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditError('');
  };

  // حفظ تعديلات المستخدم
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditError('');
    if (!editName.trim()) {
      setEditError('أدخل اسم المستخدم');
      return;
    }
    if (editPin && !/^\d{4}$/.test(editPin)) {
      setEditError('كلمة المرور يجب أن تكون 4 أرقام (أو اتركها فارغة لعدم التغيير)');
      return;
    }
    setEditSaving(true);
    try {
      // 1) تحديث الملف الشخصي (اسم/دور/فرع)
      await adminUpdateUserProfile(editingUser.uid, {
        displayName: editName.trim(),
        role: editRole,
        branchId: editBranch,
      });
      // 2) تحديث الحالة (نشط/معطّل) إذا تغيّرت
      const currentActive = editingUser.active !== false;
      if (currentActive !== editActive) {
        await setUserActive(editingUser.uid, editActive);
      }
      // 3) تغيير كلمة المرور إذا أُدخلت
      if (editPin) {
        await adminChangeUserPin(editingUser.uid, editPin);
      }
      await loadUsers();
      closeEdit();
    } catch (err) {
      setEditError(err?.message || 'تعذّر الحفظ');
    } finally {
      setEditSaving(false);
    }
  };

  // حذف من داخل modal التعديل
  const handleDeleteFromEdit = async () => {
    if (!editingUser) return;
    if (!confirm(`حذف نهائي لمستخدم "${editingUser.displayName || editingUser.username}"؟ لا يمكن التراجع.`)) return;
    setEditSaving(true);
    setEditError('');
    try {
      await adminDeleteUser(editingUser.uid);
      await loadUsers();
      closeEdit();
    } catch (err) {
      setEditError(err?.message || 'تعذّر الحذف');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    if (!username.trim()) { setError('أدخل اسم المستخدم'); return; }
    if (!/^\d{4}$/.test(pin)) { setError('الرمز يجب أن يكون 4 أرقام'); return; }
    setSaving(true);
    try {
      await createStaffUser({ username, pin, role, branchId, displayName });
      setUsername(''); setPin(''); setDisplayName('');
      setRole('employee'); setBranchId('toia');
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('email-already-in-use')) setError('اسم المستخدم مستخدم مسبقاً');
      else setError(err?.message || 'تعذّر إنشاء المستخدم');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async (uid) => {
    setError('');
    if (!/^\d{4}$/.test(editPinValue)) { setError('الرمز يجب أن يكون 4 أرقام'); return; }
    setBusyUid(uid);
    try {
      await adminChangeUserPin(uid, editPinValue);
      setEditPinUid(null);
      setEditPinValue('');
    } catch (err) {
      setError(err?.message || 'تعذّر تغيير الرمز');
    } finally {
      setBusyUid(null);
    }
  };

  const handleToggleActive = async (u) => {
    setError('');
    setBusyUid(u.uid);
    try {
      await setUserActive(u.uid, u.active === false ? true : false);
      await loadUsers();
    } catch (err) {
      setError(err?.message || 'تعذّر التحديث');
    } finally {
      setBusyUid(null);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`حذف نهائي لمستخدم "${u.displayName || u.username}"؟ لا يمكن التراجع.`)) return;
    setError('');
    setBusyUid(u.uid);
    try {
      await adminDeleteUser(u.uid);
      await loadUsers();
    } catch (err) {
      setError(err?.message || 'تعذّر الحذف');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div
      className="min-h-full relative overflow-hidden pb-20"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      <div className="relative z-10 p-4 space-y-3">
        {/* form إضافة مستخدم */}
        {showForm && (
          <div className="bg-white border border-tw-blue/30 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="font-bold text-sm text-tw-navy">مستخدم جديد</h3>
            <input type="text" placeholder="اسم المستخدم (إنجليزي)" value={username}
              onChange={(e) => setUsername(e.target.value)} autoCapitalize="off"
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue" />
            <input type="text" placeholder="الاسم الظاهر" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue" />
            <input type="password" inputMode="numeric" maxLength={4} placeholder="الرمز (4 أرقام)" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue text-center tracking-[0.4em] font-mono" />
            <div className="flex gap-2">
              {[{ v: 'employee', t: 'موظف' }, { v: 'admin', t: 'مدير' }].map((r) => (
                <button key={r.v} onClick={() => setRole(r.v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border ${role === r.v ? 'bg-tw-blue text-white border-blue-600' : 'bg-tw-soft/40 text-tw-muted border-tw-line'}`}>
                  {r.t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {[{ v: 'toia', t: 'تويا' }, { v: 'wardana', t: 'وردانة' }].map((b) => (
                <button key={b.v} onClick={() => setBranchId(b.v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border ${branchId === b.v ? 'bg-slate-800 text-white border-slate-800' : 'bg-tw-soft/40 text-tw-muted border-tw-line'}`}>
                  {b.t}
                </button>
              ))}
            </div>
            {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-2 text-center">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setError(''); }}
                className="flex-1 bg-white border border-tw-line text-tw-muted font-bold py-2.5 rounded-xl text-sm">
                إلغاء
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)' }}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'جارٍ...' : 'حفظ'}
              </button>
            </div>
            <p className="text-[10px] text-tw-orange bg-amber-50 rounded-lg p-2 text-center">
              ملاحظة: بعد الحفظ سيُسجَّل دخولك بالحساب الجديد. سجّل خروج ثم ادخل بحسابك من جديد.
            </p>
          </div>
        )}

        {!showForm && error && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-tw-muted/50" /></div>
        ) : (
          <>
            {/* قائمة المستخدمين بتصميم prototype - كل صف قابل للضغط لفتح modal التعديل */}
            <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
              {users.map((u, idx) => (
                <button
                  key={u.uid}
                  onClick={() => openEdit(u)}
                  className={`w-full p-4 flex items-center gap-3 text-right hover:bg-tw-soft/40 transition-colors ${idx > 0 ? 'border-t border-tw-line/60' : ''}`}
                >
                  {/* الأيقونة قبل الاسم (في RTL تظهر يمين، بجانب الاسم) */}
                  <div className="w-12 h-12 rounded-2xl bg-tw-soft text-tw-blue flex items-center justify-center flex-shrink-0">
                    <Users size={20} />
                  </div>
                  {/* النص في المنتصف */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-tw-navy truncate">
                      {u.displayName || u.username}
                    </p>
                    <p className="text-xs text-tw-muted truncate">
                      {u.role === 'admin' ? 'مدير' : 'موظف'} — {u.branchId === 'wardana' ? 'فرع وردانة' : u.branchId === 'toia' ? 'فرع تويا' : 'الكل'}
                    </p>
                  </div>
                  {/* شارة الحالة على أقصى اليسار (في RTL = آخر DOM element) */}
                  <div className={`text-xs font-bold flex-shrink-0 px-2.5 py-1 rounded-full ${
                    u.active === false
                      ? 'bg-gray-100 text-tw-muted/70'
                      : 'bg-emerald-50 text-tw-green'
                  }`}>
                    {u.active === false ? 'معطّل' : 'نشط'}
                  </div>
                </button>
              ))}
            </div>

            {/* زر إضافة مستخدم — gradient navy في الأسفل */}
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                  boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
                }}>
                <Plus size={18} /> + إضافة مستخدم
              </button>
            )}
          </>
        )}
      </div>

      {/* Batch 6: Bottom Sheet لتعديل المستخدم */}
      <EditSheet open={!!editingUser} onClose={closeEdit} title="تعديل المستخدم">
        {editingUser && (
          <div className="space-y-4">
            {/* الاسم */}
            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">الاسم</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-3.5 bg-tw-soft/40 border border-tw-line rounded-xl text-base font-bold text-tw-navy outline-none focus:border-tw-blue"
              />
            </div>

            {/* كلمة المرور */}
            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">
                كلمة المرور <span className="font-normal text-tw-muted/70">(اتركها فارغة لعدم التغيير)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={editPin}
                onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                className="w-full p-3.5 bg-tw-soft/40 border border-tw-line rounded-xl text-base font-bold text-tw-navy text-center tracking-[0.4em] font-mono outline-none focus:border-tw-blue"
              />
            </div>

            {/* الدور */}
            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">الدور</label>
              <div className="flex gap-2">
                {[
                  { v: 'admin', t: 'مدير' },
                  { v: 'employee', t: 'موظف' },
                ].map((r) => (
                  <button
                    key={r.v}
                    onClick={() => setEditRole(r.v)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${
                      editRole === r.v
                        ? 'bg-tw-blue text-white border-blue-600'
                        : 'bg-tw-soft/40 text-tw-muted border-tw-line hover:bg-tw-soft'
                    }`}
                  >
                    {r.t}
                  </button>
                ))}
              </div>
            </div>

            {/* الفرع */}
            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">الفرع</label>
              <div className="flex gap-2">
                {[
                  { v: 'all', t: 'الكل' },
                  { v: 'toia', t: 'فرع تويا' },
                  { v: 'wardana', t: 'فرع وردانة' },
                ].map((b) => (
                  <button
                    key={b.v}
                    onClick={() => setEditBranch(b.v)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${
                      editBranch === b.v
                        ? 'bg-tw-blue text-white border-blue-600'
                        : 'bg-tw-soft/40 text-tw-muted border-tw-line hover:bg-tw-soft'
                    }`}
                  >
                    {b.t}
                  </button>
                ))}
              </div>
            </div>

            {/* المستخدم نشط toggle */}
            <button
              onClick={() => setEditActive(!editActive)}
              className="w-full bg-emerald-50 rounded-xl p-3.5 flex items-center justify-between border border-emerald-100 hover:bg-emerald-100 transition-colors"
            >
              <div className={`relative w-12 h-6 rounded-full transition-colors ${editActive ? 'bg-tw-green' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${editActive ? 'right-0.5' : 'right-[26px]'}`} />
              </div>
              <span className="text-sm font-bold text-tw-navy">المستخدم نشط</span>
            </button>

            {/* رسالة الخطأ */}
            {editError && (
              <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                {editError}
              </p>
            )}

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={closeEdit}
                disabled={editSaving}
                className="flex-1 bg-white border border-tw-line text-tw-navy font-bold py-3.5 rounded-xl hover:bg-tw-soft/40 disabled:opacity-60"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="flex-1 text-white font-bold py-3.5 rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                  boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
                }}
              >
                {editSaving && <Loader2 size={16} className="animate-spin" />}
                حفظ
              </button>
            </div>

            {/* زر حذف المستخدم */}
            <button
              onClick={handleDeleteFromEdit}
              disabled={editSaving}
              className="w-full bg-red-50 hover:bg-red-50 text-tw-red font-bold py-3.5 rounded-xl border border-red-100 transition-colors disabled:opacity-60"
            >
              حذف المستخدم
            </button>
          </div>
        )}
      </EditSheet>
    </div>
  );
}

// شاشة المصاريف الثابتة الشهرية
function ManageFixedExpenses({ onBack }) {
  useScreenHeader('المصاريف الثابتة', onBack);
  // Batch 31: السماح باختيار الشهر (للسجلات التاريخية + الشهر الحالي)
  const [month, setMonth] = useState(monthStr());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  // كل فرع له 3 بنود: إيجار + رواتب + تأمينات GOSI
  const [toia, setToia] = useState({ rent: '', salaries: '', gosi: '' });
  const [wardana, setWardana] = useState({ rent: '', salaries: '', gosi: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Batch 31: نُفرغ القيم أولاً عند تغيّر الشهر
      setToia({ rent: '', salaries: '', gosi: '' });
      setWardana({ rent: '', salaries: '', gosi: '' });
      try {
        const fixed = await getFixedExpenses(month);
        if (cancelled) return;
        const t = fixed.find((f) => f.branchId === 'toia');
        const w = fixed.find((f) => f.branchId === 'wardana');
        if (t) {
          // إذا الـ breakdown موجود نستخدمه، وإلا نضع المبلغ كله في الإيجار (compat)
          if (t.rent != null || t.salaries != null || t.gosi != null) {
            setToia({
              rent: t.rent != null ? String(t.rent) : '',
              salaries: t.salaries != null ? String(t.salaries) : '',
              gosi: t.gosi != null ? String(t.gosi) : '',
            });
          } else if (t.amount) {
            setToia({ rent: String(t.amount), salaries: '', gosi: '' });
          }
        }
        if (w) {
          if (w.rent != null || w.salaries != null || w.gosi != null) {
            setWardana({
              rent: w.rent != null ? String(w.rent) : '',
              salaries: w.salaries != null ? String(w.salaries) : '',
              gosi: w.gosi != null ? String(w.gosi) : '',
            });
          } else if (w.amount) {
            setWardana({ rent: String(w.amount), salaries: '', gosi: '' });
          }
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر التحميل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [month]);

  const handleSave = async () => {
    setError(''); setDone(false);
    setSaving(true);
    try {
      await setFixedExpense({
        month, branchId: 'toia',
        rent: toia.rent, salaries: toia.salaries, gosi: toia.gosi,
      });
      await setFixedExpense({
        month, branchId: 'wardana',
        rent: wardana.rent, salaries: wardana.salaries, gosi: wardana.gosi,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const sumBranch = (b) =>
    (Number(b.rent) || 0) + (Number(b.salaries) || 0) + (Number(b.gosi) || 0);
  const totalFixed = sumBranch(toia) + sumBranch(wardana);

  // Batch 42: BranchCard كـ helper function (مش inner component) لتجنّب re-mount
  // كل keystroke كان يُعيد إنشاء المكون → الـ input يفقد focus → الكيبورد يختفي.
  // الحل: تحويلها لـ function تعيد JSX (داخل نفس scope الحالي).
  const renderBranchCard = (title, data, setData) => (
    <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-tw-line/60 pb-2">
        <h4 className="text-sm font-bold text-tw-navy">{title}</h4>
        <span className="text-xs font-bold text-tw-blue flex items-center gap-1">
          {sumBranch(data).toLocaleString()} <SarSymbol className="text-[10px]" />
        </span>
      </div>

      {[
        { key: 'rent', label: 'الإيجار' },
        { key: 'salaries', label: 'الرواتب' },
        { key: 'gosi', label: 'التأمينات (GOSI)' },
      ].map((field) => (
        <div key={field.key}>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">{field.label}</label>
          <div className="flex items-center gap-2 bg-tw-soft/40 border border-tw-line rounded-xl p-3">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={data[field.key]}
              onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
              className="flex-1 text-base font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50"
              dir="ltr"
            />
            <SarSymbol className="text-tw-muted/70 text-sm" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="min-h-full relative pb-20"
      style={{
        background: 'transparent',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="relative z-10 p-4 space-y-4">
        {/* Batch 31: منتقي الشهر — قابل للضغط */}
        <button
          onClick={() => setShowMonthPicker(true)}
          className="w-full bg-white rounded-2xl border border-tw-line shadow-sm p-3 flex items-center justify-between"
        >
          <div className="text-right flex-1">
            <p className="text-tw-navy font-bold text-sm">{formatMonthLabel(month, 'ar')}</p>
            <p className="text-tw-muted/70 text-[11px] mt-1">إيجار + رواتب + تأمينات GOSI لكل فرع</p>
          </div>
          <ChevronDown size={16} className="text-tw-muted" />
        </button>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-tw-muted/50" /></div>
        ) : (
          <>
            {renderBranchCard('فرع تويا', toia, setToia)}
            {renderBranchCard('فرع وردانة', wardana, setWardana)}

            {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
            {done && (
              <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> تم الحفظ
              </p>
            )}

            <div
              className="text-white p-4 rounded-2xl flex items-center justify-between relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #082765 0%, #061742 60%, #1E3A8A 100%)',
                boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
              }}
            >
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
              />
              <small className="relative text-xs opacity-95 font-bold">إجمالي المصاريف الثابتة الشهرية</small>
              <b className="relative text-xl font-extrabold flex items-center gap-1.5">
                {totalFixed.toLocaleString()} <SarSymbol className="text-base" />
              </b>
            </div>

            <div className="tw-btn-row pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="tw-btn"
                type="button"
                style={{ flex: 1 }}
              >
                {saving && <Loader2 size={18} className="animate-spin inline-block ml-1" />}
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Batch 31: BottomSheet لاختيار الشهر — من ماي 2024 للحالي */}
      <BottomSheet
        open={showMonthPicker}
        title="اختر الشهر"
        options={getAvailableMonths().map((m) => ({ value: m, label: formatMonthLabel(m, 'ar') }))}
        current={month}
        onPick={(v) => { setMonth(v); setShowMonthPicker(false); }}
        onClose={() => setShowMonthPicker(false)}
      />
    </div>
  );
}

// ==========================================
// شاشة إدارة التصنيفات
// ==========================================
function ManageCategories({ onBack }) {
  useScreenHeader('التصنيفات', onBack);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newReq, setNewReq] = useState(false);
  const [newType, setNewType] = useState('general');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCats(await getCategories()); }
    catch (err) { setError(err?.message || 'تعذّر التحميل'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getCategories();
        if (!cancelled) setCats(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر التحميل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleRequires = async (cat) => {
    setBusyId(cat.id);
    setError('');
    try {
      await setCategoryRequiresImage(cat.id, !cat.requiresImage);
      setCats((prev) => prev.map((c) => c.id === cat.id ? { ...c, requiresImage: !c.requiresImage } : c));
    } catch (err) {
      setError(err?.message || 'تعذّر التحديث');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (cat) => {
    if (!confirm(`حذف تصنيف "${cat.name}"؟ السجلات القديمة لن تتأثر.`)) return;
    setBusyId(cat.id);
    try {
      await deleteCategory(cat.id);
      setCats((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      setError(err?.message || 'تعذّر الحذف');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    setError('');
    if (!newName.trim()) { setError('أدخل اسم التصنيف'); return; }
    setSaving(true);
    try {
      await addCategory({ name: newName, requiresImage: newReq, expenseType: newType });
      setNewName(''); setNewReq(false); setNewType('general');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err?.message || 'تعذّر الإضافة');
    } finally {
      setSaving(false);
    }
  };

  // Batch 11: تحريك تصنيف لأعلى/أسفل القائمة
  const moveCategory = async (catId, direction) => {
    const idx = cats.findIndex((c) => c.id === catId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= cats.length) return;

    // تحديث محلي فوري (optimistic)
    const newCats = [...cats];
    [newCats[idx], newCats[targetIdx]] = [newCats[targetIdx], newCats[idx]];
    setCats(newCats);

    // حفظ على Firestore
    setBusyId(catId);
    setError('');
    try {
      await reorderCategories(newCats.map((c) => c.id));
    } catch (err) {
      setError(err?.message || 'تعذّر تحديث الترتيب');
      // rollback
      await load();
    } finally {
      setBusyId(null);
    }
  };

  // Batch 22: ترتيب بالسحب — يدعم desktop (mouse) و mobile (touch long-press)
  const catDrag = useDragSort(cats, setCats, async (finalCats) => {
    try {
      await reorderCategories(finalCats.map((c) => c.id));
    } catch (err) {
      setError(err?.message || 'تعذّر تحديث الترتيب');
      await load();
    }
  });

  return (
    <div
      className="min-h-full relative overflow-hidden pb-20"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      <div className="relative z-10 p-4 space-y-3">
        {/* زر إضافة تصنيف — gradient navy */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
              boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
            }}
          >
            <Plus size={18} /> + إضافة تصنيف
          </button>
        )}

        {/* form إضافة تصنيف جديد */}
        {showForm && (
          <div className="bg-white border border-tw-blue/30 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="font-bold text-sm text-tw-navy">تصنيف جديد</h3>
            <input
              type="text"
              placeholder="اسم التصنيف (مثل: كهرباء)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue"
            />

            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">نوع المصروف (لتقارير المدير)</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm font-bold outline-none focus:border-tw-blue"
              >
                <option value="general">عام</option>
                <option value="flower">ورد</option>
                <option value="delivery">توصيل</option>
                <option value="customerOrders">طلبات عملاء</option>
                <option value="supplies">مستلزمات وبضائع</option>
                <option value="marketing">تسويق</option>
              </select>
            </div>

            <label className="flex items-center justify-between bg-tw-soft/40 border border-tw-line rounded-xl p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newReq}
                onChange={(e) => setNewReq(e.target.checked)}
                className="w-5 h-5 accent-blue-600"
              />
              <span className="text-sm font-bold text-tw-navy">صورة الفاتورة إجبارية</span>
            </label>

            {error && (
              <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-2 text-center">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setError(''); }}
                className="flex-1 bg-white border border-tw-line text-tw-navy font-bold py-2.5 rounded-xl text-sm hover:bg-tw-soft/40"
              >
                إلغاء
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)' }}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'جارٍ...' : 'حفظ'}
              </button>
            </div>
          </div>
        )}

        {!showForm && error && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>
        )}

        {/* قائمة التصنيفات — تصميم prototype مع toggles خضراء */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-tw-muted/50" />
          </div>
        ) : (
          <div className="space-y-3">
            {cats.map((cat, idx) => (
              <div
                key={cat.id}
                {...catDrag.itemProps(idx)}
                className={`bg-white border border-tw-line rounded-2xl p-4 flex items-center gap-3 shadow-sm transition-all ${
                  catDrag.isDragging(idx) ? 'opacity-50 scale-[0.98]' : ''
                }`}
              >
                {/* Toggle موحّد بنفس تصميم التنبيهات والإشعارات */}
                <button
                  onClick={() => toggleRequires(cat)}
                  disabled={busyId === cat.id}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    cat.requiresImage ? 'bg-tw-green' : 'bg-gray-300'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      cat.requiresImage ? 'right-0.5' : 'right-[26px]'
                    }`}
                  />
                </button>

                {/* النص + نقطة ملوّنة */}
                <div className="flex-1 text-right">
                  <p className="font-bold text-base text-tw-navy mb-1">{translateCategory('ar', cat.name)}</p>
                  <p className="text-xs text-tw-muted flex items-center gap-1.5 justify-end">
                    <span>{cat.requiresImage ? 'صورة إجبارية' : 'صورة اختيارية'}</span>
                    <span className={`w-2 h-2 rounded-full ${cat.requiresImage ? 'bg-tw-red' : 'bg-gray-300'}`}></span>
                  </p>
                </div>

                {/* Batch 22: مقبض السحب — يدعم touch (long-press) + mouse drag */}
                <div
                  {...catDrag.handleProps(idx)}
                  className="p-2 text-tw-muted/60 cursor-grab active:cursor-grabbing flex-shrink-0"
                  title="اسحب لإعادة الترتيب"
                  aria-label="drag handle"
                >
                  <GripVertical size={18} strokeWidth={2} />
                </div>

                {/* زر الحذف صغير */}
                <button
                  onClick={() => handleDelete(cat)}
                  disabled={busyId === cat.id}
                  className="p-2 text-tw-red hover:bg-red-50 rounded-lg disabled:opacity-50 flex-shrink-0"
                  title="حذف"
                >
                  {busyId === cat.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// شاشة تغيير رمز المدير لنفسه
// ==========================================
function ChangeMyPin({ onBack }) {
  useScreenHeader('تغيير الرمز السري', onBack);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError(''); setDone(false);
    if (!/^\d{4}$/.test(currentPin)) { setError('الرمز الحالي يجب أن يكون 4 أرقام'); return; }
    if (!/^\d{4}$/.test(newPin)) { setError('الرمز الجديد يجب أن يكون 4 أرقام'); return; }
    if (newPin !== confirmPin) { setError('الرمز الجديد لا يطابق التأكيد'); return; }
    if (newPin === currentPin) { setError('الرمز الجديد يجب أن يختلف عن الحالي'); return; }
    setSaving(true);
    try {
      await changeMyPin(currentPin, newPin);
      setDone(true);
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setError('الرمز الحالي غير صحيح');
      } else if (code.includes('too-many-requests')) {
        setError('محاولات كثيرة، حاول بعد قليل');
      } else {
        setError(err?.message || 'تعذّر تغيير الرمز');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white pb-20">
      <div className="p-6 space-y-4 flex-1">
        <div className="bg-tw-soft border border-tw-line rounded-xl p-3 text-center">
          <Key size={20} className="text-tw-blue mx-auto mb-2" />
          <p className="text-tw-navy2 font-bold text-sm">تحديث الرمز السري لحسابك</p>
          <p className="text-tw-blue text-[11px] mt-1">سيتم التحقق من الرمز الحالي قبل التغيير</p>
        </div>

        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">الرمز الحالي</label>
          <input type="password" inputMode="numeric" maxLength={4} value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            className="w-full p-4 bg-tw-soft/40 border border-tw-line rounded-xl text-center tracking-[0.5em] font-mono text-lg outline-none focus:border-tw-blue" />
        </div>
        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">الرمز الجديد</label>
          <input type="password" inputMode="numeric" maxLength={4} value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            className="w-full p-4 bg-tw-soft/40 border border-tw-line rounded-xl text-center tracking-[0.5em] font-mono text-lg outline-none focus:border-tw-blue" />
        </div>
        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">تأكيد الرمز الجديد</label>
          <input type="password" inputMode="numeric" maxLength={4} value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            className="w-full p-4 bg-tw-soft/40 border border-tw-line rounded-xl text-center tracking-[0.5em] font-mono text-lg outline-none focus:border-tw-blue" />
        </div>

        {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم تغيير الرمز بنجاح
          </p>
        )}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-tw-blue text-white font-bold py-4 rounded-xl shadow-md hover:bg-tw-blue disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'جارٍ التحديث...' : 'حفظ الرمز الجديد'}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// شاشة "المبيعات والمصروفات" للمدير (Batch 12)
// ==========================================
// - بدون شاشة اختيار فرع منفصلة
// - يفتح مباشرة على شاشة الزرّين + قائمة آخر 7 أيام
// - فرع تويا افتراضياً (للمدير)
// - الفرع يُغيَّر من داخل النماذج عبر pill قابل للنقر → bottom sheet
// - كل سطر في القائمة فيه ✎ تعديل + 🗑 حذف (للمدير فقط)
function AdminDataEntry({ onBack }) {
  const [step, setStep] = useState('home');
  // Batch 41: نُجبر إعادة تسجيل الـ header عند تغيّر step
  // (عند العودة لـ home بعد فتح salesForm، الـ ctx يكون null)
  const headerTitle = step === 'home' ? 'المبيعات والمصاريف' : null;
  useScreenHeader(headerTitle, onBack);
  
  const [chosenBranch, setChosenBranch] = useState('all');
  // Batch 41: branchSheetOpen لـ شاشة home (اختيار فرع للسجل)
  const [homeBranchSheetOpen, setHomeBranchSheetOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bs = await getBranches();
        if (!cancelled) setBranches(bs);
      } catch {
        if (!cancelled) setBranches([{ id: 'toia', name: 'تويا' }, { id: 'wardana', name: 'وردانة' }]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const branchName = branches.find((b) => b.id === chosenBranch)?.name
    || (chosenBranch === 'wardana' ? 'وردانة' : 'تويا');

  const setView = (v) => {
    if (v === 'salesForm' || v === 'expenseForm') {
      // Batch 41: لو 'all' (افتراضي للمدير)، نختار توياً عند فتح النموذج
      // المستخدم يقدر يغيّره من البـ pill داخل النموذج
      if (chosenBranch === 'all') setChosenBranch('toia');
      setStep(v);
    }
    else if (v === 'employeeHome' || v === 'home') {
      setStep('home');
      setEditingRecord(null);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleBranchChange = (newBranchId) => {
    setChosenBranch(newBranchId);
  };

  const handleEdit = (entry) => {
    setEditingRecord(entry);
    // Batch 41: لو السجل من فرع مختلف عن المختار حالياً، نُحدّث chosenBranch
    // ليتطابق مع السجل الذي يُعدَّل (مهم عند "كل الفروع")
    if (entry.branchId && entry.branchId !== chosenBranch) {
      setChosenBranch(entry.branchId);
    }
    if (entry.kind === 'sale') setStep('editSalesForm');
    else setStep('editExpenseForm');
  };

  const handleDeleteRequest = (entry) => {
    setDeleteError('');
    setDeletingRecord(entry);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecord) return;
    setDeleteError('');
    try {
      if (deletingRecord.kind === 'sale') {
        await deleteDailySales(deletingRecord.id);
      } else {
        await deleteExpense(deletingRecord.id);
      }
      setDeletingRecord(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setDeleteError(err?.message || 'تعذّر الحذف');
      throw err;
    }
  };

  if (step === 'home') {
    return (
      <>
        <div className="flex flex-col h-full tw-page-bg">
          <div
            className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
          />

          <div className="relative z-10 flex-1 overflow-y-auto p-4 pb-24">
            {/* Batch 41: pill اختيار الفرع لتصفية سجل آخر 7 أيام */}
            <button
              type="button"
              onClick={() => setHomeBranchSheetOpen(true)}
              className="tw-pill"
              style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}
            >
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-tw-blue" />
                <span style={{ fontWeight: 800, fontSize: 13 }}>
                  {chosenBranch === 'all' ? 'كل الفروع' : `فرع ${branchName}`}
                </span>
              </span>
              <ChevronDown size={14} className="text-tw-muted/70" />
            </button>

            <div
              className="tw-card tw-action"
              onClick={() => setView('salesForm')}
              role="button"
              tabIndex={0}
              style={{ marginBottom: 10 }}
            >
              <div className="tw-action-icon">
                <TrendingUp />
              </div>
              <div>
                <h4>تسجيل المبيعات</h4>
                <p>إجمالي المبيعات اليومية</p>
              </div>
              <div className="arrow">‹</div>
            </div>

            <div
              className="tw-card tw-action"
              onClick={() => setView('expenseForm')}
              role="button"
              tabIndex={0}
              style={{ marginBottom: 10 }}
            >
              <div className="tw-action-icon">
                <Receipt />
              </div>
              <div>
                <h4>تسجيل المصروفات</h4>
                <p>فواتير ومصروفات أخرى</p>
              </div>
              <div className="arrow">‹</div>
            </div>

            <RecHistorySection
              branchId={chosenBranch}
              lang="ar"
              refreshKey={refreshKey}
              editable={true}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
            />

            {deleteError && (
              <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mt-3">
                {deleteError}
              </p>
            )}
          </div>
        </div>

        <DeleteConfirmSheet
          open={!!deletingRecord}
          title={deletingRecord?.kind === 'sale' ? 'حذف هذه المبيعة؟' : 'حذف هذا المصروف؟'}
          message="لا يمكن التراجع عن هذا الإجراء."
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeletingRecord(null)}
          lang="ar"
        />

        {/* Batch 41: bottom sheet اختيار الفرع لتصفية سجل آخر 7 أيام */}
        <BottomSheet
          open={homeBranchSheetOpen}
          title="اختر الفرع"
          options={[
            { value: 'all', label: 'كل الفروع' },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
          current={chosenBranch}
          onPick={(v) => {
            setChosenBranch(v);
            setHomeBranchSheetOpen(false);
          }}
          onClose={() => setHomeBranchSheetOpen(false)}
        />
      </>
    );
  }

  if (step === 'salesForm' || step === 'editSalesForm') {
    return (
      <SalesFormV2
        setView={setView}
        branch={branchName}
        branchId={chosenBranch}
        lang="ar"
        allowBranchSwitch={true}
        onBranchChange={handleBranchChange}
        existingRecord={step === 'editSalesForm' ? editingRecord : null}
        onBack={() => setStep('home')}
      />
    );
  }

  if (step === 'expenseForm' || step === 'editExpenseForm') {
    return (
      <ExpenseFormV2
        setView={setView}
        branch={branchName}
        branchId={chosenBranch}
        lang="ar"
        allowBranchSwitch={true}
        onBranchChange={handleBranchChange}
        existingRecord={step === 'editExpenseForm' ? editingRecord : null}
        isAdmin={true}
        onBack={() => setStep('home')}
      />
    );
  }

  return null;
}
