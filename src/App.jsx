import React, { useState, useMemo, useEffect } from 'react';
import {
  LogOut, Receipt, TrendingUp, TrendingDown,
  Settings, Camera, ChevronRight, Building2,
  BarChart3, Wallet, UploadCloud,
  Calendar, Globe, Store, PieChart, Activity, CreditCard,
  ShoppingCart, Car, Megaphone, Layers, Loader2, Users, Plus, CheckCircle2,
  Key, UserX, UserCheck, Trash2, Edit3,
  Home, Bell
} from 'lucide-react';
import {
  login, logout, watchAuth,
  addDailySales, addExpense,
  getSales, getExpenses, getFixedExpenses, setFixedExpense,
  getUsers, createStaffUser, uploadInvoiceImage,
  getCategories, setCategoryRequiresImage, addCategory, deleteCategory,
  changeMyPin, setUserActive, adminChangeUserPin, adminDeleteUser,
  getBranches, getPaymentMethods,
  madaFees, madaNet, MADA_FEE_RATE,
  saveUserLanguage,
} from './firebase';
import { t, translateCategory, translateBranch, translatePM, dirFor, readSavedLang, saveLangLocal } from './i18n';
import SarSymbol from './components/SarSymbol';
// Manager screens redesigned to match the prototype experience
import ManagerHome from './components/ManagerHome';
import ManagerMonthly from './components/ManagerMonthly';
import ManagerOverview from './components/ManagerOverview';
import ManagerKpis from './components/ManagerKpis';

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
// التطبيق الرئيسي
// ==========================================
export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminTab, setAdminTab] = useState('home');
  // ✨ اللغة — تخص شاشات الموظف فقط، لكن نقرأها للجميع لاتساق شاشة الدخول
  const [lang, setLang] = useState(readSavedLang());

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
    <div className={`min-h-screen bg-[#f1f5f9] md:flex md:items-center md:justify-center md:p-4 font-sans ${pageAlign}`} dir={pageDir}>
      <div className="w-full bg-white overflow-hidden flex flex-col
                      min-h-screen
                      md:min-h-0 md:max-w-md md:rounded-[2.5rem] md:shadow-[0_20px_50px_rgba(8,_112,_184,_0.15)]
                      md:border-8 md:border-slate-900 md:h-[850px] md:relative">

        {currentView !== 'login' && !authLoading && (
          <header className="bg-slate-900 text-white p-5 pt-12 md:pt-8 z-20 relative">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold tracking-wide">Toia &amp; Wardana</h1>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  {user?.displayName || 'Finance Control'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* زر الإشعارات — placeholder حالياً، نظام كامل في الدفعة 3 */}
                {isAdmin && (
                  <button
                    onClick={() => alert(lang === 'en' ? 'Notifications coming soon' : 'الإشعارات قريباً')}
                    className="p-2.5 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors relative"
                    title={lang === 'en' ? 'Notifications' : 'الإشعارات'}
                  >
                    <Bell size={18} />
                  </button>
                )}
                <button onClick={handleLogout} className="p-2.5 bg-slate-800 rounded-full hover:bg-red-500 transition-colors">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto bg-slate-50 relative z-10 pb-24 md:pb-0">
          {authLoading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 pt-20">
              <Loader2 size={32} className="animate-spin" />
              <p className="text-sm font-bold">{lang === 'en' ? 'Loading...' : 'جارٍ التحميل...'}</p>
            </div>
          )}
          {!authLoading && currentView === 'login' && (
            <LoginView onLoginSuccess={handleLoginSuccess} lang={lang} setLang={changeLang} />
          )}
          {!authLoading && currentView === 'employeeHome' && (
            <EmployeeHome setView={setCurrentView} branch={branch} lang={lang} setLang={changeLang} />
          )}
          {!authLoading && currentView === 'salesForm' && (
            <SalesForm setView={setCurrentView} branch={branch} branchId={branchId} lang={lang} />
          )}
          {!authLoading && currentView === 'expenseForm' && (
            <ExpenseForm setView={setCurrentView} branchId={branchId} lang={lang} />
          )}
          {/* ====== شاشات المدير — مطابقة لتجربة الـ prototype ====== */}
          {!authLoading && currentView === 'adminHome' && adminTab === 'home' && <ManagerHome lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'monthly' && <ManagerMonthly lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'overview' && <ManagerOverview lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'kpis' && <ManagerKpis lang="ar" />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'settings' && <AdminSettings />}
          {/* Dashboard القديم: متاح للرجوع إن أردت — adminTab === 'dashboard' */}
          {!authLoading && currentView === 'adminHome' && adminTab === 'dashboard' && <SuperAdminDashboard />}
        </main>

        {userRole === 'admin' && currentView === 'adminHome' && !authLoading && (
          <nav className="fixed bottom-0 left-0 right-0 md:absolute bg-white border-t border-gray-200 flex justify-around items-center px-1 py-2 pb-5 md:pb-4 z-30 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
            {[
              { key: 'monthly', icon: BarChart3, label: 'المؤشرات الشهرية' },
              { key: 'overview', icon: PieChart, label: 'نظرة عامة' },
              { key: 'home', icon: Home, label: 'الرئيسية' },
              { key: 'kpis', icon: TrendingUp, label: 'المؤشرات' },
              { key: 'settings', icon: Settings, label: 'الإعدادات' },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = adminTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setAdminTab(tab.key)}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
                    active ? 'text-blue-600 scale-110' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  <span className={`text-[9px] mt-0.5 font-bold leading-tight text-center ${active ? '' : 'opacity-80'}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
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
      <div className="bg-white p-4 shadow-sm z-10 sticky top-0 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Calendar size={18} className="text-blue-600" />
            <span>فترة التقرير:</span>
          </div>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-sm font-bold rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 text-blue-700">
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
              <label className="text-[10px] font-bold text-gray-500 block mb-1">من</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono outline-none focus:border-blue-500" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-500 block mb-1">إلى</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono outline-none focus:border-blue-500" />
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
                    : b.v === 'toia' ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-pink-600 text-white border-pink-600'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}>
              {b.t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border-b border-gray-100 px-2 py-3 overflow-x-auto whitespace-nowrap flex gap-2">
        <ReportTab id="overview" current={activeReport} set={setActiveReport} icon={<Activity size={16} />} label="نظرة عامة" />
        <ReportTab id="branches" current={activeReport} set={setActiveReport} icon={<Store size={16} />} label="مقارنة الفروع" />
        <ReportTab id="averages" current={activeReport} set={setActiveReport} icon={<PieChart size={16} />} label="المتوسطات" />
        <ReportTab id="payments" current={activeReport} set={setActiveReport} icon={<Wallet size={16} />} label="طرق الدفع" />
        <ReportTab id="monthDays" current={activeReport} set={setActiveReport} icon={<Calendar size={16} />} label="الشهر بالأيام" />
        <ReportTab id="monthWeeks" current={activeReport} set={setActiveReport} icon={<Layers size={16} />} label="أرباع الشهر" />
        <ReportTab id="kpi" current={activeReport} set={setActiveReport} icon={<Layers size={16} />} label="جدول المؤشرات" />
      </div>

      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 size={28} className="animate-spin" />
          <p className="text-sm font-bold">جارٍ تحميل البيانات...</p>
        </div>
      )}

      {error && (
        <div className="p-4">
          <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="p-4 space-y-4">
          {isEmpty && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
              <p className="text-amber-800 font-bold text-sm">لا توجد بيانات لهذه الفترة</p>
              <p className="text-amber-600 text-xs mt-1">سجّل مبيعات ومصاريف من حساب موظف لتظهر هنا</p>
            </div>
          )}

          {activeReport === 'overview' && (
            <div className="space-y-4">
              <div className="bg-slate-900 p-5 rounded-2xl shadow-lg text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-50"></div>
                <p className="text-slate-300 font-bold text-xs mb-2">{profitLabel} — {m.view.label}</p>
                <p className="text-4xl font-bold font-mono text-emerald-400">
                  {Math.round(m.view.profit).toLocaleString()} <SarSymbol className="text-sm text-slate-400" />
                </p>
                <p className="text-[10px] text-slate-400 mt-2 bg-slate-800 w-fit px-2 py-1 rounded">
                  المبيعات − (المصاريف المتغيرة + نصيب الثابتة)
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="المبيعات" value={m.view.sales} icon={<TrendingUp size={16} className="text-emerald-500" />} />
                <StatCard label="المصاريف" value={m.view.totalExp} icon={<TrendingDown size={16} className="text-red-500" />} />
                <StatCard label="م. متغيرة" value={m.view.varExp} icon={<Receipt size={16} className="text-orange-500" />} />
                <StatCard label="نصيب الثابتة" value={m.view.fixedExp} icon={<Building2 size={16} className="text-indigo-500" />} />
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2">
                  <Globe size={16} className="text-blue-600" /> قنوات البيع (أون لاين / أوف لاين) — {m.view.label}
                </h3>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-blue-700">أون لاين: {m.view.onlinePerc}%</span>
                  <span className="text-slate-700">أوف لاين: {m.view.offlinePerc}%</span>
                </div>
                <div className="h-3 w-full flex rounded-full overflow-hidden mb-3 bg-slate-100">
                  <div style={{ width: `${m.view.onlinePerc}%` }} className="bg-blue-500"></div>
                  <div style={{ width: `${m.view.offlinePerc}%` }} className="bg-slate-300"></div>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>التحويلات ({m.view.onlineSales.toLocaleString()})</span>
                  <span>النقد ومدى ({m.view.offlineSales.toLocaleString()})</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                  <ShoppingCart size={16} className="text-pink-500" /> نسبة تكلفة الورد للمبيعات — {m.view.label}
                </h3>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-pink-600 font-mono">{m.view.flowerPerc}%</p>
                  <p className="text-[11px] text-gray-400 mb-1">من إجمالي المبيعات</p>
                </div>
              </div>
            </div>
          )}

          {activeReport === 'branches' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-blue-50 border-b border-blue-100 p-3 font-bold text-sm text-blue-900 flex items-center gap-2">
                <Store size={18} /> مقارنة الأداء ({period})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-white text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="p-3 font-bold">البيان</th>
                      <th className="p-3 font-bold text-center border-r border-gray-100 text-blue-600">تويا</th>
                      <th className="p-3 font-bold text-center border-r border-gray-100 text-blue-600">وردانة</th>
                      <th className="p-3 font-bold text-center border-r border-gray-100 bg-gray-50">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-mono">
                    <CompareRow label="المبيعات" t={m.data.toia.sales} w={m.data.wardana.sales} total={m.totalSales} tone="emerald" bold />
                    <CompareRow label="م. متغيرة" t={m.data.toia.varExp} w={m.data.wardana.varExp} total={m.totalVarExp} tone="red" />
                    <CompareRow label="نصيب الثابتة" t={m.toiaFixed} w={m.wardanaFixed} total={m.totalFixedExp} tone="orange" />
                    <CompareRow label="إجمالي المصاريف" t={m.toiaTotalExp} w={m.wardanaTotalExp} total={m.totalExp} tone="red" />
                    <tr className="bg-emerald-50/40">
                      <td className="p-3 font-bold text-emerald-900 font-sans">صافي الربح</td>
                      <td className="p-3 text-center font-bold text-emerald-700">{Math.round(m.toiaProfit).toLocaleString()}</td>
                      <td className="p-3 text-center font-bold text-emerald-700 border-r border-gray-100">{Math.round(m.wardanaProfit).toLocaleString()}</td>
                      <td className="p-3 text-center font-bold text-emerald-800 border-r border-gray-100 bg-emerald-50/60">{Math.round(m.totalProfit).toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="p-3 text-gray-600 font-sans font-bold">تكلفة الورد %</td>
                      <td className="p-3 text-center text-gray-700 font-bold">{m.toiaFlowerPerc}%</td>
                      <td className="p-3 text-center text-gray-700 font-bold border-r border-gray-100">{m.wardanaFlowerPerc}%</td>
                      <td className="p-3 text-center text-gray-800 font-bold border-r border-gray-100 bg-gray-50">{m.totalFlowerPerc}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport === 'averages' && (
            <div className="space-y-3">
              <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-md">
                <h3 className="font-bold mb-1 text-sm flex items-center gap-2"><PieChart size={18} /> المتوسطات اليومية — {m.view.label}</h3>
                <p className="text-blue-200 text-xs">محسوبة على أساس {m.data.days} يوم بناءً على فلتر ({period})</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <AverageCard title="متوسط المبيعات" amount={m.view.avgSales} icon={<TrendingUp size={16} className="text-emerald-500" />} />
                <AverageCard title="متوسط المصاريف" amount={m.view.avgExp} icon={<TrendingDown size={16} className="text-red-500" />} />
                <AverageCard title="متوسط الورد" amount={m.view.avgFlower} icon={<ShoppingCart size={16} className="text-pink-500" />} />
                <AverageCard title="متوسط التوصيل" amount={m.view.avgDelivery} icon={<Car size={16} className="text-orange-500" />} />
                <AverageCard title="متوسط التسويق" amount={m.view.avgMarketing} icon={<Megaphone size={16} className="text-purple-500" />} full />
              </div>

              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md mt-3">
                <h3 className="font-bold mb-1 text-sm flex items-center gap-2"><CreditCard size={18} /> متوسطات طرق الدفع اليومية</h3>
                <p className="text-slate-300 text-xs">قيمة كل وسيلة دفع يومياً ضمن الفترة</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <AverageCard title="Cash" amount={m.view.avgCash} icon={<Wallet size={14} className="text-emerald-500" />} />
                <AverageCard title="Mada" amount={m.view.avgMada} icon={<CreditCard size={14} className="text-blue-500" />} />
                <AverageCard title="Transfer" amount={m.view.avgTransfer} icon={<Globe size={14} className="text-purple-500" />} />
              </div>
            </div>
          )}

          {activeReport === 'payments' && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-5 text-sm flex items-center gap-2">
                <CreditCard size={18} className="text-blue-600" /> تحليل طرق الدفع — {m.view.label}
              </h3>
              <div className="space-y-5">
                <PaymentBar label="مدى (شبكة)" amount={m.view.mada} total={m.view.sales} color="bg-blue-500" />
                <PaymentBar label="تحويل (أون لاين)" amount={m.view.transfer} total={m.view.sales} color="bg-purple-500" />
                <PaymentBar label="نقدي (كاش)" amount={m.view.cash} total={m.view.sales} color="bg-emerald-500" />
              </div>
            </div>
          )}

          {/* ✨ تحليل الشهر بالأيام (طلب #5) */}
          {activeReport === 'monthDays' && (
            <div className="space-y-3">
              {!m.dailyBreakdown ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
                  <p className="text-amber-800 font-bold text-sm">هذا التحليل متاح فقط في فلتر "شهري"</p>
                  <p className="text-amber-600 text-xs mt-1">بدّل الفلتر فوق إلى "شهري"</p>
                </div>
              ) : (
                <>
                  <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md">
                    <h3 className="font-bold text-sm flex items-center gap-2"><Calendar size={18} /> أيام الشهر — {m.view.label}</h3>
                    <p className="text-emerald-100 text-[11px] mt-1">معرفة الأيام الأقوى والأضعف بيعاً</p>
                  </div>

                  {/* ملخص أفضل/أسوأ يوم */}
                  {(() => {
                    const withSales = m.dailyBreakdown.filter((d) => d.sales > 0);
                    if (!withSales.length) {
                      return (
                        <div className="bg-white border border-gray-100 rounded-xl p-5 text-center text-gray-400 text-sm">
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
                          <p className="text-[10px] text-gray-400 font-bold">أقوى يوم</p>
                          <p className="text-lg font-bold text-emerald-600 font-mono">يوم {best.day}</p>
                          <p className="text-xs font-mono text-emerald-700">{best.sales.toLocaleString()}</p>
                        </div>
                        <div className="bg-white border border-blue-100 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-gray-400 font-bold">المتوسط</p>
                          <p className="text-lg font-bold text-blue-600 font-mono">{avg.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400">ريال/يوم</p>
                        </div>
                        <div className="bg-white border border-red-100 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-gray-400 font-bold">أضعف يوم</p>
                          <p className="text-lg font-bold text-red-500 font-mono">يوم {worst.day}</p>
                          <p className="text-xs font-mono text-red-600">{worst.sales.toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* رسم أعمدة لكل يوم */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    {(() => {
                      const maxSales = Math.max(1, ...m.dailyBreakdown.map((d) => d.sales));
                      return (
                        <div className="space-y-1.5">
                          {m.dailyBreakdown.map((d) => {
                            const widthPerc = (d.sales / maxSales) * 100;
                            const isMax = d.sales === maxSales && d.sales > 0;
                            return (
                              <div key={d.day} className="flex items-center gap-2">
                                <span className="text-[10px] font-mono w-6 text-gray-500 font-bold text-left">{d.day}</span>
                                <div className="flex-1 bg-gray-50 rounded h-5 overflow-hidden relative">
                                  <div className={`h-full ${isMax ? 'bg-emerald-500' : 'bg-blue-400'} rounded transition-all`}
                                    style={{ width: `${widthPerc}%` }} />
                                </div>
                                <span className="text-[10px] font-mono w-20 text-gray-700 font-bold text-left">
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
                  <p className="text-amber-600 text-xs mt-1">بدّل الفلتر فوق إلى "شهري"</p>
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
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {m.weeklyBreakdown.map((b, i) => {
                          const widthPerc = (b.sales / maxW) * 100;
                          const sharePerc = total > 0 ? Math.round((b.sales / total) * 100) : 0;
                          return (
                            <div key={i} className="p-4 border-b border-gray-50 last:border-0">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-bold text-sm text-gray-700">{b.label}</span>
                                <div className="text-left">
                                  <span className="font-mono font-bold text-slate-800">{b.sales.toLocaleString()}</span>
                                  <span className="text-[11px] text-gray-400 mr-1">({sharePerc}%)</span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${widthPerc}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        <div className="bg-slate-50 p-3 flex justify-between font-bold text-sm">
                          <span className="text-slate-700">إجمالي الشهر:</span>
                          <span className="font-mono text-slate-900">{total.toLocaleString()} <SarSymbol /></span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {activeReport === 'kpi' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-slate-900 p-3 font-bold text-sm text-white flex items-center gap-2">
                <Layers size={18} /> جدول المؤشرات الشامل ({period})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-white text-gray-500 border-b border-gray-100">
                    <tr>
                      <th className="p-3 font-bold">المؤشر</th>
                      <th className="p-3 font-bold text-center border-r border-gray-100 text-blue-600">Toia</th>
                      <th className="p-3 font-bold text-center border-r border-gray-100 text-blue-600">Wardana</th>
                      <th className="p-3 font-bold text-center border-r border-gray-100 bg-gray-50">Total</th>
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
                      <td className="p-3 text-center font-bold text-emerald-700">{Math.round(m.toiaProfit).toLocaleString()}</td>
                      <td className="p-3 text-center font-bold text-emerald-700 border-r border-gray-100">{Math.round(m.wardanaProfit).toLocaleString()}</td>
                      <td className="p-3 text-center font-bold text-emerald-800 border-r border-gray-100 bg-emerald-50/60">{Math.round(m.totalProfit).toLocaleString()}</td>
                    </tr>
                    <CompareRow label="Flower Exp." t={m.data.toia.flowerExp} w={m.data.wardana.flowerExp} total={m.data.toia.flowerExp + m.data.wardana.flowerExp} tone="pink" />
                    <CompareRow label="Delivery Fees" t={m.data.toia.deliveryExp} w={m.data.wardana.deliveryExp} total={m.data.toia.deliveryExp + m.data.wardana.deliveryExp} tone="orange" />
                    <CompareRow label="Marketing Exp." t={m.data.toia.marketingExp} w={m.data.wardana.marketingExp} total={m.data.toia.marketingExp + m.data.wardana.marketingExp} tone="purple" />
                    <tr className="hover:bg-gray-50">
                      <td className="p-3 text-gray-600 font-sans font-bold">Flower Cost %</td>
                      <td className="p-3 text-center text-gray-700 font-bold">{m.toiaFlowerPerc}%</td>
                      <td className="p-3 text-center text-gray-700 font-bold border-r border-gray-100">{m.wardanaFlowerPerc}%</td>
                      <td className="p-3 text-center text-gray-800 font-bold border-r border-gray-100 bg-gray-50">{m.totalFlowerPerc}%</td>
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
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all border ${active ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
      {icon} {label}
    </button>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-gray-500">{label}</span>
        {icon}
      </div>
      <p className="text-lg font-bold text-gray-800 font-mono">{Math.round(value).toLocaleString()}</p>
    </div>
  );
}

const TONE = {
  emerald: 'text-emerald-600', red: 'text-red-400', orange: 'text-orange-400',
  slate: 'text-slate-600', blue: 'text-blue-500', pink: 'text-pink-500', purple: 'text-purple-500',
};

function CompareRow({ label, t, w, total, tone = 'slate', bold }) {
  const c = TONE[tone] || TONE.slate;
  return (
    <tr className="hover:bg-gray-50">
      <td className={`p-3 font-sans ${bold ? 'font-bold text-gray-700' : 'text-gray-500'}`}>{label}</td>
      <td className={`p-3 text-center ${c} ${bold ? 'font-bold' : ''}`}>{Math.round(t).toLocaleString()}</td>
      <td className={`p-3 text-center ${c} ${bold ? 'font-bold' : ''} border-r border-gray-100`}>{Math.round(w).toLocaleString()}</td>
      <td className={`p-3 text-center ${c} font-bold border-r border-gray-100 bg-gray-50`}>{Math.round(total).toLocaleString()}</td>
    </tr>
  );
}

function AverageCard({ title, amount, icon, full }) {
  return (
    <div className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 ${full ? 'col-span-2 flex justify-between items-center' : 'flex flex-col'}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon} <span className="text-xs font-bold text-gray-500">{title}</span>
      </div>
      <p className="text-lg font-bold text-slate-800 font-mono">{amount.toLocaleString()}</p>
    </div>
  );
}

function PaymentBar({ label, amount, total, color }) {
  const perc = total > 0 ? Math.round((amount / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1.5">
        <span className="font-bold text-gray-700">{label}</span>
        <div className="text-left">
          <span className="font-mono font-bold text-slate-800 ml-2">{amount.toLocaleString()}</span>
          <span className="text-gray-400">({perc}%)</span>
        </div>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
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
          className="bg-white/80 backdrop-blur-sm border border-blue-100 text-slate-700 px-3.5 py-1.5 rounded-xl shadow-sm hover:bg-white hover:shadow-md transition-all"
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
function EmployeeHome({ setView, branch, lang, setLang }) {
  const align = lang === 'en' ? 'text-left' : 'text-right';
  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  // اسم الشهر الحالي بتنسيق "مايو 2026" / "May 2026" — قراءة فقط حالياً.
  // لاحقاً يمكن جعله picker إذا قررنا السماح للموظف باستعراض شهور أخرى.
  const monthLabel = new Date().toLocaleDateString(
    lang === 'en' ? 'en-US' : 'ar-SA',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div
      className="relative min-h-full flex flex-col px-5 pt-6 pb-8 overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية ناعمة — نفس طابع شاشة الدخول للاتساق البصري */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,91,255,0.25), transparent 70%)' }}
      />

      {/* شريط اللغة */}
      <div className={`relative z-10 flex ${lang === 'en' ? 'justify-start' : 'justify-end'} mb-3`}>
        <button
          onClick={toggleLang}
          className="bg-white/80 backdrop-blur-sm border border-blue-100 text-slate-700 px-3 py-1.5 rounded-full shadow-sm hover:bg-white hover:shadow-md transition-all flex items-center gap-1.5 text-xs font-bold"
        >
          <Globe size={14} className="text-blue-600" />
          {t(lang, 'home.langToggle')}
        </button>
      </div>

      {/* بطاقة الترحيب — مدمجة وأنيقة */}
      <div className="relative z-10 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center mb-3">
        <p className="text-gray-500 text-sm mb-1">{t(lang, 'home.greeting')}</p>
        <h2 className="text-2xl font-bold" style={{ color: '#061742' }}>
          {lang === 'en' ? branch : `فرع ${branch}`}
        </h2>
      </div>

      {/* شريط الشهر — قراءة فقط، يعطي السياق الزمني */}
      <div className="relative z-10 flex items-center justify-center gap-2 bg-white border border-gray-100 rounded-xl py-2.5 px-4 mb-4 shadow-sm">
        <Calendar size={16} className="text-blue-600" />
        <span className="font-bold text-sm text-slate-700">{monthLabel}</span>
      </div>

      {/* ============================================================
          كرتا مؤشرات الأداء (KPI) — تحقيق الميزانية + التقييمات
          ⚠️ TODO (ربط Firestore):
            1) أنشئ collection 'goals' في Firestore بهذا الشكل:
                 goals/{branchId}_{YYYY-MM}  →  { budget: 50000, reviewsTarget: 100 }
            2) أضف في firebase.js:
                 export async function getMonthlyGoal(branchId, monthStr) {...}
                 export async function getCurrentMonthSales(branchId) {...}
                 export async function getCurrentReviews(branchId) {...}
            3) استبدل الأرقام التجريبية أدناه بـ useState + useEffect:
                 const [budget, setBudget] = useState({ achieved: 0, target: 1 });
                 const [reviews, setReviews] = useState({ achieved: 0, target: 1 });
                 useEffect(() => { ... fetch ... }, [branch]);
            4) أضف شاشة إدارية للمدير لإدخال الأهداف الشهرية.
         الآن: أرقام تجريبية لاستعراض التصميم.
         ============================================================ */}
      {(() => {
        // أرقام تجريبية — استبدلها بقراءات حقيقية لاحقاً
        const budgetAchieved = 39000;
        const budgetTarget = 50000;
        const reviewsAchieved = 92;
        const reviewsTarget = 100;
        const budgetPct = Math.min(100, Math.round((budgetAchieved / budgetTarget) * 100));
        const reviewsPct = Math.min(100, Math.round((reviewsAchieved / reviewsTarget) * 100));
        return (
          <div className="relative z-10 space-y-3 mb-4">
            {/* كارت تحقيق الميزانية */}
            <div
              className="text-white p-4 rounded-2xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
                boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
              }}
            >
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
              />
              <div className="relative">
                <p className="text-center text-sm font-semibold opacity-95 mb-2">
                  {t(lang, 'home.kpiBudget') || 'نسبة تحقيق الميزانية'}
                </p>
                <p className="text-center text-4xl font-extrabold leading-none mb-3 tracking-tight">
                  {budgetPct}%
                </p>
                {/* شريط التقدم */}
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* كارت تقييمات قوقل ماب */}
            <div
              className="text-white p-4 rounded-2xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
                boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
              }}
            >
              <div
                className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)' }}
              />
              <div className="relative">
                <p className="text-center text-sm font-semibold opacity-95 mb-2">
                  {t(lang, 'home.kpiReviews') || 'نسبة تحقيق تقييمات قوقل ماب'}
                </p>
                <p className="text-center text-4xl font-extrabold leading-none mb-2 tracking-tight">
                  {reviewsPct}%
                </p>
                <p className="text-center text-sm tracking-[0.15em] mb-2">⭐⭐⭐⭐⭐</p>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${reviewsPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* كارت تسجيل المبيعات — gradient navy بنفس طابع الـ prototype */}
      <button
        onClick={() => setView('salesForm')}
        className="relative z-10 text-white p-5 rounded-2xl flex items-center gap-4 active:scale-95 transition-transform mb-3 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #082765 0%, #061742 60%, #1E3A8A 100%)',
          boxShadow: '0 12px 30px -8px rgba(8, 39, 101, 0.4)',
        }}
      >
        {/* لمعة خفيفة */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 20% 20%, rgba(40,223,255,0.4), transparent 50%)' }}
        />
        <div className="relative bg-white/15 backdrop-blur-sm p-3.5 rounded-xl">
          <TrendingUp size={28} />
        </div>
        <div className={`relative flex-1 ${align}`}>
          <h3 className="font-bold text-lg mb-0.5">{t(lang, 'home.recordSales')}</h3>
          <p className="text-blue-100 text-xs">{t(lang, 'home.recordSalesD')}</p>
        </div>
      </button>

      {/* كارت تسجيل المصروفات — أبيض ناعم */}
      <button
        onClick={() => setView('expenseForm')}
        className="relative z-10 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-95 transition-transform"
      >
        <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl">
          <Receipt size={28} />
        </div>
        <div className={`flex-1 ${align}`}>
          <h3 className="font-bold text-gray-800 text-lg mb-0.5">{t(lang, 'home.recordExpense')}</h3>
          <p className="text-gray-500 text-xs">{t(lang, 'home.recordExpenseD')}</p>
        </div>
      </button>
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
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={() => setView('employeeHome')} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 px-8">{t(lang, 'sales.title')}</h2>
      </div>
      <div className="p-6 space-y-6 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">{t(lang, 'sales.date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">{t(lang, 'sales.branch')}</label>
            <div className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm font-bold text-blue-700">{branch}</div>
          </div>
        </div>

        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center">
              <div className="w-1/3 text-gray-600 font-bold">{f.label}</div>
              <input type="number" placeholder="0.00" value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-2/3 p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-left outline-none focus:border-blue-500" dir="ltr" />
            </div>
          ))}
        </div>

        <div className="bg-blue-50 p-6 rounded-2xl text-center border border-blue-100">
          <p className="text-blue-800 font-bold mb-2">{t(lang, 'sales.total')}</p>
          <p className="text-3xl font-bold text-blue-700 font-mono">{total.toLocaleString()} <SarSymbol /></p>
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
              <span className="text-red-700">{t(lang, 'sales.madaFeesLine')}</span>
              <span className="font-mono text-red-700">{madaFeesAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-amber-200">
              <span className="text-emerald-800">{t(lang, 'sales.madaNet')}</span>
              <span className="font-mono text-emerald-800">{madaNetAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-amber-300">
              <span className="text-slate-900">{t(lang, 'sales.totalAfter')}</span>
              <span className="font-mono text-slate-900">{netTotal.toLocaleString()} <SarSymbol /></span>
            </div>
          </div>
        )}

        {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {t(lang, 'sales.saved')}
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
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
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={() => setView('employeeHome')} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 px-8">{t(lang, 'expense.title')}</h2>
      </div>
      <div className="p-6 space-y-5 flex-1">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">{t(lang, 'sales.date')}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">{t(lang, 'expense.category')}</label>
          {loadingCats ? (
            <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> {t(lang, 'expense.loading')}
            </div>
          ) : (
            <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:border-blue-500"
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
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">{t(lang, 'expense.amount')}</label>
          <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-left outline-none focus:border-blue-500" dir="ltr" />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">{t(lang, 'expense.payMethod')}</label>
          <div className="flex gap-2">
            {(methods.length ? methods : [{ id: 'Cash' }, { id: 'Mada' }, { id: 'Transfer' }]).map((p) => (
              <button key={p.id} onClick={() => setPayMethod(p.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${payMethod === p.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                {pmLabel(p.id)}
              </button>
            ))}
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileChange} className="hidden" />

        <div className={`p-6 rounded-2xl border-2 border-dashed ${requiresImage && !imageFile ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
          {imagePreview ? (
            <div className="text-center">
              <img src={imagePreview} alt="preview" className="max-h-40 mx-auto rounded-xl shadow mb-3 object-contain" />
              <p className="text-xs text-gray-600 mb-3 font-bold truncate">{imageFile?.name}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={handlePickImage} className="bg-white border border-gray-300 px-4 py-2 rounded-xl text-xs font-bold">
                  {t(lang, 'expense.change')}
                </button>
                <button onClick={() => { setImageFile(null); setImagePreview(''); }}
                  className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-xl text-xs font-bold">
                  {t(lang, 'expense.remove')}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Camera className={`mx-auto mb-3 ${requiresImage ? 'text-red-500' : 'text-gray-400'}`} size={32} />
              <p className={`text-sm font-bold ${requiresImage ? 'text-red-700' : 'text-gray-700'} mb-4`}>
                {requiresImage ? t(lang, 'expense.imageReq') : t(lang, 'expense.imageOpt')}
              </p>
              <button onClick={handlePickImage}
                className="bg-white border border-gray-300 px-6 py-2.5 rounded-xl text-sm font-bold flex gap-2 mx-auto">
                <UploadCloud size={16} /> {t(lang, 'expense.pickImage')}
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {t(lang, 'expense.saved')}
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
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
      <h2 className="text-xl font-bold text-gray-800 px-1 mb-2">إعدادات النظام</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {items.map((item) => (
          <button key={item.key} disabled={!item.enabled}
            onClick={() => item.enabled && setScreen(item.key)}
            className={`w-full p-4 border-b border-gray-50 last:border-0 flex items-center justify-between text-right transition-colors ${item.enabled ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
            <div>
              <span className="font-bold text-sm text-gray-700 block">{item.label}</span>
              <span className="text-[11px] text-gray-400">{item.desc}{!item.enabled && ' (قريباً)'}</span>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
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
  const [editPinUid, setEditPinUid] = useState(null); // أي مستخدم نغيّر رمزه
  const [busyUid, setBusyUid] = useState(null);

  // حقول نموذج الإضافة
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('employee');
  const [branchId, setBranchId] = useState('toia');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // حقل تغيير الرمز
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
    <div className="flex flex-col h-full bg-white pb-20">
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={onBack} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 pr-8">المستخدمون</h2>
      </div>

      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 flex items-center justify-center gap-2">
            <Plus size={18} /> إضافة مستخدم
          </button>
        )}

        {showForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-slate-800">مستخدم جديد</h3>
            <input type="text" placeholder="اسم المستخدم (إنجليزي)" value={username}
              onChange={(e) => setUsername(e.target.value)} autoCapitalize="off"
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" />
            <input type="text" placeholder="الاسم الظاهر" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" />
            <input type="password" inputMode="numeric" maxLength={4} placeholder="الرمز (4 أرقام)" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 text-center tracking-[0.4em] font-mono" />
            <div className="flex gap-2">
              {[{ v: 'employee', t: 'موظف' }, { v: 'admin', t: 'مدير' }].map((r) => (
                <button key={r.v} onClick={() => setRole(r.v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border ${role === r.v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {r.t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {[{ v: 'toia', t: 'تويا' }, { v: 'wardana', t: 'وردانة' }].map((b) => (
                <button key={b.v} onClick={() => setBranchId(b.v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border ${branchId === b.v ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {b.t}
                </button>
              ))}
            </div>
            {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-2 text-center">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setError(''); }}
                className="flex-1 bg-white border border-gray-300 text-gray-600 font-bold py-2.5 rounded-xl text-sm">
                إلغاء
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'جارٍ...' : 'حفظ'}
              </button>
            </div>
            <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg p-2 text-center">
              ملاحظة: بعد الحفظ سيُسجَّل دخولك بالحساب الجديد. سجّل خروج ثم ادخل بحسابك من جديد.
            </p>
          </div>
        )}

        {!showForm && error && (
          <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.uid} className={`bg-white border rounded-xl p-3 shadow-sm ${u.active === false ? 'border-gray-200 opacity-60' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${u.role === 'admin' ? 'bg-slate-800 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <Users size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-800">
                      {u.displayName || u.username}
                      {u.active === false && <span className="text-red-500 text-[10px] mr-2">(معطّل)</span>}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {u.username} · {u.role === 'admin' ? 'مدير' : 'موظف'} · فرع {u.branchId === 'wardana' ? 'وردانة' : 'تويا'}
                    </p>
                  </div>
                </div>

                {editPinUid === u.uid ? (
                  <div className="mt-3 flex gap-2">
                    <input type="password" inputMode="numeric" maxLength={4} value={editPinValue}
                      onChange={(e) => setEditPinValue(e.target.value.replace(/\D/g, ''))}
                      placeholder="رمز جديد (4 أرقام)"
                      className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center tracking-[0.4em] font-mono outline-none focus:border-blue-500" />
                    <button onClick={() => handleChangePin(u.uid)} disabled={busyUid === u.uid}
                      className="bg-blue-600 text-white font-bold px-4 rounded-lg text-xs disabled:opacity-60 flex items-center gap-1">
                      {busyUid === u.uid && <Loader2 size={14} className="animate-spin" />} حفظ
                    </button>
                    <button onClick={() => { setEditPinUid(null); setEditPinValue(''); }}
                      className="bg-gray-100 text-gray-600 font-bold px-3 rounded-lg text-xs">إلغاء</button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-1.5">
                    <button onClick={() => { setEditPinUid(u.uid); setEditPinValue(''); }}
                      className="flex-1 bg-blue-50 text-blue-700 text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                      <Key size={13} /> الرمز
                    </button>
                    <button onClick={() => handleToggleActive(u)} disabled={busyUid === u.uid}
                      className={`flex-1 text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1 ${u.active === false ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {busyUid === u.uid ? <Loader2 size={13} className="animate-spin" /> :
                        u.active === false ? <><UserCheck size={13} /> تفعيل</> : <><UserX size={13} /> تعطيل</>}
                    </button>
                    <button onClick={() => handleDelete(u)} disabled={busyUid === u.uid}
                      className="flex-1 bg-red-50 text-red-700 text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                      <Trash2 size={13} /> حذف
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// شاشة المصاريف الثابتة الشهرية
function ManageFixedExpenses({ onBack }) {
  const month = monthStr();
  const [toiaAmount, setToiaAmount] = useState('');
  const [wardanaAmount, setWardanaAmount] = useState('');
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
        if (t) setToiaAmount(String(t.amount));
        if (w) setWardanaAmount(String(w.amount));
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
      await setFixedExpense({ month, branchId: 'toia', amount: toiaAmount });
      await setFixedExpense({ month, branchId: 'wardana', amount: wardanaAmount });
      setDone(true);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white pb-20">
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={onBack} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 pr-8">المصاريف الثابتة</h2>
      </div>

      <div className="p-6 space-y-5 flex-1">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
          <p className="text-indigo-800 font-bold text-sm">شهر {month}</p>
          <p className="text-indigo-500 text-[11px] mt-1">إيجار + رواتب + تأمينات لكل فرع</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : (
          <>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">فرع تويا — الثابتة الشهرية</label>
              <input type="number" placeholder="0.00" value={toiaAmount} onChange={(e) => setToiaAmount(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-left outline-none focus:border-blue-500" dir="ltr" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">فرع وردانة — الثابتة الشهرية</label>
              <input type="number" placeholder="0.00" value={wardanaAmount} onChange={(e) => setWardanaAmount(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-left outline-none focus:border-blue-500" dir="ltr" />
            </div>

            {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
            {done && (
              <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
                <CheckCircle2 size={18} /> تم الحفظ
              </p>
            )}

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={18} className="animate-spin" />}
              {saving ? 'جارٍ الحفظ...' : 'حفظ المصاريف الثابتة'}
            </button>
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

  return (
    <div className="flex flex-col h-full bg-white pb-20">
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={onBack} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 pr-8">التصنيفات</h2>
      </div>

      <div className="p-4 space-y-3 flex-1 overflow-y-auto">
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 flex items-center justify-center gap-2">
            <Plus size={18} /> إضافة تصنيف
          </button>
        )}

        {showForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-slate-800">تصنيف جديد</h3>
            <input type="text" placeholder="اسم التصنيف (مثل: كهرباء)"
              value={newName} onChange={(e) => setNewName(e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500" />

            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block">نوع المصروف (لتقارير المدير)</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500">
                <option value="general">عام</option>
                <option value="flower">ورد</option>
                <option value="delivery">توصيل</option>
                <option value="marketing">تسويق</option>
              </select>
            </div>

            <label className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 cursor-pointer">
              <span className="text-sm font-bold text-gray-700">صورة الفاتورة إجبارية</span>
              <input type="checkbox" checked={newReq} onChange={(e) => setNewReq(e.target.checked)}
                className="w-5 h-5 accent-blue-600" />
            </label>

            {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-2 text-center">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setError(''); }}
                className="flex-1 bg-white border border-gray-300 text-gray-600 font-bold py-2.5 rounded-xl text-sm">
                إلغاء
              </button>
              <button onClick={handleAdd} disabled={saving}
                className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'جارٍ...' : 'حفظ'}
              </button>
            </div>
          </div>
        )}

        {!showForm && error && (
          <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : (
          <div className="space-y-2">
            {cats.map((cat) => (
              <div key={cat.id} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800">{cat.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {cat.requiresImage ? '🔴 صورة إجبارية' : '⚪ صورة اختيارية'}
                    {' · '}
                    {cat.expenseType === 'flower' ? 'ورد' :
                     cat.expenseType === 'delivery' ? 'توصيل' :
                     cat.expenseType === 'marketing' ? 'تسويق' : 'عام'}
                  </p>
                </div>

                {/* مفتاح تبديل "يتطلب صورة" */}
                <button onClick={() => toggleRequires(cat)} disabled={busyId === cat.id}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${cat.requiresImage ? 'bg-blue-600' : 'bg-gray-300'} disabled:opacity-50`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${cat.requiresImage ? 'translate-x-1' : 'translate-x-6'}`} />
                </button>

                <button onClick={() => handleDelete(cat)} disabled={busyId === cat.id}
                  className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50">
                  {busyId === cat.id ? <Loader2 size={14} className="animate-spin" /> : <span className="text-xs font-bold">حذف</span>}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center pt-2">
          اضغط المفتاح الأزرق لتبديل "صورة إجبارية" لأي تصنيف
        </p>
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
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={onBack} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 pr-8">تغيير رمزي السري</h2>
      </div>

      <div className="p-6 space-y-4 flex-1">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
          <Key size={20} className="text-blue-600 mx-auto mb-2" />
          <p className="text-blue-800 font-bold text-sm">تحديث الرمز السري لحسابك</p>
          <p className="text-blue-500 text-[11px] mt-1">سيتم التحقق من الرمز الحالي قبل التغيير</p>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">الرمز الحالي</label>
          <input type="password" inputMode="numeric" maxLength={4} value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-center tracking-[0.5em] font-mono text-lg outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">الرمز الجديد</label>
          <input type="password" inputMode="numeric" maxLength={4} value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-center tracking-[0.5em] font-mono text-lg outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">تأكيد الرمز الجديد</label>
          <input type="password" inputMode="numeric" maxLength={4} value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} placeholder="••••"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-center tracking-[0.5em] font-mono text-lg outline-none focus:border-blue-500" />
        </div>

        {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم تغيير الرمز بنجاح
          </p>
        )}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'جارٍ التحديث...' : 'حفظ الرمز الجديد'}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// شاشة تسجيل المبيعات/المصاريف للمدير (لأي فرع)
// ==========================================
function AdminDataEntry({ onBack }) {
  const [step, setStep] = useState('menu');
  const [chosenBranch, setChosenBranch] = useState('toia');
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    (async () => {
      try { setBranches(await getBranches()); }
      catch { setBranches([{ id: 'toia', name: 'تويا' }, { id: 'wardana', name: 'وردانة' }]); }
    })();
  }, []);

  const branchName = branches.find((b) => b.id === chosenBranch)?.name
    || (chosenBranch === 'wardana' ? 'وردانة' : 'تويا');

  if (step === 'sales') {
    return (
      <AdminSalesForm onBack={() => setStep('menu')} branchId={chosenBranch} branchName={branchName} />
    );
  }
  if (step === 'expense') {
    return (
      <AdminExpenseForm onBack={() => setStep('menu')} branchId={chosenBranch} />
    );
  }

  return (
    <div className="flex flex-col h-full bg-white pb-20">
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={onBack} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 pr-8">تسجيل بيانات (مدير)</h2>
      </div>

      <div className="p-6 space-y-4 flex-1">
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
          <p className="text-indigo-800 font-bold text-sm">إدخال نيابة عن أي فرع</p>
          <p className="text-indigo-500 text-[11px] mt-1">اختر الفرع، ثم نوع التسجيل</p>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-2 block">اختر الفرع</label>
          <div className="flex gap-2 flex-wrap">
            {(branches.length ? branches : [{ id: 'toia', name: 'تويا' }, { id: 'wardana', name: 'وردانة' }]).map((b) => (
              <button key={b.id} onClick={() => setChosenBranch(b.id)}
                className={`flex-1 min-w-[120px] py-3 rounded-xl text-sm font-bold border ${chosenBranch === b.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-500 border-gray-200'}`}>
                {b.name}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 space-y-3">
          <button onClick={() => setStep('sales')}
            className="w-full bg-blue-600 text-white p-5 rounded-2xl shadow-md flex items-center gap-4 active:scale-95 transition-transform">
            <div className="bg-white/20 p-3 rounded-xl"><TrendingUp size={24} /></div>
            <div className="text-right">
              <h3 className="font-bold text-base mb-0.5">تسجيل المبيعات</h3>
              <p className="text-blue-100 text-xs">فرع {branchName}</p>
            </div>
          </button>
          <button onClick={() => setStep('expense')}
            className="w-full bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-95 transition-transform">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-xl"><Receipt size={24} /></div>
            <div className="text-right">
              <h3 className="font-bold text-gray-800 text-base mb-0.5">تسجيل مصروف</h3>
              <p className="text-gray-500 text-xs">فرع {branchName}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
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
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={onBack} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 pr-8">مبيعات — {branchName}</h2>
      </div>
      <div className="p-6 space-y-5 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">الفرع</label>
            <div className="w-full p-3 bg-slate-900 text-white rounded-xl text-sm font-bold text-center">{branchName}</div>
          </div>
        </div>

        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center">
              <div className="w-1/3 text-gray-600 font-bold text-sm">{f.label}</div>
              <input type="number" placeholder="0.00" value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-2/3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-left outline-none focus:border-blue-500" dir="ltr" />
            </div>
          ))}
        </div>

        <div className="bg-blue-50 p-5 rounded-2xl text-center border border-blue-100">
          <p className="text-blue-800 font-bold mb-1 text-sm">الإجمالي</p>
          <p className="text-3xl font-bold text-blue-700 font-mono">{total.toLocaleString()} <SarSymbol /></p>
        </div>

        {Number(mada) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
            <p className="text-amber-900 font-bold text-xs">💳 رسوم مدى ({(MADA_FEE_RATE * 100).toFixed(2)}%)</p>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-red-700">- رسوم:</span>
              <span className="font-mono text-red-700">{madaFeesAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-amber-200">
              <span className="text-emerald-800">صافي مدى:</span>
              <span className="font-mono text-emerald-800">{madaNetAmt.toLocaleString()} <SarSymbol /></span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-amber-300">
              <span className="text-slate-900">الإجمالي بعد الرسوم:</span>
              <span className="font-mono text-slate-900">{netTotal.toLocaleString()} <SarSymbol /></span>
            </div>
          </div>
        )}

        {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم الحفظ بنجاح
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
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
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={onBack} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 pr-8">مصروف — {branchName}</h2>
      </div>
      <div className="p-6 space-y-4 flex-1">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">التصنيف</label>
          {loadingCats ? (
            <div className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-400 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> جارٍ التحميل...
            </div>
          ) : (
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:border-blue-500">
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
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">المبلغ</label>
          <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-left outline-none focus:border-blue-500" dir="ltr" />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">طريقة الدفع</label>
          <div className="flex gap-2">
            {(methods.length ? methods : [{ id: 'Cash', labelAr: 'Cash' }, { id: 'Mada', labelAr: 'Mada' }, { id: 'Transfer', labelAr: 'Transfer' }]).map((p) => (
              <button key={p.id} onClick={() => setPayMethod(p.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${payMethod === p.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                {p.labelAr || p.name || p.id}
              </button>
            ))}
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          onChange={handleFileChange} className="hidden" />

        <div className={`p-5 rounded-2xl border-2 border-dashed ${requiresImage && !imageFile ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
          {imagePreview ? (
            <div className="text-center">
              <img src={imagePreview} alt="معاينة" className="max-h-32 mx-auto rounded-xl shadow mb-2 object-contain" />
              <div className="flex gap-2 justify-center">
                <button onClick={handlePickImage} className="bg-white border border-gray-300 px-4 py-1.5 rounded-lg text-xs font-bold">
                  تغيير
                </button>
                <button onClick={() => { setImageFile(null); setImagePreview(''); }}
                  className="bg-white border border-red-200 text-red-600 px-4 py-1.5 rounded-lg text-xs font-bold">
                  حذف
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Camera className={`mx-auto mb-2 ${requiresImage ? 'text-red-500' : 'text-gray-400'}`} size={28} />
              <p className={`text-sm font-bold ${requiresImage ? 'text-red-700' : 'text-gray-700'} mb-3`}>
                {requiresImage ? 'صورة الفاتورة مطلوبة!' : 'صورة الفاتورة (اختياري)'}
              </p>
              <button onClick={handlePickImage}
                className="bg-white border border-gray-300 px-5 py-2 rounded-xl text-xs font-bold flex gap-2 mx-auto">
                <UploadCloud size={14} /> اختيار صورة
              </button>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم الحفظ
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
          {(saving || uploading) && <Loader2 size={18} className="animate-spin" />}
          {uploading ? 'جارٍ رفع الصورة...' : saving ? 'جارٍ الحفظ...' : 'حفظ المصروف'}
        </button>
      </div>
    </div>
  );
}
