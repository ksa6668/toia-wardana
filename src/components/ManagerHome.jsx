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
import { Calendar, ChevronDown, Loader2 } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { getBranches, getAllGoalsForMonth, getMonthlyGoal, getSales } from '../firebase';
import {
  getAvailableMonths, getAvailableYears, formatMonthLabel,
  monthRange, yearRange,
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
function KpiCard({ label, percent, showStars }) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <div className="text-white p-3 rounded-2xl overflow-hidden relative" style={NAVY_GRADIENT}>
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={SHINE_OVERLAY} />
      <div className="relative flex flex-col items-center text-center gap-2 min-h-[130px] justify-between">
        <p className="text-xs font-bold opacity-95">{label}</p>
        <p className="text-3xl font-extrabold leading-none">{pct}%</p>
        {showStars && (
          <p className="text-xs tracking-[0.15em]">⭐⭐⭐⭐⭐</p>
        )}
        <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// SVG شعار صغير يطابق الـ prototype: 4 ورقات أزرق
// أيقونة الفرع — مطابقة لـ #i-flower symbol في الـ prototype
// شكل دوّار بأربع أذرع منحنية متعامدة، خطوط زرقاء stroke فقط
function WindmillIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#005BFF"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 9.5V4a3 3 0 1 1 3 3" />
      <path d="M14.5 12H20a3 3 0 1 1-3 3" />
      <path d="M12 14.5V20a3 3 0 1 1-3-3" />
      <path d="M9.5 12H4a3 3 0 1 1 3-3" />
    </svg>
  );
}

