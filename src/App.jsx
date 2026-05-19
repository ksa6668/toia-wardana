import React, { useState, useMemo, useEffect } from 'react';
import {
  LogOut, Receipt, TrendingUp, TrendingDown,
  Settings, Camera, ChevronRight, Building2,
  BarChart3, Wallet, UploadCloud,
  Calendar, Globe, Store, PieChart, Activity, CreditCard,
  ShoppingCart, Car, Megaphone, Layers, Loader2, Users, Plus, CheckCircle2
} from 'lucide-react';
import {
  login, logout, watchAuth,
  addDailySales, addExpense,
  getSales, getExpenses, getFixedExpenses, setFixedExpense,
  getUsers, createStaffUser,
} from './firebase';

// ==========================================
// أدوات تواريخ مساعدة
// ==========================================
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = (d = new Date()) => d.toISOString().slice(0, 7); // YYYY-MM

// يحسب نطاق التاريخ حسب الفترة المختارة
function periodRange(period) {
  const now = new Date();
  if (period === 'يومي') {
    const d = todayStr();
    return { from: d, to: d, days: 1, daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() };
  }
  if (period === 'شهري') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      from: first.toISOString().slice(0, 10),
      to: last.toISOString().slice(0, 10),
      days: now.getDate(),
      daysInMonth: last.getDate(),
    };
  }
  // سنوي
  const first = new Date(now.getFullYear(), 0, 1);
  const last = new Date(now.getFullYear(), 11, 31);
  const dayOfYear = Math.floor((now - first) / 86400000) + 1;
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
    days: dayOfYear,
    daysInMonth: 30,
  };
}

