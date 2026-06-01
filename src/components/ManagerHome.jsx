// src/components/ManagerHome.jsx
// ----------------------------------------------------------
// شاشة المدير الرئيسية — كروت KPI لكل فرع
// مطابقة لتصميم index.html الـ prototype في شاشة 'home' للمدير.
//
// Batch 3: تربط بـ Firestore الحقيقي:
//   - تجلب الفروع من getBranches()
//   - تجلب الأهداف للشهر/السنة عبر getAllGoalsForMonth() / getMonthlyGoal()
//   - تجلب المبيعات وتحسب نسبة تحقيق الميزانية فعلياً
// التقييمات: placeholder حالياً (يحتاج Google Places API)
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import BottomSheet from './BottomSheet';
import BudgetGoalEdit from './BudgetGoalEdit';
import ReviewsGoalEdit from './ReviewsGoalEdit';
import WhatsappGoalEdit from './WhatsappGoalEdit';
import { getBranches, getMonthlyGoal, getSales, salesNet, getWhatsappEntries } from '../firebase';
import { usePersistedState } from '../hooks/usePersistedState';
import {
  formatMonthLabel,
  monthRange,
} from '../utils/periodHelpers';
import { addNotification } from './NotificationsCenter';

const NAVY_GRADIENT = {
  background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
  boxShadow: '0 8px 20px rgba(0,91,255,0.18)',
};
const SHINE_OVERLAY = {
  background: 'radial-gradient(circle at 89% 8%, rgba(40,223,255,0.5), transparent 28%)',
};

// كارت KPI واحد (تحقيق الميزانية أو التقييمات)
// Batch 49: onClick يفتح صفحة إدخال الهدف
function KpiCard({ label, percent, showStars, onClick, subtext }) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="text-white p-3 rounded-2xl overflow-hidden relative active:scale-95 transition-transform"
      style={{ ...NAVY_GRADIENT, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); }
      }}
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={SHINE_OVERLAY} />
      <div className="relative flex flex-col items-center text-center gap-2 min-h-[130px] justify-between">
        <p className="text-xs font-bold opacity-95">{label}</p>
        <p className="text-3xl font-extrabold leading-none">{pct}%</p>
        {showStars && (
          <p className="text-xs tracking-[0.15em]">⭐⭐⭐⭐⭐</p>
        )}
        {subtext && (
          <p className="text-[10px] opacity-80 font-bold">{subtext}</p>
        )}
        <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #28DFFF 0%, #22D08A 100%)',
              boxShadow: '0 0 8px rgba(40,223,255,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// SVG شعار صغير يطابق الـ prototype: 4 ورقات أزرق
// أيقونة الفرع — مطابقة #i-flower symbol في الـ prototype
// الـ styling (size/stroke/color) يأتي من .tw-branch-divider .branch-name svg
function WindmillIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 9.5V4a3 3 0 1 1 3 3" />
      <path d="M14.5 12H20a3 3 0 1 1-3 3" />
      <path d="M12 14.5V20a3 3 0 1 1-3-3" />
      <path d="M9.5 12H4a3 3 0 1 1 3-3" />
    </svg>
  );
}

// كارت KPI رفيع لتحقيق واتساب (متوازن مع الكروت الأخرى لكن أقصر)
// Batch 49: onClick يفتح صفحة إدخال نسبة الهدف
function WhatsappKpiCard({ label, percent, subtext, onClick, noTarget }) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="text-white px-3 py-2.5 rounded-2xl overflow-hidden relative active:scale-95 transition-transform"
      style={{ ...NAVY_GRADIENT, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); }
      }}
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={SHINE_OVERLAY} />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <p className="text-[11px] font-bold opacity-95 leading-tight">{label}</p>
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-[60%]">
          {noTarget ? (
            <p className="text-[10px] font-bold whitespace-nowrap opacity-80 text-center w-full">
              لم يُحدّد هدف
            </p>
          ) : (
            <>
              <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #28DFFF 0%, #22D08A 100%)',
                    boxShadow: '0 0 8px rgba(40,223,255,0.5)',
                  }}
                />
              </div>
              <p className="text-base font-extrabold leading-none whitespace-nowrap">{pct}%</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// قسم لكل فرع (عنوان + شبكة 2×1 + كرت واتساب)
