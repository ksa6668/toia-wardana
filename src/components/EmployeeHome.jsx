// src/components/EmployeeHome.jsx
// ----------------------------------------------------------
// الصفحة الرئيسية للموظف — بطاقة ترحيب + شريط الشهر + كروت KPIs
// (الميزانية / التقييمات / واتساب) + أزرار التسجيل + جدول واتساب.
// مُستخرَجة من App.jsx.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Receipt, TrendingUp, Calendar, MessageCircle } from 'lucide-react';
import { getSales, salesNet, getMonthlyGoal, getWhatsappEntries } from '../firebase';
import { t } from '../i18n';
import { formatMonthLabel } from '../utils/periodHelpers';
import EmployeeWhatsappTable from './EmployeeWhatsappTable';

export default function EmployeeHome({ setView, branch, branchId, lang }) {
  const align = lang === 'en' ? 'text-left' : 'text-right';

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
        // Batch 49: نسبة تحقيق واتساب - تعتمد على whatsappTarget من goal
        // Batch 55: يدعم نوعين:
        //   • نسبة (pct):   % المشترين من إجمالي عملاء الواتساب
        //   • مبلغ (amount): مبلغ ريالي = مبيعات التحويل (أونلاين) المحقّقة ÷ الهدف
        const totalCustomers = branchWa.reduce((sum, w) => sum + (w.customers || 0), 0);
        const totalBuyers = branchWa.reduce((sum, w) => sum + (w.buyers || 0), 0);
        const totalTransfer = branchSales.reduce((sum, s) => sum + (Number(s.transfer) || 0), 0);
        const actualPct = totalCustomers > 0 ? (totalBuyers / totalCustomers) * 100 : 0;
        const whatsappTarget = Number(goal.whatsappTarget) || 0;
        const whatsappTargetType = goal.whatsappTargetType === 'amount' ? 'amount' : 'pct';
        const whatsappPct = whatsappTarget > 0
          ? (whatsappTargetType === 'amount'
              ? Math.min(100, Math.round((totalTransfer / whatsappTarget) * 100))
              : Math.min(100, Math.round((actualPct / whatsappTarget) * 100)))
          : 0;
        const whatsappNoTarget = whatsappTarget <= 0;
        // Batch 46.5: لا نعرض 0/0 — فقط إذا فيه بيانات
        // Batch 55: للنوع "مبلغ" نعرض المبلغ المحقّق/الهدف بالريال
        const whatsappSubtext = whatsappTargetType === 'amount'
          ? (whatsappTarget > 0 ? `${totalTransfer.toLocaleString('en-US')} / ${whatsappTarget.toLocaleString('en-US')} ﷼` : '')
          : (totalCustomers > 0 ? `${totalBuyers} / ${totalCustomers}` : '');
        if (!cancelled) {
          setKpis({ budgetPct, reviewsPct, whatsappPct, whatsappSubtext, whatsappNoTarget, loaded: true, hasGoal: goal.exists });
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
              {kpis.whatsappNoTarget ? (
                <p className="text-[10px] font-bold whitespace-nowrap opacity-80 text-center w-full">
                  {lang === 'en' ? 'No target set' : 'لم يُحدّد هدف'}
                </p>
              ) : (
                <>
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
                </>
              )}
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