// ==========================================
// التطبيق الرئيسي
// ==========================================
export default function App() {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminTab, setAdminTab] = useState('dashboard');

  const userRole = user?.role || null;
  const branchId = user?.branchId || 'toia';
  const branch = branchId === 'wardana' ? 'وردانة' : 'تويا';

  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u);
      setAuthLoading(false);
      setCurrentView(u ? (u.role === 'admin' ? 'adminHome' : 'employeeHome') : 'login');
    });
    return () => unsub();
  }, []);

  const handleLoginSuccess = (u) => {
    setUser(u);
    setCurrentView(u.role === 'admin' ? 'adminHome' : 'employeeHome');
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setCurrentView('login');
    setAdminTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 font-sans text-right" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(8,_112,_184,_0.15)] overflow-hidden border-8 border-slate-900 relative h-[850px] flex flex-col">

        {currentView !== 'login' && !authLoading && (
          <header className="bg-slate-900 text-white p-5 pt-8 z-20 relative">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold tracking-wide">Toia &amp; Wardana</h1>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  {user?.displayName || 'Finance Control'}
                </p>
              </div>
              <button onClick={handleLogout} className="p-2.5 bg-slate-800 rounded-full hover:bg-red-500 transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          </header>
        )}

        <main className="flex-1 overflow-y-auto bg-slate-50 relative z-10">
          {authLoading && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 size={32} className="animate-spin" />
              <p className="text-sm font-bold">جارٍ التحميل...</p>
            </div>
          )}
          {!authLoading && currentView === 'login' && <LoginView onLoginSuccess={handleLoginSuccess} />}
          {!authLoading && currentView === 'employeeHome' && <EmployeeHome setView={setCurrentView} branch={branch} />}
          {!authLoading && currentView === 'salesForm' && <SalesForm setView={setCurrentView} branch={branch} branchId={branchId} />}
          {!authLoading && currentView === 'expenseForm' && <ExpenseForm setView={setCurrentView} branchId={branchId} />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'dashboard' && <SuperAdminDashboard />}
          {!authLoading && currentView === 'adminHome' && adminTab === 'settings' && <AdminSettings />}
        </main>

        {userRole === 'admin' && currentView === 'adminHome' && !authLoading && (
          <nav className="absolute bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-3 pb-6 z-30 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
            <button onClick={() => setAdminTab('dashboard')}
              className={`flex flex-col items-center p-2 transition-colors ${adminTab === 'dashboard' ? 'text-blue-600 scale-110' : 'text-gray-400'}`}>
              <BarChart3 size={24} />
              <span className="text-[11px] mt-1 font-bold">الملخصات الشاملة</span>
            </button>
            <button onClick={() => setAdminTab('settings')}
              className={`flex flex-col items-center p-2 transition-colors ${adminTab === 'settings' ? 'text-blue-600 scale-110' : 'text-gray-400'}`}>
              <Settings size={24} />
              <span className="text-[11px] mt-1 font-bold">الإعدادات</span>
            </button>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState({ sales: [], expenses: [], fixed: [] });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { from, to } = periodRange(period);
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
  }, [period]);

  const m = useMemo(() => {
    const { days, daysInMonth } = periodRange(period);

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
      if (period === 'يومي') return fm / daysInMonth;
      if (period === 'شهري') return fm;
      return fm * 12;
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
    const avgSales = Math.round(totalSales / safeDays);
    const avgExp = Math.round(totalExp / safeDays);
    const avgFlower = Math.round((toia.flowerExp + wardana.flowerExp) / safeDays);
    const avgDelivery = Math.round((toia.deliveryExp + wardana.deliveryExp) / safeDays);
    const avgMarketing = Math.round((toia.marketingExp + wardana.marketingExp) / safeDays);

    return {
      data: { toia, wardana, days: safeDays },
      toiaFixed, wardanaFixed, toiaTotalExp, wardanaTotalExp,
      toiaProfit, wardanaProfit, totalSales, totalVarExp, totalFixedExp,
      totalExp, totalProfit, totalCash, totalMada, totalTransfer,
      onlineSales, offlineSales, onlinePerc, offlinePerc,
      toiaFlowerPerc, wardanaFlowerPerc, totalFlowerPerc,
      avgSales, avgExp, avgFlower, avgDelivery, avgMarketing,
    };
  }, [raw, period]);

  const profitLabel = period === 'يومي' ? 'الربحية اليومية' : period === 'شهري' ? 'الربحية الشهرية' : 'الربحية السنوية';
  const isEmpty = !loading && m.totalSales === 0 && m.totalExp === 0;

  return (
    <div className="flex flex-col h-full pb-20">
      <div className="bg-white p-4 shadow-sm z-10 sticky top-0 flex justify-between items-center border-b border-gray-100">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <Calendar size={18} className="text-blue-600" />
          <span>فترة التقرير:</span>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-sm font-bold rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 text-blue-700">
          <option value="يومي">يومي (اليوم)</option>
          <option value="شهري">شهري (هذا الشهر)</option>
          <option value="سنوي">سنوي (هذا العام)</option>
        </select>
      </div>

      <div className="bg-white border-b border-gray-100 px-2 py-3 overflow-x-auto whitespace-nowrap flex gap-2">
        <ReportTab id="overview" current={activeReport} set={setActiveReport} icon={<Activity size={16} />} label="نظرة عامة" />
        <ReportTab id="branches" current={activeReport} set={setActiveReport} icon={<Store size={16} />} label="مقارنة الفروع" />
        <ReportTab id="averages" current={activeReport} set={setActiveReport} icon={<PieChart size={16} />} label="المتوسطات" />
        <ReportTab id="payments" current={activeReport} set={setActiveReport} icon={<Wallet size={16} />} label="طرق الدفع" />
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
                <p className="text-slate-300 font-bold text-xs mb-2">إجمالي صافي الربح — {profitLabel}</p>
                <p className="text-4xl font-bold font-mono text-emerald-400">
                  {Math.round(m.totalProfit).toLocaleString()} <span className="text-sm font-sans text-slate-400">ريال</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-2 bg-slate-800 w-fit px-2 py-1 rounded">
                  المبيعات − (المصاريف المتغيرة + نصيب الثابتة)
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="المبيعات" value={m.totalSales} icon={<TrendingUp size={16} className="text-emerald-500" />} />
                <StatCard label="المصاريف" value={m.totalExp} icon={<TrendingDown size={16} className="text-red-500" />} />
                <StatCard label="م. متغيرة" value={m.totalVarExp} icon={<Receipt size={16} className="text-orange-500" />} />
                <StatCard label="نصيب الثابتة" value={m.totalFixedExp} icon={<Building2 size={16} className="text-indigo-500" />} />
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 text-sm flex items-center gap-2">
                  <Globe size={16} className="text-blue-600" /> قنوات البيع (أون لاين / أوف لاين)
                </h3>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-blue-700">أون لاين: {m.onlinePerc}%</span>
                  <span className="text-slate-700">أوف لاين: {m.offlinePerc}%</span>
                </div>
                <div className="h-3 w-full flex rounded-full overflow-hidden mb-3 bg-slate-100">
                  <div style={{ width: `${m.onlinePerc}%` }} className="bg-blue-500"></div>
                  <div style={{ width: `${m.offlinePerc}%` }} className="bg-slate-300"></div>
                </div>
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>التحويلات ({m.onlineSales.toLocaleString()})</span>
                  <span>النقد ومدى ({m.offlineSales.toLocaleString()})</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                  <ShoppingCart size={16} className="text-pink-500" /> نسبة تكلفة الورد للمبيعات
                </h3>
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-pink-600 font-mono">{m.totalFlowerPerc}%</p>
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
                <h3 className="font-bold mb-1 text-sm flex items-center gap-2"><PieChart size={18} /> المتوسطات اليومية</h3>
                <p className="text-blue-200 text-xs">محسوبة على أساس {m.data.days} يوم بناءً على فلتر ({period})</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <AverageCard title="متوسط المبيعات" amount={m.avgSales} icon={<TrendingUp size={16} className="text-emerald-500" />} />
                <AverageCard title="متوسط المصاريف" amount={m.avgExp} icon={<TrendingDown size={16} className="text-red-500" />} />
                <AverageCard title="متوسط الورد" amount={m.avgFlower} icon={<ShoppingCart size={16} className="text-pink-500" />} />
                <AverageCard title="متوسط التوصيل" amount={m.avgDelivery} icon={<Car size={16} className="text-orange-500" />} />
                <AverageCard title="متوسط التسويق" amount={m.avgMarketing} icon={<Megaphone size={16} className="text-purple-500" />} full />
              </div>
            </div>
          )}

          {activeReport === 'payments' && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-5 text-sm flex items-center gap-2">
                <CreditCard size={18} className="text-blue-600" /> تحليل طرق الدفع
              </h3>
              <div className="space-y-5">
                <PaymentBar label="مدى (شبكة)" amount={m.totalMada} total={m.totalSales} color="bg-blue-500" />
                <PaymentBar label="تحويل (أون لاين)" amount={m.totalTransfer} total={m.totalSales} color="bg-purple-500" />
                <PaymentBar label="نقدي (كاش)" amount={m.totalCash} total={m.totalSales} color="bg-emerald-500" />
              </div>
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
function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!username.trim()) { setError('أدخل اسم المستخدم'); return; }
    if (!/^\d{4}$/.test(pin)) { setError('الرمز يجب أن يكون 4 أرقام'); return; }
    setLoading(true);
    try {
      const u = await login(username, pin);
      onLoginSuccess(u);
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setError('اسم المستخدم أو الرمز غير صحيح');
      } else if (code.includes('too-many-requests')) {
        setError('محاولات كثيرة، حاول بعد قليل');
      } else if (code.includes('network')) {
        setError('تحقق من اتصال الإنترنت');
      } else {
        setError(err?.message || 'تعذّر تسجيل الدخول');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col justify-center bg-white">
      <div className="text-center mb-8">
        <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center bg-slate-50 rounded-3xl border border-slate-100 shadow-sm">
          <Building2 size={40} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">نظام المبيعات والمصاريف</h1>
        <p className="text-slate-500 mt-2 text-sm font-medium">Toia &amp; Wardana Finance</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">اسم المستخدم</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
            placeholder="مثال: admin" autoCapitalize="off"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">الرمز السري (4 أرقام)</label>
          <input type="password" inputMode="numeric" maxLength={4} value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="••••"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 text-center tracking-[0.5em] font-mono text-lg" />
        </div>
        {error && (
          <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>
        )}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
        </button>
      </div>
      <p className="text-center text-[11px] text-gray-400 mt-8">الفرع يُحدد تلقائياً حسب حساب المستخدم</p>
    </div>
  );
}