// Batch 49: onBudgetClick / onReviewsClick / onWhatsappClick
function BranchSection({
  name, budgetPct, reviewsPct, reviewsSubtext,
  whatsappPct, whatsappSubtext, whatsappNoTarget,
  onBudgetClick, onReviewsClick, onWhatsappClick,
  lang
}) {
  return (
    <div className="mb-4">
      {/* فاصل اسم الفرع */}
      <div className="tw-branch-divider">
        <span className="line" />
        <span className="branch-name">
          <WindmillIcon />
          <span>{name}</span>
        </span>
        <span className="line" />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <KpiCard
          label={lang === 'en' ? 'Budget' : 'تحقيق الميزانية'}
          percent={budgetPct}
          onClick={onBudgetClick}
        />
        <KpiCard
          label={lang === 'en' ? 'Google Reviews' : 'تقييمات قوقل ماب'}
          percent={reviewsPct}
          showStars
          subtext={reviewsSubtext}
          onClick={onReviewsClick}
        />
      </div>
      {/* Batch 46: كرت تحقيق واتساب رفيع */}
      <WhatsappKpiCard
        label={lang === 'en' ? 'WhatsApp Sales' : 'تحقيق مبيعات واتساب'}
        percent={whatsappPct}
        subtext={whatsappSubtext}
        noTarget={whatsappNoTarget}
        onClick={onWhatsappClick}
      />
    </div>
  );
}

