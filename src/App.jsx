import React, { useState, useMemo, useEffect, createContext, useContext } from 'react';
import {
  Receipt, TrendingUp, TrendingDown,
  Settings, Camera, ChevronRight, ChevronUp, ChevronDown, Building2,
  BarChart3, Wallet, UploadCloud,
  Calendar, Globe, Store, PieChart, Activity, CreditCard,
  ShoppingCart, Car, Megaphone, Layers, Loader2, Users, Plus, CheckCircle2,
  Key, UserX, UserCheck, Trash2, Edit3,
  Home, List, GripVertical
} from 'lucide-react';
import {
  login, logout, watchAuth,
  addDailySales, addExpense,
  getSales, getExpenses, getFixedExpenses, setFixedExpense,
  getUsers, createStaffUser, uploadInvoiceImage,
  getCategories, setCategoryRequiresImage, addCategory, deleteCategory, reorderCategories,
  changeMyPin, setUserActive, adminChangeUserPin, adminDeleteUser, adminUpdateUserProfile,
  getBranches, getPaymentMethods,
  madaFees, madaNet, MADA_FEE_RATE,
  saveUserLanguage,
  getMonthlyGoal, setMonthlyGoal, getAllGoalsForMonth,
  addBranch, deleteBranch, updateBranch,
  // Batch 12: admin edit/delete for sales & expenses
  deleteDailySales, deleteExpense,
} from './firebase';
import { t, translateCategory, translateBranch, translatePM, dirFor, readSavedLang, saveLangLocal } from './i18n';
import SarSymbol from './components/SarSymbol';
import ManagerHome from './components/ManagerHome';
import ManagerMonthly from './components/ManagerMonthly';
import ManagerOverview from './components/ManagerOverview';
import ManagerKpis from './components/ManagerKpis';
import SalesFormV2 from './components/SalesFormV2';
import ExpenseFormV2 from './components/ExpenseFormV2';
import EmployeeHistory from './components/EmployeeHistory';
// Batch 12
import RecHistorySection from './components/RecHistorySection';
import DeleteConfirmSheet from './components/DeleteConfirmSheet';
// Batch 13
import ProfileMenuSheet from './components/ProfileMenuSheet';
// Admin settings + Goals + Branches (Batch 3)
import AdminSettingsV2 from './components/AdminSettingsV2';
// Batch 5: Notifications + Receipts + Logout confirm
import NotificationsCenter, { addNotification } from './components/NotificationsCenter';
import ManagerReceipts from './components/ManagerReceipts';
import LogoutConfirmSheet from './components/LogoutConfirmSheet';
// Batch 6: Generic edit sheet for full forms
import EditSheet from './components/EditSheet';
// Batch 7: New unified white header
import AppHeader from './components/AppHeader';

// ==========================================
// أدوات تواريخ مساعدة
// ==========================================
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = (d = new Date()) => d.toISOString().slice(0, 7); // YYYY-MM