// ==========================================
// الصفحة الرئيسية للموظف
// ==========================================
function EmployeeHome({ setView, branch }) {
  return (
    <div className="p-6 h-full flex flex-col gap-4 pt-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center mb-2">
        <p className="text-gray-500 mb-1">مرحباً بك في</p>
        <h2 className="text-3xl font-bold text-blue-600">فرع {branch}</h2>
      </div>
      <button onClick={() => setView('salesForm')} className="bg-blue-600 text-white p-6 rounded-2xl shadow-md flex items-center gap-4 active:scale-95 transition-transform">
        <div className="bg-white/20 p-4 rounded-xl"><TrendingUp size={32} /></div>
        <div className="text-right">
          <h3 className="font-bold text-xl mb-1">تسجيل المبيعات</h3>
          <p className="text-blue-100 text-sm">إضافة مبيعات يومية جديدة</p>
        </div>
      </button>
      <button onClick={() => setView('expenseForm')} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-95 transition-transform">
        <div className="bg-blue-50 text-blue-600 p-4 rounded-xl"><Receipt size={32} /></div>
        <div className="text-right">
          <h3 className="font-bold text-gray-800 text-xl mb-1">تسجيل مصروف</h3>
          <p className="text-gray-500 text-sm">إضافة مصروف أو فاتورة</p>
        </div>
      </button>
    </div>
  );
}