export default function ManagerHome({ lang }) {
  // Batch 46.5: لا توجد تبويبات - شهري فقط
  const [selectedMonth, setSelectedMonth] = usePersistedState('home.month', () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  // للقائمة المنبثقة
  const [sheet, setSheet] = useState(null);

  // ====== البيانات الحقيقية من Firestore ======
  // Batch 50: استعادة فورية من sessionStorage (يحدّث في الخلفية)
  const cacheKey = `home_kpis_${selectedMonth}`;
  const cachedSnapshot = (() => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      // صلاحية الـ cache: 5 دقائق
      if (Date.now() - (obj.ts || 0) > 5 * 60 * 1000) return null;
      return obj;
    } catch { return null; }
  })();
  const [branches, setBranches] = useState(cachedSnapshot?.branches || []);
  // map: { [branchId]: { budgetPct, reviewsPct, hasGoal, reviewsTarget, reviewsAchieved } }
  const [branchKpis, setBranchKpis] = useState(cachedSnapshot?.branchKpis || {});
  const [loading, setLoading] = useState(!cachedSnapshot); // لو فيه cache، نبدأ بدون loading
  const [error, setError] = useState('');
  const [refreshCounter, setRefreshCounter] = useState(0); // لإعادة تحميل البيانات بعد الحفظ
  // Batch 49: شاشة تعديل الهدف الحالية
  const [editScreen, setEditScreen] = useState(null); // { type: 'budget'|'reviews'|'whatsapp', branchId, branchName }

  // تحميل البيانات عند تغيير الفترة
  // Batch 50: تحميل متوازي - getBranches + getSales + getWhatsappEntries في نفس الوقت
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        // 1) النطاق الزمني (شهري فقط - Batch 46.5)
        const { from, to } = monthRange(selectedMonth);

        // 2) Batch 50: تحميل متوازي للفروع + المبيعات + الواتساب
        const [brs, allSales, allWhatsapp] = await Promise.all([
          getBranches(),
          getSales(from, to),
          getWhatsappEntries(from, to),
        ]);
        if (cancelled) return;

        // 3) الأهداف لكل فرع بشكل متوازي
        const goalsPromises = brs.map((b) =>
          getMonthlyGoal(b.id, selectedMonth).then((g) => ({
            branchId: b.id,
            budget: g.budget,
            reviewsTarget: g.reviewsTarget,
            reviewsAchieved: g.reviewsAchieved || 0,
            whatsappTarget: g.whatsappTarget || 0,
            whatsappTargetType: g.whatsappTargetType === 'amount' ? 'amount' : 'pct',
            exists: g.exists,
          }))
        );
        const goals = await Promise.all(goalsPromises);
        if (cancelled) return;

        // 4) حساب KPIs لكل فرع
        const kpisMap = {};
        for (const b of brs) {
          const goal = goals.find((g) => g.branchId === b.id) || { budget: 0, reviewsTarget: 0, reviewsAchieved: 0, whatsappTarget: 0, whatsappTargetType: 'pct' };
          const branchSales = allSales.filter((s) => s.branchId === b.id);
          const totalSales = branchSales.reduce((sum, s) => sum + salesNet(s), 0);
          const budgetPct = goal.budget > 0
            ? Math.min(100, Math.round((totalSales / goal.budget) * 100))
            : 0;
          // Batch 16: التقييمات من goal.reviewsAchieved / goal.reviewsTarget
          const reviewsPct = goal.reviewsTarget > 0
            ? Math.min(100, Math.round((goal.reviewsAchieved / goal.reviewsTarget) * 100))
            : 0;
          // Batch 49: نسبة تحقيق واتساب - تعتمد على whatsappTarget من goal
          // لو ما حُدّد هدف للشهر → noTarget = true (يعرض "لم يُحدّد هدف")
          const branchWa = allWhatsapp.filter((w) => w.branchId === b.id);
          const totalCustomers = branchWa.reduce((sum, w) => sum + (w.customers || 0), 0);
          const totalBuyers = branchWa.reduce((sum, w) => sum + (w.buyers || 0), 0);
          const actualPct = totalCustomers > 0 ? (totalBuyers / totalCustomers) * 100 : 0;
          // Batch 55: للنوع "مبلغ" نستخدم مبيعات التحويل (أونلاين) للفرع
          const totalTransfer = branchSales.reduce((sum, s) => sum + (Number(s.transfer) || 0), 0);
          const whatsappTarget = goal.whatsappTarget || 0;
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
          kpisMap[b.id] = {
            budgetPct, reviewsPct,
            whatsappPct, whatsappSubtext, whatsappNoTarget,
            hasGoal: goal.exists,
            reviewsTarget: goal.reviewsTarget || 0,
            reviewsAchieved: goal.reviewsAchieved || 0,
          };
        }
        setBranches(brs);
        setBranchKpis(kpisMap);

        // Batch 50: حفظ snapshot لـ sessionStorage (للعودة الفورية)
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            ts: Date.now(),
            branches: brs,
            branchKpis: kpisMap,
          }));
        } catch { /* قد يفشل في الوضع الخصوصي */ }

        // إذا لم يتم تحديد أي أهداف، أرسل إشعاراً (مرة واحدة في اليوم لكل شهر)
        const hasAnyGoals = Object.values(kpisMap).some((k) => k.hasGoal);
        if (!hasAnyGoals && brs.length > 0) {
          const notifKey = `goals_reminder_${selectedMonth}_${new Date().toDateString()}`;
          try {
            if (!localStorage.getItem(notifKey)) {
              addNotification({
                title: 'تذكير: الأهداف الشهرية',
                body: 'لم يتم تحديد أهداف لهذا الشهر بعد. حدّدها من الإعدادات.',
                emoji: '🎯',
                type: 'reminder',
              });
              localStorage.setItem(notifKey, '1');
            }
          } catch { /* localStorage may fail in private mode */ }
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل البيانات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedMonth, refreshCounter]);

  // Batch 46.5: قائمة الأشهر تبدأ من مايو 2026 وما بعد فقط
  const availableMonths = () => {
    const months = [];
    const now = new Date();
    const startYear = 2026;
    const startMonth = 5; // مايو
    const endYear = now.getFullYear();
    const endMonth = now.getMonth() + 1;
    let y = startYear, m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return months.reverse(); // أحدث شهر أولاً
  };

  const openPicker = () => {
    setSheet({
      title: lang === 'en' ? 'Pick month' : 'اختر الشهر',
      options: availableMonths().map((m) => ({ value: m, label: formatMonthLabel(m, lang) })),
      current: selectedMonth,
      onPick: (v) => { setSelectedMonth(v); setSheet(null); },
    });
  };

  const currentLabel = formatMonthLabel(selectedMonth, lang);

  // Batch 49: لو شاشة تعديل مفتوحة، نعرضها بدل الرئيسية
  const closeEdit = () => {
    setEditScreen(null);
    setRefreshCounter((c) => c + 1); // إعادة تحميل البيانات بعد الحفظ
  };
  if (editScreen?.type === 'budget') {
    return <BudgetGoalEdit
      onBack={closeEdit}
      branchId={editScreen.branchId}
      branchName={editScreen.branchName}
      lang={lang}
    />;
  }
  if (editScreen?.type === 'reviews') {
    return <ReviewsGoalEdit
      onBack={closeEdit}
      branchId={editScreen.branchId}
      branchName={editScreen.branchName}
      lang={lang}
    />;
  }
  if (editScreen?.type === 'whatsapp') {
    return <WhatsappGoalEdit
      onBack={closeEdit}
      branchId={editScreen.branchId}
      branchName={editScreen.branchName}
      lang={lang}
    />;
  }

  return (
    <div
      className="relative min-h-full px-4 pt-4 pb-8 overflow-hidden page-bg-soft"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* Batch 46.5: عنوان "الأهداف" بدل تبويبات شهري/سنوي */}
      <h2 className="text-center text-tw-navy font-extrabold text-lg mb-3 relative z-10">
        {lang === 'en' ? 'Goals' : 'الأهداف'}
      </h2>

      {/* منتقي الشهر */}
      <div onClick={openPicker} className="tw-period-picker relative z-10">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="font-num">{currentLabel}</span>
        <ChevronDown size={14} className="text-tw-muted" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-tw-muted">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}
      {error && (
        <p className="text-tw-red text-xs text-center bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
          {error}
        </p>
      )}

      {/* قائمة الفروع الديناميكية من Firestore */}
      {!loading && !error && branches.map((b) => {
        const k = branchKpis[b.id] || { budgetPct: 0, reviewsPct: 0, hasGoal: false, reviewsTarget: 0, reviewsAchieved: 0 };
        const branchDisplayName = lang === 'en' ? (b.nameEn || b.name) : (b.name.startsWith('فرع') ? b.name : `فرع ${b.name}`);
        // Batch 49: الـ subtext - إذا فيه هدف يعرض "محقق / هدف"
        const subtext = k.reviewsTarget > 0
          ? `${k.reviewsAchieved} / ${k.reviewsTarget}`
          : (lang === 'en' ? 'Tap to set' : 'اضغط للتسجيل');
        return (
          <BranchSection
            key={b.id}
            name={branchDisplayName}
            budgetPct={k.budgetPct}
            reviewsPct={k.reviewsPct}
            reviewsSubtext={subtext}
            whatsappPct={k.whatsappPct || 0}
            whatsappSubtext={k.whatsappSubtext}
            whatsappNoTarget={k.whatsappNoTarget}
            onBudgetClick={() => setEditScreen({ type: 'budget', branchId: b.id, branchName: branchDisplayName })}
            onReviewsClick={() => setEditScreen({ type: 'reviews', branchId: b.id, branchName: branchDisplayName })}
            onWhatsappClick={() => setEditScreen({ type: 'whatsapp', branchId: b.id, branchName: branchDisplayName })}
            lang={lang}
          />
        );
      })}

      {/* القائمة المنبثقة */}
      <BottomSheet
        open={!!sheet}
        title={sheet?.title}
        options={sheet?.options || []}
        current={sheet?.current}
        onPick={sheet?.onPick || (() => {})}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