// يحسب نطاق التاريخ حسب الفترة المختارة
// يدعم: يومي / أسبوعي / شهري / ربع سنوي / سنوي / مخصص
function periodRange(period, customFrom, customTo) {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
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
 */
export function useScreenHeader(title, onBack) {
  const { setScreenCtx } = useContext(ScreenCtxContext);
  useEffect(() => {
    if (title) setScreenCtx({ title, onBack });
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
    <div className={`min-h-screen md:flex md:items-center md:justify-center md:p-4 ${pageAlign}`}
         dir={pageDir}
         style={{
           fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif",
           background: '#0A1535', // الخلفية خارج phone-frame (ديسكتوب)
         }}>
      <div
        id="tw-app-frame"
        className="tw-app-frame w-full overflow-hidden flex flex-col relative
                   h-screen
                   md:h-[850px] md:max-w-md md:rounded-[2.5rem]
                   md:shadow-[0_20px_50px_rgba(8,_112,_184,_0.25)]
                   md:border-8 md:border-slate-900"
        style={{
          /* تدرج موحّد من أعلى الجوال إلى الأسفل — يبيّن أن التطبيق قطعة واحدة */
          background: `
            radial-gradient(circle at 4% 6%, rgba(0,91,255,0.10), transparent 22%),
            radial-gradient(circle at 96% 4%, rgba(40,223,255,0.10), transparent 22%),
            linear-gradient(180deg, #EAF2FF 0%, #F2F8FF 35%, #F7FAFF 65%, #FFFFFF 100%)
          `,
        }}
      >

        {currentView !== 'login' && !authLoading && (
          <AppHeader
            mode={screenCtx ? 'screen' : 'home'}
            screenTitle={screenCtx?.title}
            onBack={screenCtx?.onBack}
            greeting={
              isAdmin
                ? `مرحباً، ${user?.displayName || user?.username || 'المدير'}`
                : `مرحباً، ${branchId === 'wardana' ? 'وردانة' : 'تويا'}`
            }
            notifCount={isAdmin ? 2 : 0}
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
        )}

        <main
          className="flex-1 overflow-y-auto pb-24"
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
            <ExpenseFormV2 setView={setCurrentView} branch={branch} branchId={branchId} lang={lang} />
          )}
          {!authLoading && currentView === 'employeeHistory' && (
            <EmployeeHistory setView={setCurrentView} branchId={branchId} lang={lang} />
          )}
          {/* ====== شاشات المدير — مطابقة لتجربة الـ prototype ====== */}
          {!authLoading && currentView === 'adminHome' && adminTab === 'home' && <ManagerHome lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'monthly' && <ManagerMonthly lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'overview' && <ManagerOverview lang="ar" />}
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
          {/* Dashboard القديم: متاح للرجوع إن أردت — adminTab === 'dashboard' */}
          {!authLoading && currentView === 'adminHome' && adminTab === 'dashboard' && <SuperAdminDashboard />}
        </main>

        {userRole === 'admin' && currentView === 'adminHome' && !authLoading && (
          <nav
            className="absolute bottom-0 left-0 right-0 flex items-center px-2 py-2 pb-5 md:pb-3 z-10"
            style={{
              background: 'rgba(255, 255, 255, 0.78)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderTop: '1px solid rgba(230, 236, 246, 0.6)',
              boxShadow: '0 -8px 24px rgba(6, 23, 66, 0.06)',
              fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif",
            }}
          >
            {/*
              في RTL، أول عنصر بالـ array يظهر يمين.
              ترتيب جديد (يمين → يسار):
                كشف / نظرة عامة / الرئيسية / المؤشرات / الإعدادات
            */}
            {[
              { key: 'monthly',  icon: List,       label: 'كشف' },
              { key: 'overview', icon: PieChart,   label: 'نظرة عامة' },
              { key: 'home',     icon: Home,       label: 'الرئيسية' },
              { key: 'kpis',     icon: Activity,   label: 'المؤشرات' },
              { key: 'settings', icon: Settings,   label: 'الإعدادات' },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = adminTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setAdminTab(tab.key)}
                  className={`flex flex-col items-center justify-center flex-1 py-1.5 gap-1 transition-colors ${
                    active ? 'text-tw-blue' : 'text-[#8A96AA] hover:text-tw-navy2'
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  <span className="text-[11px] font-bold leading-none">
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

// ==========================================
// لوحة المدير الشاملة — تقرأ بيانات حقيقية من Firestore
// ==========================================
function SuperAdminDashboard() {
  const [period, setPeriod] = useState('شهري');
  const [activeReport, setActiveReport] = useState('overview');
  const [branchFilter, setBranchFilter] = useState('all'); // all | toia | wardana
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState({ sales: [], expenses: [], fixed: [] });

  // نطاق تاريخ مخصص
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { from, to } = periodRange(period, customFrom, customTo);
        const [sales, expenses, fixed] = await Promise.all([
          getSales(from, to),
          getExpenses(from, to),
          getFixedExpenses(monthStr()),
        ]);
        if (!cancelled) setRaw({ sales, expenses, fixed });
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل البيانات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [period, customFrom, customTo]);

  const m = useMemo(() => {
    const { days, daysInMonth, periodKind } = periodRange(period, customFrom, customTo);

    const blank = () => ({
      sales: 0, cash: 0, mada: 0, transfer: 0,
      varExp: 0, flowerExp: 0, deliveryExp: 0, marketingExp: 0,
    });
    const branches = { toia: blank(), wardana: blank() };

    for (const s of raw.sales) {
      const b = branches[s.branchId];
      if (!b) continue;
      b.sales += s.total || 0;
      b.cash += s.cash || 0;
      b.mada += s.mada || 0;
      b.transfer += s.transfer || 0;
    }
    for (const e of raw.expenses) {
      const b = branches[e.branchId];
      if (!b) continue;
      const amt = e.amount || 0;
      b.varExp += amt;
      if (e.expenseType === 'flower') b.flowerExp += amt;
      else if (e.expenseType === 'delivery') b.deliveryExp += amt;
      else if (e.expenseType === 'marketing') b.marketingExp += amt;
    }

    const fixedMonthly = { toia: 0, wardana: 0 };
    for (const f of raw.fixed) {
      if (fixedMonthly[f.branchId] !== undefined) fixedMonthly[f.branchId] += f.amount || 0;
    }

    const fixedForPeriod = (fm) => {
      // نصيب الثابتة حسب الفترة (§10.1، §10.2)
      const perDay = fm / (daysInMonth || 30);
      if (periodKind === 'daily') return perDay;
      if (periodKind === 'weekly') return perDay * (days || 7);
      if (periodKind === 'monthly') return fm;
      if (periodKind === 'quarterly') return fm * 3;
      if (periodKind === 'yearly') return fm * 12;
      if (periodKind === 'custom') return perDay * (days || 1);
      return fm;
    };
    const toia = branches.toia, wardana = branches.wardana;
    const toiaFixed = fixedForPeriod(fixedMonthly.toia);
    const wardanaFixed = fixedForPeriod(fixedMonthly.wardana);

    const toiaTotalExp = toia.varExp + toiaFixed;
    const wardanaTotalExp = wardana.varExp + wardanaFixed;
    const toiaProfit = toia.sales - toiaTotalExp;
    const wardanaProfit = wardana.sales - wardanaTotalExp;

    const totalSales = toia.sales + wardana.sales;
    const totalVarExp = toia.varExp + wardana.varExp;
    const totalFixedExp = toiaFixed + wardanaFixed;
    const totalExp = totalVarExp + totalFixedExp;
    const totalProfit = totalSales - totalExp;

    const totalCash = toia.cash + wardana.cash;
    const totalMada = toia.mada + wardana.mada;
    const totalTransfer = toia.transfer + wardana.transfer;

    const onlineSales = totalTransfer;
    const offlineSales = totalCash + totalMada;
    const onlinePerc = totalSales ? Math.round((onlineSales / totalSales) * 100) : 0;
    const offlinePerc = totalSales ? 100 - onlinePerc : 0;

    const toiaFlowerPerc = toia.sales ? ((toia.flowerExp / toia.sales) * 100).toFixed(1) : '0';
    const wardanaFlowerPerc = wardana.sales ? ((wardana.flowerExp / wardana.sales) * 100).toFixed(1) : '0';
    const totalFlowerPerc = totalSales ? (((toia.flowerExp + wardana.flowerExp) / totalSales) * 100).toFixed(1) : '0';

    const safeDays = days || 1;
    // المتوسطات اليومية (§10.3)
    const avgSales = Math.round(totalSales / safeDays);
    const avgExp = Math.round(totalExp / safeDays);
    const avgFlower = Math.round((toia.flowerExp + wardana.flowerExp) / safeDays);
    const avgDelivery = Math.round((toia.deliveryExp + wardana.deliveryExp) / safeDays);
    const avgMarketing = Math.round((toia.marketingExp + wardana.marketingExp) / safeDays);
    const avgCash = Math.round(totalCash / safeDays);
    const avgMada = Math.round(totalMada / safeDays);
    const avgTransfer = Math.round(totalTransfer / safeDays);

    // ✨ "view" حسب فلتر الفرع (طلب #4)
    // يتم استخدامها في تبويبات: نظرة عامة، متوسطات، طرق دفع
    let view;
    if (branchFilter === 'toia') {
      view = {
        label: 'تويا',
        sales: toia.sales, cash: toia.cash, mada: toia.mada, transfer: toia.transfer,
        varExp: toia.varExp, fixedExp: toiaFixed, totalExp: toiaTotalExp,
        profit: toiaProfit, flowerExp: toia.flowerExp, deliveryExp: toia.deliveryExp, marketingExp: toia.marketingExp,
      };
    } else if (branchFilter === 'wardana') {
      view = {
        label: 'وردانة',
        sales: wardana.sales, cash: wardana.cash, mada: wardana.mada, transfer: wardana.transfer,
        varExp: wardana.varExp, fixedExp: wardanaFixed, totalExp: wardanaTotalExp,
        profit: wardanaProfit, flowerExp: wardana.flowerExp, deliveryExp: wardana.deliveryExp, marketingExp: wardana.marketingExp,
      };
    } else {
      view = {
        label: 'الإجمالي',
        sales: totalSales, cash: totalCash, mada: totalMada, transfer: totalTransfer,
        varExp: totalVarExp, fixedExp: totalFixedExp, totalExp: totalExp,
        profit: totalProfit,
        flowerExp: toia.flowerExp + wardana.flowerExp,
        deliveryExp: toia.deliveryExp + wardana.deliveryExp,
        marketingExp: toia.marketingExp + wardana.marketingExp,
      };
    }
    // مؤشرات مشتقّة من view
    view.onlineSales = view.transfer;
    view.offlineSales = view.cash + view.mada;
    view.onlinePerc = view.sales ? Math.round((view.onlineSales / view.sales) * 100) : 0;
    view.offlinePerc = view.sales ? 100 - view.onlinePerc : 0;
    view.flowerPerc = view.sales ? ((view.flowerExp / view.sales) * 100).toFixed(1) : '0';
    view.avgSales = Math.round(view.sales / safeDays);
    view.avgExp = Math.round(view.totalExp / safeDays);
    view.avgFlower = Math.round(view.flowerExp / safeDays);
    view.avgDelivery = Math.round(view.deliveryExp / safeDays);
    view.avgMarketing = Math.round(view.marketingExp / safeDays);
    view.avgCash = Math.round(view.cash / safeDays);
    view.avgMada = Math.round(view.mada / safeDays);
    view.avgTransfer = Math.round(view.transfer / safeDays);

    // ✨ تقسيم الشهر لـ 4 فترات (طلب #6) — يحسب فقط في "شهري"
    let weeklyBreakdown = null;
    if (periodKind === 'monthly') {
      const buckets = [
        { label: 'الربع الأول (1-7)', start: 1, end: 7, sales: 0 },
        { label: 'الربع الثاني (8-15)', start: 8, end: 15, sales: 0 },
        { label: 'الربع الثالث (16-22)', start: 16, end: 22, sales: 0 },
        { label: 'الربع الرابع (23-نهاية)', start: 23, end: 31, sales: 0 },
      ];
      for (const s of raw.sales) {
        if (branchFilter !== 'all' && s.branchId !== branchFilter) continue;
        const d = new Date(s.date);
        const dom = d.getDate();
        const bucket = buckets.find((b) => dom >= b.start && dom <= b.end);
        if (bucket) bucket.sales += s.total || 0;
      }
      weeklyBreakdown = buckets;
    }

    // ✨ تحليل أيام الشهر (طلب #5) — يحسب فقط في "شهري"
    let dailyBreakdown = null;
    if (periodKind === 'monthly') {
      const map = new Map();
      for (const s of raw.sales) {
        if (branchFilter !== 'all' && s.branchId !== branchFilter) continue;
        const dom = new Date(s.date).getDate();
        map.set(dom, (map.get(dom) || 0) + (s.total || 0));
      }
      const expMap = new Map();
      for (const e of raw.expenses) {
        if (branchFilter !== 'all' && e.branchId !== branchFilter) continue;
        const dom = new Date(e.date).getDate();
        expMap.set(dom, (expMap.get(dom) || 0) + (e.amount || 0));
      }
      dailyBreakdown = [];
      for (let d = 1; d <= daysInMonth; d++) {
        dailyBreakdown.push({
          day: d,
          sales: map.get(d) || 0,
          expenses: expMap.get(d) || 0,
        });
      }
    }

    return {
      data: { toia, wardana, days: safeDays },
      toiaFixed, wardanaFixed, toiaTotalExp, wardanaTotalExp,
      toiaProfit, wardanaProfit, totalSales, totalVarExp, totalFixedExp,
      totalExp, totalProfit, totalCash, totalMada, totalTransfer,
      onlineSales, offlineSales, onlinePerc, offlinePerc,
      toiaFlowerPerc, wardanaFlowerPerc, totalFlowerPerc,
      avgSales, avgExp, avgFlower, avgDelivery, avgMarketing,
      avgCash, avgMada, avgTransfer,
      view, weeklyBreakdown, dailyBreakdown,
    };
  }, [raw, period, customFrom, customTo, branchFilter]);

  const profitLabel = (() => {
    if (period === 'يومي') return 'الربحية اليومية';
    if (period === 'أسبوعي') return 'الربحية الأسبوعية';
    if (period === 'شهري') return 'الربحية الشهرية';
    if (period === 'ربع سنوي') return 'ربحية الربع';
    if (period === 'سنوي') return 'الربحية السنوية';
    return 'صافي الربح للفترة';
  })();
  const isEmpty = !loading && m.totalSales === 0 && m.totalExp === 0;

  return (
    <div className="flex flex-col h-full pb-20">
      <div className="bg-white p-4 shadow-sm z-10 sticky top-0 border-b border-tw-line">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-tw-navy font-bold">
            <Calendar size={18} className="text-tw-blue" />
            <span>فترة التقرير:</span>
          </div>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="bg-tw-soft border border-tw-line text-sm font-bold rounded-lg px-3 py-1.5 outline-none focus:border-tw-blue text-tw-blue">
            <option value="يومي">يومي</option>
            <option value="أسبوعي">أسبوعي</option>
            <option value="شهري">شهري (هذا الشهر)</option>
            <option value="ربع سنوي">ربع سنوي</option>
            <option value="سنوي">سنوي</option>
            <option value="مخصص">مخصص (من - إلى)</option>
          </select>
        </div>
        {period === 'مخصص' && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-tw-muted block mb-1">من</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full p-2 bg-tw-soft/40 border border-tw-line rounded-lg text-xs font-mono outline-none focus:border-tw-blue" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-tw-muted block mb-1">إلى</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="w-full p-2 bg-tw-soft/40 border border-tw-line rounded-lg text-xs font-mono outline-none focus:border-tw-blue" />
            </div>
          </div>
        )}

        {/* ✨ فلتر الفرع (طلب #4) */}
        <div className="mt-3 flex gap-1.5">
          {[
            { v: 'all', t: 'الإجمالي', c: 'slate' },
            { v: 'toia', t: 'تويا', c: 'blue' },
            { v: 'wardana', t: 'وردانة', c: 'pink' },
          ].map((b) => (
            <button key={b.v} onClick={() => setBranchFilter(b.v)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                branchFilter === b.v
                  ? b.v === 'all' ? 'bg-slate-900 text-white border-slate-900'
                    : b.v === 'toia' ? 'bg-tw-blue text-white border-blue-600'
                    : 'bg-pink-600 text-white border-pink-600'
                  : 'bg-white text-tw-muted border-tw-line'
              }`}>
              {b.t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border-b border-tw-line px-2 py-3 overflow-x-auto whitespace-nowrap flex gap-2">
        <ReportTab id="overview" current={activeReport} set={setActiveReport} icon={<Activity size={16} />} label="نظرة عامة" />
        <ReportTab id="branches" current={activeReport} set={setActiveReport} icon={<Store size={16} />} label="مقارنة الفروع" />
        <ReportTab id="averages" current={activeReport} set={setActiveReport} icon={<PieChart size={16} />} label="المتوسطات" />
        <ReportTab id="payments" current={activeReport} set={setActiveReport} icon={<Wallet size={16} />} label="طرق الدفع" />
        <ReportTab id="monthDays" current={activeReport} set={setActiveReport} icon={<Calendar size={16} />} label="الشهر بالأيام" />
        <ReportTab id="monthWeeks" current={activeReport} set={setActiveReport} icon={<Layers size={16} />} label="أرباع الشهر" />
        <ReportTab id="kpi" current={activeReport} set={setActiveReport} icon={<Layers size={16} />} label="جدول المؤشرات" />
      </div>

      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-tw-muted/70 gap-3">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm font-bold">جارٍ تحميل البيانات...</p>
        </div>
      )}

      {error && (
        <div className="p-4">
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="p-4 space-y-4">
          {isEmpty && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
              <p className="text-amber-800 font-bold text-sm">لا توجد بيانات لهذه الفترة</p>
              <p className="text-tw-orange text-xs mt-1">سجّل مبيعات ومصاريف من حساب موظف لتظهر هنا</p>
            </div>
          )}

          {activeReport === 'overview' && (
            <div className="space-y-4">
              <div className="bg-slate-900 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-tw-soft0 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
                <p className="text-tw-muted/50 font-bold text-xs mb-2">{profitLabel} — {m.view.label}</p>
                <p className="text-4xl font-bold font-mono text-emerald-400">
                  {Math.round(m.view.profit).toLocaleString()} <SarSymbol className="text-sm text-tw-muted/70" />
                </p>
                <p className="text-[10px] text-tw-muted/70 mt-2 bg-slate-800 w-fit px-2 py-1 rounded">
                  المبيعات − (المصاريف المتغيرة + نصيب الثابتة)
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="المبيعات" value={m.view.sales} icon={<TrendingUp size={16} className="text-tw-green" />} />
                <StatCard label="المصاريف" value={m.view.totalExp} icon={<TrendingDown size={16} className="text-tw-red" />} />
                <StatCard label="م. متغيرة" value={m.view.varExp} icon={<Receipt size={16} className="text-tw-orange" />} />
                <StatCard label="نصيب الثابتة" value={m.view.fixedExp} icon={<Building2 size={16} className="text-indigo-500" />} />
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-tw-line">
                <h3 className="font-bold text-tw-navy mb-4 text-sm flex items-center gap-2">
                  <Globe size={16} className="text-tw-blue" /> قنوات البيع (أون لاين / أوف لاين) — {m.view.label}
                </h3>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-tw-blue">أون لاين: {m.view.onlinePerc}%</span>
                  <span className="text-tw-navy">أوف لاين: {m.view.offlinePerc}%</span>
                </div>
                <div className="h-3 w-full flex rounded-full overflow-hidden mb-3 bg-tw-soft">
                  <div style={{ width: `${m.view.onlinePerc}%` }} className="bg-tw-soft0"></div>
                  <div style={{ width: `${m.view.offlinePerc}%` }} className="bg-slate-300"></div>
                </div>
                <div className="flex justify-between text-[11px] text-tw-muted">
                  <span>التحويلات ({m.view.onlineSales.toLocaleString()})</span>
                  <span>النقد ومدى ({m.view.offlineSales.toLocaleString()})</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-tw-line">
                <h3 className="font-bold text-tw-navy mb-3 text-sm flex items-center gap-2">
                  <ShoppingCart size={16} className="text-pink-500" /> نسبة تكلفة الورد للمبيعات — {m.view.label}
                </h3>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-pink-600 font-mono">{m.view.flowerPerc}%</p>
                  <p className="text-[11px] text-tw-muted/70 mb-1">من إجمالي المبيعات</p>
                </div>
              </div>
            </div>
          )}

          {activeReport === 'branches' && (
            <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
              <div className="bg-tw-soft border-b border-tw-line p-3 font-bold text-sm text-blue-900 flex items-center gap-2">
                <Store size={18} /> مقارنة الأداء ({period})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-white text-tw-muted border-b border-tw-line">
                    <tr>
                      <th className="p-3 font-bold">البيان</th>
                      <th className="p-3 font-bold text-center border-r border-tw-line text-tw-blue">تويا</th>
                      <th className="p-3 font-bold text-center border-r border-tw-line text-tw-blue">وردانة</th>
                      <th className="p-3 font-bold text-center border-r border-tw-line bg-tw-soft/40">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-mono">
                    <CompareRow label="المبيعات" t={m.data.toia.sales} w={m.data.wardana.sales} total={m.totalSales} tone="emerald" bold />
                    <CompareRow label="م. متغيرة" t={m.data.toia.varExp} w={m.data.wardana.varExp} total={m.totalVarExp} tone="red" />
                    <CompareRow label="نصيب الثابتة" t={m.toiaFixed} w={m.wardanaFixed} total={m.totalFixedExp} tone="orange" />
                    <CompareRow label="إجمالي المصاريف" t={m.toiaTotalExp} w={m.wardanaTotalExp} total={m.totalExp} tone="red" />
                    <tr className="bg-emerald-50/40">
                      <td className="p-3 font-bold text-emerald-900 font-sans">صافي الربح</td>
                      <td className="p-3 text-center font-bold text-tw-green">{Math.round(m.toiaProfit).toLocaleString()}</td>
                      <td className="p-3 text-center font-bold text-tw-green border-r border-tw-line">{Math.round(m.wardanaProfit).toLocaleString()}</td>
                      <td className="p-3 text-center font-bold text-emerald-800 border-r border-tw-line bg-emerald-50/60">{Math.round(m.totalProfit).toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-tw-soft/40">
                      <td className="p-3 text-tw-muted font-sans font-bold">تكلفة الورد %</td>
                      <td className="p-3 text-center text-tw-navy font-bold">{m.toiaFlowerPerc}%</td>
                      <td className="p-3 text-center text-tw-navy font-bold border-r border-tw-line">{m.wardanaFlowerPerc}%</td>
                      <td className="p-3 text-center text-tw-navy font-bold border-r border-tw-line bg-tw-soft/40">{m.totalFlowerPerc}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'averages' && (
            <div className="space-y-3">
              <div className="bg-tw-blue text-white p-4 rounded-2xl shadow-md">
                <h3 className="font-bold mb-1 text-sm flex items-center gap-2"><PieChart size={18} /> المتوسطات اليومية — {m.view.label}</h3>
                <p className="text-blue-200 text-xs">محسوبة على أساس {m.data.days} يوم بناءً على فلتر ({period})</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <AverageCard title="متوسط المبيعات" amount={m.view.avgSales} icon={<TrendingUp size={16} className="text-tw-green" />} />
                <AverageCard title="متوسط المصاريف" amount={m.view.avgExp} icon={<TrendingDown size={16} className="text-tw-red" />} />
                <AverageCard title="متوسط الورد" amount={m.view.avgFlower} icon={<ShoppingCart size={16} className="text-pink-500" />} />
                <AverageCard title="متوسط التوصيل" amount={m.view.avgDelivery} icon={<Car size={16} className="text-tw-orange" />} />
                <AverageCard title="متوسط التسويق" amount={m.view.avgMarketing} icon={<Megaphone size={16} className="text-purple-500" />} full />
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md mt-3">
                <h3 className="font-bold mb-1 text-sm flex items-center gap-2"><CreditCard size={18} /> متوسطات طرق الدفع اليومية</h3>
                <p className="text-tw-muted/50 text-xs">قيمة كل وسيلة دفع يومياً ضمن الفترة</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <AverageCard title="Cash" amount={m.view.avgCash} icon={<Wallet size={14} className="text-tw-green" />} />
                <AverageCard title="Mada" amount={m.view.avgMada} icon={<CreditCard size={14} className="text-tw-blue" />} />
                <AverageCard title="Transfer" amount={m.view.avgTransfer} icon={<Globe size={14} className="text-purple-500" />} />
              </div>
            </div>
          )}

          {activeReport === 'payments' && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-tw-line">
              <h3 className="font-bold text-tw-navy mb-5 text-sm flex items-center gap-2">
                <CreditCard size={18} className="text-tw-blue" /> تحليل طرق الدفع — {m.view.label}
              </h3>
              <div className="space-y-5">
                <PaymentBar label="مدى (شبكة)" amount={m.view.mada} total={m.view.sales} color="bg-tw-soft0" />
                <PaymentBar label="تحويل (أون لاين)" amount={m.view.transfer} total={m.view.sales} color="bg-purple-500" />
                <PaymentBar label="نقدي (كاش)" amount={m.view.cash} total={m.view.sales} color="bg-tw-green" />
              </div>
            </div>
          )}

          {/* ✨ تحليل الشهر بالأيام (طلب #5) */}
          {activeReport === 'monthDays' && (
            <div className="space-y-3">
              {!m.dailyBreakdown ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                  <p className="text-amber-800 font-bold text-sm">هذا التحليل متاح فقط في فلتر "شهري"</p>
                  <p className="text-tw-orange text-xs mt-1">بدّل الفلتر فوق إلى "شهري"</p>
                </div>
              ) : (
                <>
                  <div className="bg-tw-green text-white p-4 rounded-2xl shadow-md">
                    <h3 className="font-bold text-sm flex items-center gap-2"><Calendar size={18} /> أيام الشهر — {m.view.label}</h3>
                    <p className="text-emerald-100 text-[11px] mt-1">معرفة الأيام الأقوى والأضعف بيعاً</p>
                  </div>

                  {/* ملخص أفضل/أسوأ يوم */}
                  {(() => {
                    const withSales = m.dailyBreakdown.filter((d) => d.sales > 0);
                    if (!withSales.length) {
                      return (
                        <div className="bg-white border border-tw-line rounded-xl p-5 text-center text-tw-muted/70 text-sm">
                          لا توجد مبيعات مسجّلة في هذا الشهر بعد
                        </div>
                      );
                    }
                    const best = withSales.reduce((a, b) => b.sales > a.sales ? b : a);
                    const worst = withSales.reduce((a, b) => b.sales < a.sales ? b : a);
                    const avg = Math.round(withSales.reduce((s, x) => s + x.sales, 0) / withSales.length);
                    return (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white border border-emerald-100 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-tw-muted/70 font-bold">أقوى يوم</p>
                          <p className="text-lg font-bold text-tw-green font-mono">يوم {best.day}</p>
                          <p className="text-xs font-mono text-tw-green">{best.sales.toLocaleString()}</p>
                        </div>
                        <div className="bg-white border border-tw-line rounded-xl p-3 text-center">
                          <p className="text-[10px] text-tw-muted/70 font-bold">المتوسط</p>
                          <p className="text-lg font-bold text-tw-blue font-mono">{avg.toLocaleString()}</p>
                          <p className="text-[10px] text-tw-muted/70">ريال/يوم</p>
                        </div>
                        <div className="bg-white border border-red-100 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-tw-muted/70 font-bold">أضعف يوم</p>
                          <p className="text-lg font-bold text-tw-red font-mono">يوم {worst.day}</p>
                          <p className="text-xs font-mono text-tw-red">{worst.sales.toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* رسم أعمدة لكل يوم */}
                  <div className="bg-white rounded-2xl shadow-sm border border-tw-line p-4">
                    {(() => {
                      const maxSales = Math.max(1, ...m.dailyBreakdown.map((d) => d.sales));
                      return (
                        <div className="space-y-1.5">
                          {m.dailyBreakdown.map((d) => {
                            const widthPerc = (d.sales / maxSales) * 100;
                            const isMax = d.sales === maxSales && d.sales > 0;
                            return (
                              <div key={d.day} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono w-6 text-tw-muted font-bold text-left">{d.day}</span>
                                <div className="flex-1 bg-tw-soft/40 rounded h-5 overflow-hidden relative">
                                  <div className={`h-full ${isMax ? 'bg-tw-green' : 'bg-blue-400'} rounded transition-all`}
                                    style={{ width: `${widthPerc}%` }} />
                                </div>
                                <span className="text-[10px] font-mono w-20 text-tw-navy font-bold text-left">
                                  {d.sales > 0 ? d.sales.toLocaleString() : '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ✨ تقسيم الشهر لـ 4 فترات (طلب #6) */}
          {activeReport === 'monthWeeks' && (
            <div className="space-y-3">
              {!m.weeklyBreakdown ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                  <p className="text-amber-800 font-bold text-sm">هذا التحليل متاح فقط في فلتر "شهري"</p>
                  <p className="text-tw-orange text-xs mt-1">بدّل الفلتر فوق إلى "شهري"</p>
                </div>
              ) : (
                <>
                  <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-md">
                    <h3 className="font-bold text-sm flex items-center gap-2"><Layers size={18} /> أرباع الشهر — {m.view.label}</h3>
                    <p className="text-indigo-100 text-[11px] mt-1">مبيعات الشهر مقسّمة على 4 أرباع</p>
                  </div>

                  {(() => {
                    const total = m.weeklyBreakdown.reduce((s, b) => s + b.sales, 0);
                    const maxW = Math.max(1, ...m.weeklyBreakdown.map((b) => b.sales));
                    return (
                      <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
                        {m.weeklyBreakdown.map((b, i) => {
                          const widthPerc = (b.sales / maxW) * 100;
                          const sharePerc = total > 0 ? Math.round((b.sales / total) * 100) : 0;
                          return (
                            <div key={i} className="p-4 border-b border-tw-line/60 last:border-0">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-sm text-tw-navy">{b.label}</span>
                                <div className="text-left">
                                  <span className="font-mono font-bold text-tw-navy">{b.sales.toLocaleString()}</span>
                                  <span className="text-[11px] text-tw-muted/70 mr-1">({sharePerc}%)</span>
                                </div>
                              </div>
                              <div className="w-full bg-tw-soft rounded-full h-2.5 overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${widthPerc}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        <div className="bg-tw-soft p-3 flex justify-between font-bold text-sm">
                          <span className="text-tw-navy">إجمالي الشهر:</span>
                          <span className="font-mono text-tw-navy">{total.toLocaleString()} <SarSymbol /></span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {activeReport === 'kpi' && (
            <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
              <div className="bg-slate-900 p-3 font-bold text-sm text-white flex items-center gap-2">
                <Layers size={18} /> جدول المؤشرات الشامل ({period})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-white text-tw-muted border-b border-tw-line">
                    <tr>
                      <th className="p-3 font-bold">المؤشر</th>
                      <th className="p-3 font-bold text-center border-r border-tw-line text-tw-blue">Toia</th>
                      <th className="p-3 font-bold text-center border-r border-tw-line text-tw-blue">Wardana</th>
                      <th className="p-3 font-bold text-center border-r border-tw-line bg-tw-soft/40">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-mono">
                    <CompareRow label="Sales" t={m.data.toia.sales} w={m.data.wardana.sales} total={m.totalSales} tone="emerald" bold />
                    <CompareRow label="Cash" t={m.data.toia.cash} w={m.data.wardana.cash} total={m.totalCash} tone="slate" />
                    <CompareRow label="Mada" t={m.data.toia.mada} w={m.data.wardana.mada} total={m.totalMada} tone="slate" />
                    <CompareRow label="Transfer" t={m.data.toia.transfer} w={m.data.wardana.transfer} total={m.totalTransfer} tone="slate" />
                    <CompareRow label="Online Sales" t={m.data.toia.transfer} w={m.data.wardana.transfer} total={m.onlineSales} tone="blue" />
                    <CompareRow label="Offline Sales" t={m.data.toia.cash + m.data.toia.mada} w={m.data.wardana.cash + m.data.wardana.mada} total={m.offlineSales} tone="slate" />
                    <CompareRow label="Variable Exp." t={m.data.toia.varExp} w={m.data.wardana.varExp} total={m.totalVarExp} tone="red" />
                    <CompareRow label="Fixed Exp. Share" t={m.toiaFixed} w={m.wardanaFixed} total={m.totalFixedExp} tone="orange" />
                    <CompareRow label="Total Expenses" t={m.toiaTotalExp} w={m.wardanaTotalExp} total={m.totalExp} tone="red" />
                    <tr className="bg-emerald-50/40">
                      <td className="p-3 font-bold text-emerald-900 font-sans">Profit</td>
                      <td className="p-3 text-center font-bold text-tw-green">{Math.round(m.toiaProfit).toLocaleString()}</td>
                      <td className="p-3 text-center font-bold text-tw-green border-r border-tw-line">{Math.round(m.wardanaProfit).toLocaleString()}</td>
                      <td className="p-3 text-center font-bold text-emerald-800 border-r border-tw-line bg-emerald-50/60">{Math.round(m.totalProfit).toLocaleString()}</td>
                    </tr>
                    <CompareRow label="Flower Exp." t={m.data.toia.flowerExp} w={m.data.wardana.flowerExp} total={m.data.toia.flowerExp + m.data.wardana.flowerExp} tone="pink" />
                    <CompareRow label="Delivery Fees" t={m.data.toia.deliveryExp} w={m.data.wardana.deliveryExp} total={m.data.toia.deliveryExp + m.data.wardana.deliveryExp} tone="orange" />
                    <CompareRow label="Marketing Exp." t={m.data.toia.marketingExp} w={m.data.wardana.marketingExp} total={m.data.toia.marketingExp + m.data.wardana.marketingExp} tone="purple" />
                    <tr className="hover:bg-tw-soft/40">
                      <td className="p-3 text-tw-muted font-sans font-bold">Flower Cost %</td>
                      <td className="p-3 text-center text-tw-navy font-bold">{m.toiaFlowerPerc}%</td>
                      <td className="p-3 text-center text-tw-navy font-bold border-r border-tw-line">{m.wardanaFlowerPerc}%</td>
                      <td className="p-3 text-center text-tw-navy font-bold border-r border-tw-line bg-tw-soft/40">{m.totalFlowerPerc}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========== مكونات فرعية ==========
function ReportTab({ id, current, set, icon, label }) {
  const active = current === id;
  return (
    <button onClick={() => set(id)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all border ${active ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-tw-muted border-tw-line hover:bg-tw-soft/40'}`}>
      {icon} {label}
    </button>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-tw-muted">{label}</span>
        {icon}
      </div>
      <p className="text-lg font-bold text-tw-navy font-mono">{Math.round(value).toLocaleString()}</p>
    </div>
  );
}

const TONE = {
  emerald: 'text-tw-green', red: 'text-red-400', orange: 'text-orange-400',
  slate: 'text-tw-muted', blue: 'text-tw-blue', pink: 'text-pink-500', purple: 'text-purple-500',
};

function CompareRow({ label, t, w, total, tone = 'slate', bold }) {
  const c = TONE[tone] || TONE.slate;
  return (
    <tr className="hover:bg-tw-soft/40">
      <td className={`p-3 font-sans ${bold ? 'font-bold text-tw-navy' : 'text-tw-muted'}`}>{label}</td>
      <td className={`p-3 text-center ${c} ${bold ? 'font-bold' : ''}`}>{Math.round(t).toLocaleString()}</td>
      <td className={`p-3 text-center ${c} ${bold ? 'font-bold' : ''} border-r border-tw-line`}>{Math.round(w).toLocaleString()}</td>
      <td className={`p-3 text-center ${c} font-bold border-r border-tw-line bg-tw-soft/40`}>{Math.round(total).toLocaleString()}</td>
    </tr>
  );
}

function AverageCard({ title, amount, icon, full }) {
  return (
    <div className={`bg-white p-4 rounded-2xl shadow-sm border border-tw-line ${full ? 'col-span-2 flex justify-between items-center' : 'flex flex-col'}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon} <span className="text-xs font-bold text-tw-muted">{title}</span>
      </div>
      <p className="text-lg font-bold text-tw-navy font-mono">{amount.toLocaleString()}</p>
    </div>
  );
}

function PaymentBar({ label, amount, total, color }) {
  const perc = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span className="font-bold text-tw-navy">{label}</span>
        <div className="text-left">
          <span className="font-mono font-bold text-tw-navy ml-2">{amount.toLocaleString()}</span>
          <span className="text-tw-muted/70">({perc}%)</span>
        </div>
      </div>
      <div className="w-full bg-tw-soft rounded-full h-2.5 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${perc}%` }}></div>
      </div>
    </div>
  );
}

// ==========================================
// شاشة تسجيل الدخول
// ==========================================
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
      className="relative min-h-full flex flex-col px-6 pt-10 pb-8 overflow-hidden"
      style={{
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
      <div className={`relative z-10 flex ${lang === 'en' ? 'justify-end' : 'justify-start'} mb-4`}>
        <button
          onClick={toggleLang}
          className="bg-white/80 backdrop-blur-sm border border-tw-line text-tw-navy px-3.5 py-1.5 rounded-xl shadow-sm hover:bg-white hover:shadow-md transition-all"
          style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.5px' }}
        >
          {lang === 'ar' ? 'EN' : 'ع'}
        </button>
      </div>

      {/* الشعار + اسم التطبيق */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center -mt-4">
        <div
          className="w-44 h-44 mx-auto mb-6 flex items-center justify-center rounded-[2.5rem] shadow-xl relative overflow-hidden"
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
          <svg width="92" height="92" viewBox="0 0 100 100" className="relative z-10" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
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

      {/* النموذج */}
      <div className="relative z-10 space-y-4 mt-2">
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

  // اسم الشهر الحالي بالميلادي (Gregorian) فقط — Batch 16
  const monthLabel = new Date().toLocaleDateString(
    lang === 'en' ? 'en-US' : 'ar-EG', // ar-EG يستخدم الميلادي
    { month: 'long', year: 'numeric' }
  );

  // ====== KPIs الحقيقية من Firestore ======
  const [kpis, setKpis] = useState({ budgetPct: 0, reviewsPct: 0, loaded: false });
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
        const [goal, allSales] = await Promise.all([
          getMonthlyGoal(branchId, monthStr),
          getSales(from, to),
        ]);
        const branchSales = allSales.filter((s) => s.branchId === branchId);
        const totalSales = branchSales.reduce((sum, s) => sum + (s.total || 0), 0);
        const budgetPct = goal.budget > 0
          ? Math.min(100, Math.round((totalSales / goal.budget) * 100))
          : 0;
        // التقييمات المُحقّقة من Firestore (Batch 16)
        const reviewsAchieved = Number(goal.reviewsAchieved) || 0;
        const reviewsTarget = Number(goal.reviewsTarget) || 0;
        const reviewsPct = reviewsTarget > 0
          ? Math.min(100, Math.round((reviewsAchieved / reviewsTarget) * 100))
          : 0;
        if (!cancelled) {
          setKpis({ budgetPct, reviewsPct, loaded: true, hasGoal: goal.exists });
        }
      } catch {
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

      {/* الكروت الأربعة — موزّعة بشكل متوازن (flex-1 لكل واحد) */}
      <div className="relative z-10 flex-1 flex flex-col gap-3">
        {/* كارت تحقيق الميزانية */}
        <div
          className="flex-1 text-white p-4 rounded-2xl overflow-hidden relative flex flex-col justify-center"
          style={{
            background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
            boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
            minHeight: 90,
          }}
        >
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
          />
          <div className="relative">
            <p className="text-center text-xs font-semibold opacity-95 mb-1.5">
              {t(lang, 'home.kpiBudget') || 'نسبة تحقيق الميزانية'}
            </p>
            <p className="text-center text-3xl font-extrabold leading-none mb-2 tracking-tight">
              {kpis.budgetPct}%
            </p>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
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

        {/* كارت تقييمات قوقل ماب */}
        <div
          className="flex-1 text-white p-4 rounded-2xl overflow-hidden relative flex flex-col justify-center"
          style={{
            background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
            boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
            minHeight: 90,
          }}
        >
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
          />
          <div className="relative">
            <p className="text-center text-xs font-semibold opacity-95 mb-1.5">
              {t(lang, 'home.kpiReviews') || 'نسبة تحقيق تقييمات قوقل ماب'}
            </p>
            <p className="text-center text-3xl font-extrabold leading-none mb-1.5 tracking-tight">
              {kpis.reviewsPct}%
            </p>
            <p className="text-center text-xs tracking-[0.15em] mb-1.5 opacity-90">⭐⭐⭐⭐⭐</p>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
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

        {/* كارت تسجيل المبيعات — موحّد بنفس تصميم تسجيل المصروفات (أبيض ناعم) */}
        <button
          onClick={() => setView('salesForm')}
          className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-tw-line flex items-center gap-3 active:scale-95 transition-transform"
          style={{ minHeight: 80 }}
        >
          <div className="bg-tw-soft text-tw-blue p-3 rounded-xl flex-shrink-0">
            <TrendingUp size={24} />
          </div>
          <div className={`flex-1 ${align}`}>
            <h3 className="font-bold text-tw-navy text-base mb-0.5">{t(lang, 'home.recordSales')}</h3>
            <p className="text-tw-muted text-xs">{t(lang, 'home.recordSalesD')}</p>
          </div>
        </button>

        {/* كارت تسجيل المصروفات — أبيض ناعم */}
        <button
          onClick={() => setView('expenseForm')}
          className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-tw-line flex items-center gap-3 active:scale-95 transition-transform"
          style={{ minHeight: 80 }}
        >
          <div className="bg-tw-soft text-tw-blue p-3 rounded-xl flex-shrink-0">
            <Receipt size={24} />
          </div>
          <div className={`flex-1 ${align}`}>
            <h3 className="font-bold text-tw-navy text-base mb-0.5">{t(lang, 'home.recordExpense')}</h3>
            <p className="text-tw-muted text-xs">{t(lang, 'home.recordExpenseD')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ==========================================
// نموذج تسجيل المبيعات — يكتب في Firestore
// ==========================================
function SalesForm({ setView, branch, branchId, lang }) {
  const [date, setDate] = useState(todayStr());
  const [cash, setCash] = useState('');
  const [mada, setMada] = useState('');
  const [transfer, setTransfer] = useState('');
  const [methods, setMethods] = useState([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  // اقرأ طرق الدفع من Firestore — مع ترجمة حسب اللغة
  useEffect(() => {
    (async () => {
      try { setMethods(await getPaymentMethods()); }
      catch { /* تسميات افتراضية */ }
    })();
  }, []);

  const labelFor = (id, fallback) => {
    // أولوية: الترجمة من i18n، ثم labelAr من Firestore، ثم fallback
    const tr = translatePM(lang, id);
    if (tr && !tr.startsWith('pm.')) return tr;
    return methods.find((m) => m.id === id)?.labelAr || fallback;
  };
  const total = (Number(cash) || 0) + (Number(mada) || 0) + (Number(transfer) || 0);
  const madaFeesAmt = madaFees(mada);
  const madaNetAmt = madaNet(mada);
  const netTotal = (Number(cash) || 0) + madaNetAmt + (Number(transfer) || 0);

  const fields = [
    { key: 'Cash', label: labelFor('Cash', t(lang, 'sales.cash')), value: cash, set: setCash },
    { key: 'Mada', label: labelFor('Mada', t(lang, 'sales.mada')), value: mada, set: setMada },
    { key: 'Transfer', label: labelFor('Transfer', t(lang, 'sales.transfer')), value: transfer, set: setTransfer },
  ];

  const handleSave = async () => {
    setError('');
    if (total <= 0) { setError(t(lang, 'sales.err.amount')); return; }
    setSaving(true);
    try {
      await addDailySales({ date, branchId, cash, mada, transfer });
      setDone(true);
      setTimeout(() => setView('employeeHome'), 1200);
    } catch (err) {
      setError(err?.message || t(lang, 'sales.err.save'));
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative z-10">
      <div className="flex items-center p-4 border-b border-tw-line">
        <button onClick={() => setView('employeeHome')} className="p-2 text-tw-muted bg-tw-soft rounded-full">
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">{t(lang, 'sales.title')}</h2>
      </div>
      <div className="p-6 space-y-6 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-tw-muted mb-1.5 block">{t(lang, 'sales.date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl font-mono text-sm outline-none focus:border-tw-blue" />
          </div>
          <div>
            <label className="text-xs font-bold text-tw-muted mb-1.5 block">{t(lang, 'sales.branch')}</label>
            <div className="w-full p-3 bg-tw-soft border border-tw-line rounded-xl text-sm font-bold text-tw-blue">{branch}</div>
          </div>
        </div>

        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center">
              <div className="w-1/3 text-tw-muted font-bold">{f.label}</div>
              <input type="number" placeholder="0.00" value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-2/3 p-4 bg-tw-soft/40 border border-tw-line rounded-xl font-mono text-left outline-none focus:border-tw-blue" dir="ltr" />
            </div>
          ))}
        </div>

        <div className="bg-tw-soft p-6 rounded-2xl text-center border border-tw-line">
          <p className="text-tw-navy2 font-bold mb-2">{t(lang, 'sales.total')}</p>
          <p className="text-3xl font-bold text-tw-blue font-mono">{total.toLocaleString()} <SarSymbol /></p>
        </div>

        {/* حسبة رسوم مدى */}
        {Number(mada) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <p className="text-amber-900 font-bold text-xs flex items-center gap-1">
              💳 {t(lang, 'sales.madaFees')} ({(MADA_FEE_RATE * 100).toFixed(2)}%)
            </p>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-amber-800">{t(lang, 'sales.madaGross')}</span>
              <span className="font-mono text-amber-900">{Number(mada).toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-tw-red">{t(lang, 'sales.madaFeesLine')}</span>
              <span className="font-mono text-tw-red">{madaFeesAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-amber-200">
              <span className="text-emerald-800">{t(lang, 'sales.madaNet')}</span>
              <span className="font-mono text-emerald-800">{madaNetAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-amber-300">
              <span className="text-tw-navy">{t(lang, 'sales.totalAfter')}</span>
              <span className="font-mono text-tw-navy">{netTotal.toLocaleString()} <SarSymbol /></span>
            </div>
          </div>
        )}

        {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {t(lang, 'sales.saved')}
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-tw-blue text-white font-bold py-4 rounded-xl shadow-md hover:bg-tw-blue transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? t(lang, 'sales.saving') : t(lang, 'sales.save')}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// نموذج تسجيل المصروف — يقرأ التصنيفات من Firestore
// ==========================================
function ExpenseForm({ setView, branchId, lang }) {
  const [date, setDate] = useState(todayStr());
  const [categories, setCategories] = useState([]);
  const [methods, setMethods] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, pm] = await Promise.all([getCategories(), getPaymentMethods()]);
        if (!cancelled) { setCategories(cats); setMethods(pm); }
      } catch (err) {
        if (!cancelled) setError(err?.message || t(lang, 'expense.loading'));
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const requiresImage = selectedCategory?.requiresImage || false;

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError(t(lang, 'expense.err.imgType')); return; }
    if (f.size > 7 * 1024 * 1024) { setError(t(lang, 'expense.err.imgSize')); return; }
    setError('');
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    setError('');
    if (!categoryId) { setError(t(lang, 'expense.err.cat')); return; }
    if (!(Number(amount) > 0)) { setError(t(lang, 'expense.err.amount')); return; }
    if (requiresImage && !imageFile) { setError(t(lang, 'expense.err.img')); return; }

    setSaving(true);
    try {
      let invoiceUrl = null, invoicePath = null;
      if (imageFile) {
        setUploading(true);
        const up = await uploadInvoiceImage(imageFile);
        invoiceUrl = up.invoiceUrl;
        invoicePath = up.invoicePath;
        setUploading(false);
      }
      await addExpense({
        date,
        branchId,
        categoryId,
        categoryName: selectedCategory?.name,
        expenseType: selectedCategory?.expenseType || 'general',
        amount,
        paymentMethodId: payMethod,
        invoiceUrl,
        invoicePath,
      });
      setDone(true);
      setTimeout(() => setView('employeeHome'), 1200);
    } catch (err) {
      setError(err?.message || t(lang, 'expense.err.save'));
      setSaving(false);
      setUploading(false);
    }
  };

  // ترجمة طريقة الدفع للزر
  const pmLabel = (id) => {
    const tr = translatePM(lang, id);
    if (tr && !tr.startsWith('pm.')) return tr;
    const m = methods.find((x) => x.id === id);
    return m?.labelAr || id;
  };

  return (
    <div className="flex flex-col h-full bg-white relative z-10">
      <div className="flex items-center p-4 border-b border-tw-line">
        <button onClick={() => setView('employeeHome')} className="p-2 text-tw-muted bg-tw-soft rounded-full">
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">{t(lang, 'expense.title')}</h2>
      </div>
      <div className="p-6 space-y-5 flex-1">
        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">{t(lang, 'sales.date')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl font-mono text-sm outline-none focus:border-tw-blue" />
        </div>

        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">{t(lang, 'expense.category')}</label>
          {loadingCats ? (
            <div className="w-full p-4 bg-tw-soft/40 border border-tw-line rounded-xl text-sm text-tw-muted/70 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> {t(lang, 'expense.loading')}
            </div>
          ) : (
            <select className="w-full p-4 bg-tw-soft/40 border border-tw-line rounded-xl font-bold text-tw-navy outline-none focus:border-tw-blue"
              value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t(lang, 'expense.chooseCat')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {translateCategory(lang, c.name)}{c.requiresImage ? ` ${t(lang, 'expense.imageReqTag')}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">{t(lang, 'expense.amount')}</label>
          <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full p-4 bg-tw-soft/40 border border-tw-line rounded-xl font-mono text-left outline-none focus:border-tw-blue" dir="ltr" />
        </div>

        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">{t(lang, 'expense.payMethod')}</label>
          <div className="flex gap-2">
            {(methods.length ? methods : [{ id: 'Cash' }, { id: 'Mada' }, { id: 'Transfer' }]).map((p) => (
              <button key={p.id} onClick={() => setPayMethod(p.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${payMethod === p.id ? 'bg-tw-blue text-white border-blue-600' : 'bg-tw-soft/40 text-tw-muted border-tw-line'}`}>
                {pmLabel(p.id)}
              </button>
            ))}
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileChange} className="hidden" />

        <div className={`p-6 rounded-2xl border-2 border-dashed ${requiresImage && !imageFile ? 'border-red-300 bg-red-50' : 'border-tw-line bg-tw-soft/40'}`}>
          {imagePreview ? (
            <div className="text-center">
              <img src={imagePreview} alt="preview" className="max-h-40 mx-auto rounded-xl shadow mb-3 object-contain" />
              <p className="text-xs text-tw-muted mb-3 font-bold truncate">{imageFile?.name}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={handlePickImage} className="bg-white border border-tw-line px-4 py-2 rounded-xl text-xs font-bold">
                  {t(lang, 'expense.change')}
                </button>
                <button onClick={() => { setImageFile(null); setImagePreview(''); }}
                  className="bg-white border border-red-200 text-tw-red px-4 py-2 rounded-xl text-xs font-bold">
                  {t(lang, 'expense.remove')}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Camera className={`mx-auto mb-3 ${requiresImage ? 'text-tw-red' : 'text-tw-muted/70'}`} size={32} />
              <p className={`text-sm font-bold ${requiresImage ? 'text-tw-red' : 'text-tw-navy'} mb-4`}>
                {requiresImage ? t(lang, 'expense.imageReq') : t(lang, 'expense.imageOpt')}
              </p>
              <button onClick={handlePickImage}
                className="bg-white border border-tw-line px-6 py-2.5 rounded-xl text-sm font-bold flex gap-2 mx-auto">
                <UploadCloud size={16} /> {t(lang, 'expense.pickImage')}
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {t(lang, 'expense.saved')}
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-tw-blue text-white font-bold py-4 rounded-xl shadow-md hover:bg-tw-blue transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
          {(saving || uploading) && <Loader2 size={18} className="animate-spin" />}
          {uploading ? t(lang, 'expense.uploading') : saving ? t(lang, 'expense.saving') : t(lang, 'expense.save')}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// إعدادات المدير — إدارة المستخدمين + المصاريف الثابتة
// ==========================================
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

      {/* شريط العنوان */}
      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button onClick={onBack} className="p-2 text-tw-muted bg-tw-soft rounded-full hover:bg-slate-200 transition-colors">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">المستخدمون</h2>
      </div>

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
  const month = monthStr();
  // كل فرع له 3 بنود: إيجار + رواتب + تأمينات GOSI
  const [toia, setToia] = useState({ rent: '', salaries: '', gosi: '' });
  const [wardana, setWardana] = useState({ rent: '', salaries: '', gosi: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const fixed = await getFixedExpenses(month);
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
        setError(err?.message || 'تعذّر التحميل');
      } finally {
        setLoading(false);
      }
    }
    load();
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

  // مكوّن داخلي لكل بطاقة فرع — 3 inputs (إيجار/رواتب/تأمينات)
  const BranchCard = ({ title, data, setData }) => (
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
      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button onClick={onBack} className="p-2 text-tw-muted bg-tw-soft rounded-full hover:bg-slate-200 transition-colors">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">المصاريف الثابتة</h2>
      </div>

      <div className="relative z-10 p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-3 text-center">
          <p className="text-tw-navy font-bold text-sm">شهر {month}</p>
          <p className="text-tw-muted/70 text-[11px] mt-1">إيجار + رواتب + تأمينات GOSI لكل فرع</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-tw-muted/50" /></div>
        ) : (
          <>
            <BranchCard title="فرع تويا" data={toia} setData={setToia} />
            <BranchCard title="فرع وردانة" data={wardana} setData={setWardana} />

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

            <div className="flex gap-3 pt-2">
              <button
                onClick={onBack}
                className="flex-1 bg-white border border-tw-line text-tw-navy font-bold py-3.5 rounded-xl hover:bg-tw-soft/40 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                  boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
                }}
              >
                {saving && <Loader2 size={18} className="animate-spin" />}
                {saving ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ==========================================
// شاشة إدارة التصنيفات
// ==========================================
function ManageCategories({ onBack }) {
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
  useEffect(() => { load(); }, []);

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

  // Batch 18: ترتيب بالسحب — الضغط المطوّل ثم السحب
  const [dragIdx, setDragIdx] = useState(null);
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newCats = [...cats];
    const [moved] = newCats.splice(dragIdx, 1);
    newCats.splice(idx, 0, moved);
    setCats(newCats);
    setDragIdx(idx);
  };
  const handleDragEnd = async () => {
    if (dragIdx === null) return;
    setDragIdx(null);
    try {
      await reorderCategories(cats.map((c) => c.id));
    } catch (err) {
      setError(err?.message || 'تعذّر تحديث الترتيب');
      await load();
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

      {/* شريط العنوان */}
      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button onClick={onBack} className="p-2 text-tw-muted bg-tw-soft rounded-full hover:bg-slate-200 transition-colors">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">التصنيفات</h2>
      </div>

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
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`bg-white border border-tw-line rounded-2xl p-4 flex items-center gap-3 shadow-sm transition-all ${
                  dragIdx === idx ? 'opacity-50 scale-[0.98]' : ''
                }`}
                style={{ cursor: 'grab' }}
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

                {/* Batch 18: مقبض السحب — يحل محل الأسهم */}
                <div
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
      <div className="flex items-center p-4 border-b border-tw-line">
        <button onClick={onBack} className="p-2 text-tw-muted bg-tw-soft rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy pr-8">تغيير رمزي السري</h2>
      </div>

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
  const [step, setStep] = useState('home'); // home | salesForm | expenseForm | editSalesForm | editExpenseForm
  const [chosenBranch, setChosenBranch] = useState('toia');
  const [branches, setBranches] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    (async () => {
      try { setBranches(await getBranches()); }
      catch { setBranches([{ id: 'toia', name: 'تويا' }, { id: 'wardana', name: 'وردانة' }]); }
    })();
  }, []);

  const branchName = branches.find((b) => b.id === chosenBranch)?.name
    || (chosenBranch === 'wardana' ? 'وردانة' : 'تويا');

  const setView = (v) => {
    if (v === 'salesForm') setStep('salesForm');
    else if (v === 'expenseForm') setStep('expenseForm');
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

          <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm flex-shrink-0">
            <button
              onClick={onBack}
              className="tw-circle-btn"
              type="button"
              aria-label="Back"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">
              المبيعات والمصروفات
            </h2>
            <div style={{ width: 36 }} />
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto p-4 pb-24">
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
      />
    );
  }

  return null;
}

// نسخة من SalesForm للمدير (الفرق: زر "رجوع" يرجع لشاشة الإدخال بدل الموظف)
function AdminSalesForm({ onBack, branchId, branchName }) {
  const [date, setDate] = useState(todayStr());
  const [cash, setCash] = useState('');
  const [mada, setMada] = useState('');
  const [transfer, setTransfer] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const total = (Number(cash) || 0) + (Number(mada) || 0) + (Number(transfer) || 0);
  const madaFeesAmt = madaFees(mada);
  const madaNetAmt = madaNet(mada);
  const netTotal = (Number(cash) || 0) + madaNetAmt + (Number(transfer) || 0);

  const fields = [
    { label: 'كاش', value: cash, set: setCash },
    { label: 'مدى', value: mada, set: setMada },
    { label: 'تحويل', value: transfer, set: setTransfer },
  ];

  const handleSave = async () => {
    setError('');
    if (total <= 0) { setError('أدخل مبلغاً واحداً على الأقل'); return; }
    setSaving(true);
    try {
      await addDailySales({ date, branchId, cash, mada, transfer });
      setDone(true);
      setTimeout(onBack, 1200);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white pb-20">
      <div className="flex items-center p-4 border-b border-tw-line">
        <button onClick={onBack} className="p-2 text-tw-muted bg-tw-soft rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy pr-8">مبيعات — {branchName}</h2>
      </div>
      <div className="p-6 space-y-5 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-tw-muted mb-1.5 block">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl font-mono text-sm outline-none focus:border-tw-blue" />
          </div>
          <div>
            <label className="text-xs font-bold text-tw-muted mb-1.5 block">الفرع</label>
            <div className="w-full p-3 bg-slate-900 text-white rounded-xl text-sm font-bold text-center">{branchName}</div>
          </div>
        </div>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center">
              <div className="w-1/3 text-tw-muted font-bold text-sm">{f.label}</div>
              <input type="number" placeholder="0.00" value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-2/3 p-3.5 bg-tw-soft/40 border border-tw-line rounded-xl font-mono text-left outline-none focus:border-tw-blue" dir="ltr" />
            </div>
          ))}
        </div>

        <div className="bg-tw-soft p-5 rounded-2xl text-center border border-tw-line">
          <p className="text-tw-navy2 font-bold mb-1 text-sm">الإجمالي</p>
          <p className="text-3xl font-bold text-tw-blue font-mono">{total.toLocaleString()} <SarSymbol /></p>
        </div>

        {Number(mada) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <p className="text-amber-900 font-bold text-xs">💳 رسوم مدى ({(MADA_FEE_RATE * 100).toFixed(2)}%)</p>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-tw-red">- رسوم:</span>
              <span className="font-mono text-tw-red">{madaFeesAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-amber-200">
              <span className="text-emerald-800">صافي مدى:</span>
              <span className="font-mono text-emerald-800">{madaNetAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-amber-300">
              <span className="text-tw-navy">الإجمالي بعد الرسوم:</span>
              <span className="font-mono text-tw-navy">{netTotal.toLocaleString()} <SarSymbol /></span>
            </div>
          </div>
        )}

        {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم الحفظ بنجاح
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-tw-blue text-white font-bold py-4 rounded-xl shadow-md hover:bg-tw-blue disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'جارٍ الحفظ...' : 'حفظ المبيعات'}
        </button>
      </div>
    </div>
  );
}

// نسخة من ExpenseForm للمدير
function AdminExpenseForm({ onBack, branchId }) {
  const [date, setDate] = useState(todayStr());
  const [categories, setCategories] = useState([]);
  const [methods, setMethods] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, pm] = await Promise.all([getCategories(), getPaymentMethods()]);
        if (!cancelled) { setCategories(cats); setMethods(pm); }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل التصنيفات');
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const requiresImage = selectedCategory?.requiresImage || false;
  const branchName = branchId === 'wardana' ? 'وردانة' : 'تويا';

  const handlePickImage = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('يجب أن يكون الملف صورة'); return; }
    if (f.size > 7 * 1024 * 1024) { setError('حجم الصورة أكبر من 7 ميجا'); return; }
    setError('');
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    setError('');
    if (!categoryId) { setError('اختر التصنيف'); return; }
    if (!(Number(amount) > 0)) { setError('أدخل مبلغاً صحيحاً'); return; }
    if (requiresImage && !imageFile) { setError('صورة الفاتورة مطلوبة لهذا التصنيف'); return; }
    setSaving(true);
    try {
      let invoiceUrl = null, invoicePath = null;
      if (imageFile) {
        setUploading(true);
        const up = await uploadInvoiceImage(imageFile);
        invoiceUrl = up.invoiceUrl;
        invoicePath = up.invoicePath;
        setUploading(false);
      }
      await addExpense({
        date, branchId, categoryId,
        categoryName: selectedCategory?.name,
        expenseType: selectedCategory?.expenseType || 'general',
        amount,
        paymentMethodId: payMethod,
        invoiceUrl, invoicePath,
      });
      setDone(true);
      setTimeout(onBack, 1200);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white pb-20">
      <div className="flex items-center p-4 border-b border-tw-line">
        <button onClick={onBack} className="p-2 text-tw-muted bg-tw-soft rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy pr-8">مصروف — {branchName}</h2>
      </div>
      <div className="p-6 space-y-4 flex-1">
        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl font-mono text-sm outline-none focus:border-tw-blue" />
        </div>

        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">التصنيف</label>
          {loadingCats ? (
            <div className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm text-tw-muted/70 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> جارٍ التحميل...
            </div>
          ) : (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full p-3.5 bg-tw-soft/40 border border-tw-line rounded-xl font-bold text-tw-navy outline-none focus:border-tw-blue">
              <option value="">اختر التصنيف...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.requiresImage ? ' (صورة إجبارية)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">المبلغ</label>
          <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3.5 bg-tw-soft/40 border border-tw-line rounded-xl font-mono text-left outline-none focus:border-tw-blue" dir="ltr" />
        </div>

        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">طريقة الدفع</label>
          <div className="flex gap-2">
            {(methods.length ? methods : [{ id: 'Cash', labelAr: 'Cash' }, { id: 'Mada', labelAr: 'Mada' }, { id: 'Transfer', labelAr: 'Transfer' }]).map((p) => (
              <button key={p.id} onClick={() => setPayMethod(p.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${payMethod === p.id ? 'bg-tw-blue text-white border-blue-600' : 'bg-tw-soft/40 text-tw-muted border-tw-line'}`}>
                {p.labelAr || p.name || p.id}
              </button>
            ))}
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileChange} className="hidden" />

        <div className={`p-5 rounded-2xl border-2 border-dashed ${requiresImage && !imageFile ? 'border-red-300 bg-red-50' : 'border-tw-line bg-tw-soft/40'}`}>
          {imagePreview ? (
            <div className="text-center">
              <img src={imagePreview} alt="معاينة" className="max-h-32 mx-auto rounded-xl shadow mb-2 object-contain" />
              <div className="flex gap-2 justify-center">
                <button onClick={handlePickImage} className="bg-white border border-tw-line px-4 py-1.5 rounded-lg text-xs font-bold">
                  تغيير
                </button>
                <button onClick={() => { setImageFile(null); setImagePreview(''); }}
                  className="bg-white border border-red-200 text-tw-red px-4 py-1.5 rounded-lg text-xs font-bold">
                  حذف
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Camera className={`mx-auto mb-2 ${requiresImage ? 'text-tw-red' : 'text-tw-muted/70'}`} size={28} />
              <p className={`text-sm font-bold ${requiresImage ? 'text-tw-red' : 'text-tw-navy'} mb-3`}>
                {requiresImage ? 'صورة الفاتورة مطلوبة!' : 'صورة الفاتورة (اختياري)'}
              </p>
              <button onClick={handlePickImage}
                className="bg-white border border-tw-line px-5 py-2 rounded-xl text-xs font-bold flex gap-2 mx-auto">
                <UploadCloud size={14} /> اختيار صورة
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم الحفظ
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-tw-blue text-white font-bold py-4 rounded-xl shadow-md hover:bg-tw-blue disabled:opacity-60 flex items-center justify-center gap-2">
          {(saving || uploading) && <Loader2 size={18} className="animate-spin" />}
          {uploading ? 'جارٍ رفع الصورة...' : saving ? 'جارٍ الحفظ...' : 'حفظ المصروف'}
        </button>
      </div>
    </div>
  );
}