// ==========================================
// نموذج تسجيل المبيعات — يكتب في Firestore
// ==========================================
function SalesForm({ setView, branch, branchId }) {
  const [date, setDate] = useState(todayStr());
  const [cash, setCash] = useState('');
  const [mada, setMada] = useState('');
  const [transfer, setTransfer] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const total = (Number(cash) || 0) + (Number(mada) || 0) + (Number(transfer) || 0);

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
      setTimeout(() => setView('employeeHome'), 1200);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative z-10">
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={() => setView('employeeHome')} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 pr-8">تسجيل المبيعات</h2>
      </div>
      <div className="p-6 space-y-6 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">الفرع (تلقائي)</label>
            <div className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm font-bold text-blue-700">{branch}</div>
          </div>
        </div>

        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center">
              <div className="w-1/3 text-gray-600 font-bold">{f.label}</div>
              <input type="number" placeholder="0.00" value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-2/3 p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-left outline-none focus:border-blue-500" dir="ltr" />
            </div>
          ))}
        </div>

        <div className="bg-blue-50 p-6 rounded-2xl text-center border border-blue-100">
          <p className="text-blue-800 font-bold mb-2">الإجمالي</p>
          <p className="text-3xl font-bold text-blue-700 font-mono">{total.toLocaleString()} ريال</p>
        </div>

        {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم الحفظ بنجاح
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'جارٍ الحفظ...' : 'حفظ وإرسال'}
        </button>
      </div>
    </div>
  );
}

// ==========================================
// نموذج تسجيل المصروف — يكتب في Firestore
// ==========================================
const EXPENSE_CATEGORIES = [
  { id: 'ورد', label: 'ورد (صورة إجبارية)', requiresImage: true },
  { id: 'طلبات العملاء', label: 'طلبات العملاء (صورة إجبارية)', requiresImage: true },
  { id: 'مستلزمات وبضائع', label: 'مستلزمات وبضائع (صورة إجبارية)', requiresImage: true },
  { id: 'توصيل', label: 'توصيل', requiresImage: false },
  { id: 'تسويق', label: 'تسويق', requiresImage: false },
  { id: 'كهرباء', label: 'كهرباء', requiresImage: false },
  { id: 'إنترنت', label: 'إنترنت', requiresImage: false },
  { id: 'خدمات', label: 'خدمات', requiresImage: false },
  { id: 'صيانة', label: 'صيانة', requiresImage: false },
  { id: 'أخرى', label: 'أخرى', requiresImage: false },
];

