import { useState, useEffect } from 'react';
import {
  Settings, Loader2,
  Home, List, Activity, MessageCircle, LogOut,
} from 'lucide-react';
import {
  logout, watchAuth,
  saveUserLanguage,
  markActive,
} from './firebase';
import { dirFor, readSavedLang, saveLangLocal, translateBranch } from './i18n';
import { clearAllPersistedState } from './hooks/usePersistedState';
import { clearAllCache } from './hooks/useCachedQuery';
import { ScreenCtxContext } from './context/ScreenCtx';
// شاشات الموظف
import LoginView from './components/LoginView';
import EmployeeHome from './components/EmployeeHome';
import SalesFormV2 from './components/SalesFormV2';
import ExpenseFormV2 from './components/ExpenseFormV2';
import WhatsappFormV2 from './components/WhatsappFormV2';
import ReviewsExplain from './components/ReviewsExplain';
import WhatsappExplain from './components/WhatsappExplain';
import EmployeeHistory from './components/EmployeeHistory';
// شاشات المدير
import ManagerHome from './components/ManagerHome';
import ManagerMonthly from './components/ManagerMonthly';
import ManagerWhatsapp from './components/ManagerWhatsapp';
import ManagerKpis from './components/ManagerKpis';
import AdminSettingsV2 from './components/AdminSettingsV2';
import ManageUsers from './components/ManageUsers';
import ManageFixedExpenses from './components/ManageFixedExpenses';
import ManageCategories from './components/ManageCategories';
import ChangeMyPin from './components/ChangeMyPin';
import AdminDataEntry from './components/AdminDataEntry';
// عناصر مشتركة (هيدر + overlays)
import AppHeader from './components/AppHeader';
import NotificationsCenter, { getUnreadCount } from './components/NotificationsCenter';
import ManagerReceipts from './components/ManagerReceipts';
import LogoutConfirmSheet from './components/LogoutConfirmSheet';
import ProfileMenuSheet from './components/ProfileMenuSheet';

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
  // Batch 51: سجل معلّق للتعديل (من شاشة الكشف الشامل)
  const [pendingEditRecord, setPendingEditRecord] = useState(null);

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

  // Batch 56: تجديد ختم النشاط أثناء استخدام التطبيق (لعدّاد خمول الـ 30 يوم)
  useEffect(() => {
    if (!user) return;
    markActive();
    const onActive = () => markActive();
    const onVisible = () => { if (!document.hidden) markActive(); };
    window.addEventListener('focus', onActive);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(markActive, 5 * 60 * 1000); // كل 5 دقائق
    return () => {
      window.removeEventListener('focus', onActive);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [user]);

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

  // Batch 59: هل يظهر الشريط الجانبي (تابلت/مكتب)؟ نفس شرط الشريط السفلي
  const hasSideNav = userRole === 'admin' && currentView === 'adminHome' && !authLoading;

  return (
    <ScreenCtxContext.Provider value={{ setScreenCtx }}>
    <div className={`${pageAlign}`}
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
        className={`tw-app-frame w-full h-full overflow-hidden flex flex-col relative
                   ${hasSideNav ? 'md:pr-[76px] lg:pr-[248px]' : ''}`}
        style={{
          /* Batch 20: ارتفاع ديناميكي ثابت — يحل خلل صعود/نزول الهيدر والبوتوم على iOS */
          /* Batch 59: أُزيل إطار الجوال الوهمي — تخطيط متجاوب حقيقي للتابلت والمكتب */
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
              onNotifClick={() => setShowNotifications(true)}
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
        {/* Batch 59: حاوية عرض أقصى — المحتوى لا يتمدد بلا نهاية على الشاشات الكبيرة */}
        <div className="mx-auto w-full max-w-[1180px] min-h-full">
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
            <EmployeeHome setView={setCurrentView} branch={branch} branchId={branchId} lang={lang} />
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
          {!authLoading && currentView === 'adminHome' && adminTab === 'monthly' && (
            <ManagerMonthly
              lang="ar"
              onEditRecord={(rec) => {
                // Batch 51: انتقل لتبويب الإعدادات → AdminDataEntry → تعديل
                setPendingEditRecord(rec);
                setAdminTab('settings');
              }}
            />
          )}
          {!authLoading && currentView === 'adminHome' && adminTab === 'whatsapp' && <ManagerWhatsapp lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'kpis' && <ManagerKpis lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'settings' && (
            <AdminSettingsV2
              lang="ar"
              ManageUsersComponent={ManageUsers}
              ManageFixedExpensesComponent={ManageFixedExpenses}
              ManageCategoriesComponent={ManageCategories}
              AdminDataEntryComponent={AdminDataEntry}
              pendingEditRecord={pendingEditRecord}
              onPendingConsumed={() => setPendingEditRecord(null)}
            />
          )}
        </div>
        </main>

        {userRole === 'admin' && currentView === 'adminHome' && !authLoading && (
          <nav
            className="flex items-center px-2 z-10 flex-shrink-0 md:hidden"
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

        {/* Batch 59: شريط جانبي للتابلت (أيقونات) والمكتب (أيقونات + نصوص) — يحل محل الشريط السفلي */}
        {hasSideNav && (
          <aside
            className="hidden md:flex fixed top-0 bottom-0 right-0 z-20 flex-col bg-white w-[76px] lg:w-[248px] py-5 px-2 lg:px-4"
            style={{ borderLeft: '1px solid rgba(230,236,246,0.9)', fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
          >
            {/* الشعار + اسم المستخدم */}
            <div className="flex items-center justify-center lg:justify-start gap-2.5 mb-8 px-1">
              <div className="w-10 h-10 rounded-xl bg-tw-blue text-white flex items-center justify-center font-extrabold text-sm flex-shrink-0">
                TW
              </div>
              <div className="hidden lg:block min-w-0">
                <p className="text-sm font-extrabold text-tw-navy leading-tight">Toia &amp; Wardana</p>
                <p className="text-[11px] text-tw-muted truncate">
                  {user?.displayName || user?.username || 'المدير'}
                </p>
              </div>
            </div>
            {/* التبويبات */}
            <div className="flex flex-col gap-1 flex-1">
              {[
                { key: 'home',     icon: Home,          label: 'الرئيسية' },
                { key: 'monthly',  icon: List,          label: 'الكشف الشامل' },
                { key: 'whatsapp', icon: MessageCircle, label: 'عملاء واتساب' },
                { key: 'kpis',     icon: Activity,      label: 'المؤشرات' },
                { key: 'settings', icon: Settings,      label: 'الإعدادات' },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = adminTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setAdminTab(tab.key)}
                    title={tab.label}
                    type="button"
                    className={`flex items-center justify-center lg:justify-start gap-3 rounded-xl px-3 py-3 transition-colors ${
                      active ? 'bg-tw-blue text-white shadow-sm' : 'text-[#8A96AA] hover:bg-tw-soft hover:text-tw-navy'
                    }`}
                  >
                    <Icon size={20} strokeWidth={active ? 2.4 : 2} className="flex-shrink-0" />
                    <span className="hidden lg:block text-[13px] font-bold whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            {/* تسجيل الخروج */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title="تسجيل الخروج"
              type="button"
              className="flex items-center justify-center lg:justify-start gap-3 rounded-xl px-3 py-3 text-tw-red/80 hover:bg-red-50 transition-colors"
            >
              <LogOut size={20} className="flex-shrink-0" />
              <span className="hidden lg:block text-[13px] font-bold">تسجيل الخروج</span>
            </button>
          </aside>
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
