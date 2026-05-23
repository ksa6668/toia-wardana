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
import { Calendar, ChevronDown, Loader2, Star, CheckCircle2 } from 'lucide-react';
import BottomSheet from './BottomSheet';
import SheetPortal from './SheetPortal';
import { getBranches, getAllGoalsForMonth, getMonthlyGoal, setReviewsAchieved, getSales, salesNet } from '../firebase';
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
// Batch 16: يدعم onDoubleClick لكرت التقييمات لتسجيل العدد المُحقّق
function KpiCard({ label, percent, showStars, onDoubleClick, subtext }) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <div
      className="text-white p-3 rounded-2xl overflow-hidden relative"
      style={{ ...NAVY_GRADIENT, cursor: onDoubleClick ? 'pointer' : 'default' }}
      onDoubleClick={onDoubleClick}
      role={onDoubleClick ? 'button' : undefined}
      title={onDoubleClick ? 'انقر مرتين لتسجيل التقييمات المُحقّقة' : undefined}
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

// قسم لكل فرع (عنوان + شبكة 2×1)
function BranchSection({ name, budgetPct, reviewsPct, reviewsSubtext, onReviewsDoubleClick, lang }) {
  return (
    <div className="mb-5">
      {/* فاصل اسم الفرع — مطابق .branch-divider في الـ prototype */}
      <div className="tw-branch-divider">
        <span className="line" />
        <span className="branch-name">
          <WindmillIcon />
          <span>{name}</span>
        </span>
        <span className="line" />
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
          subtext={reviewsSubtext}
          onDoubleClick={onReviewsDoubleClick}
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
  // map: { [branchId]: { budgetPct, reviewsPct, hasGoal, reviewsTarget, reviewsAchieved } }
  const [branchKpis, setBranchKpis] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Batch 16: state لـ Reviews input sheet
  const [reviewsInputOpen, setReviewsInputOpen] = useState(null); // null | { branchId, branchName, target, achieved }
  const [reviewsInputValue, setReviewsInputValue] = useState('');
  const [reviewsSaving, setReviewsSaving] = useState(false);
  const [reviewsSaveDone, setReviewsSaveDone] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0); // لإعادة تحميل البيانات بعد الحفظ

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
            return {
              branchId: b.id,
              budget: g.budget,
              reviewsTarget: g.reviewsTarget,
              reviewsAchieved: g.reviewsAchieved || 0,
              exists: g.exists,
            };
          } else {
            // سنوي: مجموع أهداف 12 شهر
            let totalBudget = 0;
            let totalReviews = 0;
            let totalAchieved = 0;
            let anyExists = false;
            for (let m = 1; m <= 12; m++) {
              const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
              const g = await getMonthlyGoal(b.id, monthStr);
              if (g.exists) anyExists = true;
              totalBudget += g.budget || 0;
              totalReviews += g.reviewsTarget || 0;
              totalAchieved += g.reviewsAchieved || 0;
            }
            return {
              branchId: b.id,
              budget: totalBudget,
              reviewsTarget: totalReviews,
              reviewsAchieved: totalAchieved,
              exists: anyExists,
            };
          }
        });
        const goals = await Promise.all(goalsPromises);
        if (cancelled) return;

        // 5) حساب KPIs لكل فرع
        const kpisMap = {};
        for (const b of brs) {
          const goal = goals.find((g) => g.branchId === b.id) || { budget: 0, reviewsTarget: 0, reviewsAchieved: 0 };
          const branchSales = allSales.filter((s) => s.branchId === b.id);
          const totalSales = branchSales.reduce((sum, s) => sum + salesNet(s), 0);
          const budgetPct = goal.budget > 0
            ? Math.min(100, Math.round((totalSales / goal.budget) * 100))
            : 0;
          // Batch 16: التقييمات من goal.reviewsAchieved / goal.reviewsTarget
          const reviewsPct = goal.reviewsTarget > 0
            ? Math.min(100, Math.round((goal.reviewsAchieved / goal.reviewsTarget) * 100))
            : 0;
          kpisMap[b.id] = {
            budgetPct, reviewsPct,
            hasGoal: goal.exists,
            reviewsTarget: goal.reviewsTarget || 0,
            reviewsAchieved: goal.reviewsAchieved || 0,
          };
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
  }, [period, selectedMonth, selectedYear, refreshCounter]);

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
      className="relative min-h-full px-4 pt-4 pb-8 overflow-hidden page-bg-soft"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* تبويبات شهري/سنوي — مطابقة لـ .tabs في الـ prototype */}
      <div className="tw-tabs relative z-10">
        <span
          onClick={() => setPeriod('month')}
          className={period === 'month' ? 'active' : ''}
        >
          {lang === 'en' ? 'Monthly' : 'شهري'}
        </span>
        <span
          onClick={() => setPeriod('year')}
          className={period === 'year' ? 'active' : ''}
        >
          {lang === 'en' ? 'Yearly' : 'سنوي'}
        </span>
      </div>

      {/* منتقي الفترة — مطابق لـ .period-picker في الـ prototype */}
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
        // الـ subtext: "X / Y" إذا فيه هدف
        const subtext = k.reviewsTarget > 0
          ? `${k.reviewsAchieved} / ${k.reviewsTarget}`
          : (lang === 'en' ? 'Double-tap to set' : 'انقر مرتين للتسجيل');
        // double-click handler — يعمل فقط في الشهري (نسبة سنوية لا تُدخل لشهر معيّن)
        const handleDoubleClick = period === 'month'
          ? () => {
              setReviewsInputOpen({
                branchId: b.id,
                branchName: lang === 'en' ? (b.nameEn || b.name) : (b.name.startsWith('فرع') ? b.name : `فرع ${b.name}`),
                target: k.reviewsTarget,
                achieved: k.reviewsAchieved,
              });
              setReviewsInputValue(String(k.reviewsAchieved || ''));
              setReviewsSaveDone(false);
            }
          : undefined;
        return (
          <BranchSection
            key={b.id}
            name={lang === 'en' ? (b.nameEn || b.name) : (b.name.startsWith('فرع') ? b.name : `فرع ${b.name}`)}
            budgetPct={k.budgetPct}
            reviewsPct={k.reviewsPct}
            reviewsSubtext={subtext}
            onReviewsDoubleClick={handleDoubleClick}
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

      {/* Batch 16: Sheet لإدخال عدد التقييمات المُحقّقة */}
      {reviewsInputOpen && (
        <SheetPortal>
          <div className="tw-sheet-overlay show" onClick={() => setReviewsInputOpen(null)} />
          <div className="tw-sheet-panel show" role="dialog" aria-modal="true">
            <div className="tw-sheet-grab" />
            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Star size={18} className="text-tw-orange" />
              <span>{lang === 'en' ? 'Reviews achieved' : 'التقييمات المُحقّقة'}</span>
            </h3>
            <p style={{
              fontSize: 12, color: 'var(--tw-muted)', textAlign: 'center',
              margin: '0 0 14px', fontWeight: 600,
            }}>
              {reviewsInputOpen.branchName}
              {reviewsInputOpen.target > 0 && (
                <span style={{ display: 'block', marginTop: 4, color: 'var(--tw-blue)' }}>
                  {lang === 'en'
                    ? `Target: ${reviewsInputOpen.target} reviews`
                    : `الهدف: ${reviewsInputOpen.target} تقييم`}
                </span>
              )}
            </p>

            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--tw-muted)', display: 'block', marginBottom: 6 }}>
              {lang === 'en' ? 'Achieved count' : 'العدد المُحقّق'}
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(40,57,90,.04)',
              border: '1px solid var(--tw-line)',
              borderRadius: 12, padding: 12, marginBottom: 14,
            }}>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={reviewsInputValue}
                onChange={(e) => setReviewsInputValue(e.target.value.replace(/[^\d]/g, ''))}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 18, fontWeight: 800, color: 'var(--tw-navy)',
                  textAlign: 'center', direction: 'ltr',
                }}
              />
              <Star size={16} className="text-tw-orange" />
            </div>

            {reviewsSaveDone && (
              <p style={{
                fontSize: 12, fontWeight: 700, textAlign: 'center',
                background: '#ecfdf5', color: 'var(--tw-green)',
                padding: '8px 12px', borderRadius: 10,
                border: '1px solid #d1fae5', marginBottom: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <CheckCircle2 size={16} />
                {lang === 'en' ? 'Saved' : 'تم الحفظ'}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setReviewsInputOpen(null)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: 'white', border: '1px solid var(--tw-line)',
                  color: 'var(--tw-navy)', fontWeight: 700, fontSize: 13,
                }}
              >
                {lang === 'en' ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                onClick={async () => {
                  setReviewsSaving(true);
                  try {
                    await setReviewsAchieved(
                      reviewsInputOpen.branchId,
                      selectedMonth,
                      reviewsInputValue
                    );
                    setReviewsSaveDone(true);
                    // إعادة تحميل البيانات لتحديث النسبة في الواجهة
                    setRefreshCounter((c) => c + 1);
                    setTimeout(() => setReviewsInputOpen(null), 800);
                  } catch (err) {
                    console.error('Save reviews failed:', err);
                  } finally {
                    setReviewsSaving(false);
                  }
                }}
                disabled={reviewsSaving || !reviewsInputValue}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                  color: 'white', fontWeight: 700, fontSize: 13,
                  opacity: (reviewsSaving || !reviewsInputValue) ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {reviewsSaving && <Loader2 size={14} className="animate-spin" />}
                {reviewsSaving ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...') : (lang === 'en' ? 'Save' : 'حفظ')}
              </button>
            </div>
          </div>
        </SheetPortal>
      )}
    </div>
  );
}