function ExpenseForm({ setView, branchId }) {
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const requiresImage = EXPENSE_CATEGORIES.find((c) => c.id === category)?.requiresImage || false;

  const handleSave = async () => {
    setError('');
    if (!category) { setError('اختر التصنيف'); return; }
    if (!(Number(amount) > 0)) { setError('أدخل مبلغاً صحيحاً'); return; }
    setSaving(true);
    try {
      await addExpense({
        date,
        branchId,
        categoryId: category,
        amount,
        paymentMethodId: payMethod,
      });
      setDone(true);
      setTimeout(() => setView('employeeHome'), 1200);
    } catch (err) {
      setError(err?.message || 'تعذّر الحفظ');
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative z-10">
      <div className="flex items-center p-4 border-b border-gray-100">
        <button onClick={() => setView('employeeHome')} className="p-2 text-slate-600 bg-slate-100 rounded-full">
          <ChevronRight size={20} className="rotate-180" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-gray-800 pr-8">تسجيل مصروف</h2>
      </div>
      <div className="p-6 space-y-5 flex-1">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm outline-none focus:border-blue-500" />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">التصنيف</label>
          <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 outline-none focus:border-blue-500"
            value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">اختر التصنيف...</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">المبلغ</label>
          <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-left outline-none focus:border-blue-500" dir="ltr" />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-500 mb-1.5 block">طريقة الدفع</label>
          <div className="flex gap-2">
            {['Cash', 'Mada', 'Transfer'].map((p) => (
              <button key={p} onClick={() => setPayMethod(p)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${payMethod === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className={`p-6 rounded-2xl border-2 border-dashed ${requiresImage ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="text-center">
            <Camera className={`mx-auto mb-3 ${requiresImage ? 'text-red-500' : 'text-gray-400'}`} size={32} />
            <p className={`text-sm font-bold ${requiresImage ? 'text-red-700' : 'text-gray-700'} mb-4`}>
              {requiresImage ? 'صورة الفاتورة مطلوبة!' : 'صورة الفاتورة (اختياري)'}
            </p>
            <button className="bg-white border border-gray-300 px-6 py-2.5 rounded-xl text-sm font-bold flex gap-2 mx-auto">
              <UploadCloud size={16} /> إرفاق
            </button>
            <p className="text-[10px] text-gray-400 mt-3">رفع الصور إلى Cloudflare R2 يُفعّل لاحقاً</p>
          </div>
        </div>

        {error && <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>}
        {done && (
          <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> تم الحفظ بنجاح
          </p>
        )}

        <button onClick={handleSave} disabled={saving || done}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-md hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'جارٍ الحفظ...' : 'حفظ المصروف'}
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

  const items = [
    { key: 'users', label: 'المستخدمون والصلاحيات', desc: 'إضافة موظفين ومديرين', enabled: true },
    { key: 'fixed', label: 'المصاريف الثابتة', desc: 'إيجار ورواتب — شهري لكل فرع', enabled: true },
    { key: 'branches', label: 'الفروع', desc: 'تويا، وردانة', enabled: false },
    { key: 'categories', label: 'التصنيفات والفواتير', desc: 'تحديد التصنيفات وإلزامية الصورة', enabled: false },
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
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('employee');
  const [branchId, setBranchId] = useState('toia');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.uid} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                <div className={`p-2 rounded-lg ${u.role === 'admin' ? 'bg-slate-800 text-white' : 'bg-blue-50 text-blue-600'}`}>
                  <Users size={18} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800">{u.displayName || u.username}</p>
                  <p className="text-[11px] text-gray-400">
                    {u.role === 'admin' ? 'مدير' : 'موظف'} · فرع {u.branchId === 'wardana' ? 'وردانة' : 'تويا'}
                  </p>
                </div>
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