// قسم لكل فرع (عنوان + شبكة 2×1)
function BranchSection({ name, budgetPct, reviewsPct, lang }) {
  return (
    <div className="mb-7">
      {/* فاصل اسم الفرع — خطين مع chip في المنتصف */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="flex-1 h-px opacity-50"
          style={{ background: 'linear-gradient(90deg, transparent, #005BFF, transparent)' }}
        />
        <div
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full whitespace-nowrap"
          style={{
            background: '#EEF5FF',
            border: '1.5px solid #005BFF',
          }}
        >
          <WindmillIcon size={14} />
          <span className="text-sm font-extrabold text-tw-navy2">{name}</span>
        </div>
        <div
          className="flex-1 h-px opacity-50"
          style={{ background: 'linear-gradient(90deg, transparent, #005BFF, transparent)' }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label={lang === 'en' ? 'Budget' : 'تحقيق الميزانية'}
          percent={budgetPct}
        />
        <KpiCard
          label={lang === 'en' ? 'Google Reviews' : 'تقييمات قوقل ماب'}
          percent={reviewsPct}
          showStars
        />
      </div>
    </div>
  );
}

export default function ManagerHome({ lang }) {
  // الفترة: شهري أو سنوي
  const [period, setPeriod] = useState('month'); // 'month' | 'year'
  // الاختيار الحالي حسب نوع الفترة
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  // للقائمة المنبثقة
  const [sheet, setSheet] = useState(null);

  // ====== البيانات الحقيقية من Firestore ======
  const [branches, setBranches] = useState([]);
  // map: { [branchId]: { budgetPct, reviewsPct, hasGoal } }
  const [branchKpis, setBranchKpis] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // تحميل البيانات عند تغيير الفترة
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        // 1) الفروع
        const brs = await getBranches();
        if (cancelled) return;

        // 2) النطاق الزمني
        const { from, to } = period === 'month'
          ? monthRange(selectedMonth)
          : yearRange(selectedYear);

        // 3) المبيعات لكل الفروع
        const allSales = await getSales(from, to);
        if (cancelled) return;

        // 4) الأهداف لكل فرع
        // للسنة: نحتاج جمع أهداف 12 شهر — تبسيط: نضرب هدف الشهر الحالي × 12
        // للشهر: نقرأ الأهداف مباشرة
        const goalsPromises = brs.map(async (b) => {
          if (period === 'month') {
            const g = await getMonthlyGoal(b.id, selectedMonth);
            return { branchId: b.id, budget: g.budget, reviewsTarget: g.reviewsTarget, exists: g.exists };
          } else {
            // سنوي: مجموع أهداف 12 شهر
            let totalBudget = 0;
            let totalReviews = 0;
            let anyExists = false;
            for (let m = 1; m <= 12; m++) {
              const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
              const g = await getMonthlyGoal(b.id, monthStr);
              if (g.exists) anyExists = true;
              totalBudget += g.budget || 0;
              totalReviews += g.reviewsTarget || 0;
            }
            return { branchId: b.id, budget: totalBudget, reviewsTarget: totalReviews, exists: anyExists };
          }
        });
        const goals = await Promise.all(goalsPromises);
        if (cancelled) return;

        // 5) حساب KPIs لكل فرع
        const kpisMap = {};
        for (const b of brs) {
          const goal = goals.find((g) => g.branchId === b.id) || { budget: 0, reviewsTarget: 0 };
          const branchSales = allSales.filter((s) => s.branchId === b.id);
          const totalSales = branchSales.reduce((sum, s) => sum + (s.total || 0), 0);
          const budgetPct = goal.budget > 0
            ? Math.min(100, Math.round((totalSales / goal.budget) * 100))
            : 0;
          // التقييمات: placeholder حتى نضيف Google Places API
          const reviewsPct = 0;
          kpisMap[b.id] = { budgetPct, reviewsPct, hasGoal: goal.exists };
        }
        setBranches(brs);
        setBranchKpis(kpisMap);

        // إذا لم يتم تحديد أي أهداف، أرسل إشعاراً (مرة واحدة في اليوم لكل شهر)
        const hasAnyGoals = Object.values(kpisMap).some((k) => k.hasGoal);
        if (!hasAnyGoals && brs.length > 0) {
          const notifKey = `goals_reminder_${selectedMonth || selectedYear}_${new Date().toDateString()}`;
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
  }, [period, selectedMonth, selectedYear]);

  const openPicker = () => {
    if (period === 'month') {
      setSheet({
        title: lang === 'en' ? 'Pick month' : 'اختر الشهر',
        options: getAvailableMonths().map((m) => ({ value: m, label: formatMonthLabel(m, lang) })),
        current: selectedMonth,
        onPick: (v) => { setSelectedMonth(v); setSheet(null); },
      });
    } else {
      setSheet({
        title: lang === 'en' ? 'Pick year' : 'اختر السنة',
        options: getAvailableYears().map((y) => ({ value: y, label: String(y) })),
        current: selectedYear,
        onPick: (v) => { setSelectedYear(v); setSheet(null); },
      });
    }
  };

  const currentLabel = period === 'month'
    ? formatMonthLabel(selectedMonth, lang)
    : String(selectedYear);

  return (
    <div
      className="relative min-h-full px-5 pt-5 pb-8 overflow-hidden page-bg-soft"
      style={{ fontFamily: "'Almarai', 'IBM Plex Sans Arabic', sans-serif" }}
    >
      {/* تبويبات شهري/سنوي — مطابقة لـ .tabs في الـ prototype */}
      <div className="flex bg-tw-soft p-1 rounded-2xl mb-4 relative z-10">
        <button
          onClick={() => setPeriod('month')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
            period === 'month'
              ? 'bg-tw-blue text-white shadow-md'
              : 'text-tw-muted hover:text-tw-navy'
          }`}
        >
          {lang === 'en' ? 'Monthly' : 'شهري'}
        </button>
        <button
          onClick={() => setPeriod('year')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
            period === 'year'
              ? 'bg-tw-blue text-white shadow-md'
              : 'text-tw-muted hover:text-tw-navy'
          }`}
        >
          {lang === 'en' ? 'Yearly' : 'سنوي'}
        </button>
      </div>

      {/* منتقي الفترة */}
      <button
        onClick={openPicker}
        className="w-full flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-3 px-4 mb-5 shadow-sm hover:shadow-md transition-shadow relative z-10"
      >
        <Calendar size={16} className="text-tw-blue" />
        <span className="font-extrabold text-sm text-tw-navy font-num">{currentLabel}</span>
        <ChevronDown size={14} className="text-tw-muted" />
      </button>

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
        const k = branchKpis[b.id] || { budgetPct: 0, reviewsPct: 0, hasGoal: false };
        return (
          <BranchSection
            key={b.id}
            name={lang === 'en' ? (b.nameEn || b.name) : (b.name.startsWith('فرع') ? b.name : `فرع ${b.name}`)}
            budgetPct={k.budgetPct}
            reviewsPct={k.reviewsPct}
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
