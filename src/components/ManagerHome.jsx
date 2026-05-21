// src/components/ManagerHome.jsx
// ----------------------------------------------------------
// شاشة المدير الرئيسية — كروت KPI لكل فرع
// مطابقة لتصميم index.html الـ prototype في شاشة 'home' للمدير.
//
// ⚠️ TODO (ربط Firestore):
//   الأرقام (78%, 92%, 68%, 84%) تجريبية. للربط:
//     1) أنشئ collection 'goals' في Firestore:
//          goals/{branchId}_{YYYY-MM}  →  { budget, reviewsTarget }
//     2) أضف في firebase.js:
//          export async function getMonthlyGoal(branchId, monthStr) {...}
//     3) احسب: budgetPct = (monthSales / goal.budget) * 100
//   راجع التعليق المفصّل في EmployeeHome داخل App.jsx.
// ----------------------------------------------------------
import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { getAvailableMonths, getAvailableYears, formatMonthLabel } from '../utils/periodHelpers';

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

// قسم لكل فرع (عنوان + شبكة 2×1)
function BranchSection({ name, budgetPct, reviewsPct, lang }) {
  return (
    <div className="mb-5">
      {/* فاصل اسم الفرع — خطين مع الاسم في المنتصف */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full">
          <span className="text-blue-600">🌸</span>
          <span className="text-sm font-bold text-slate-700">{name}</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
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

  // ⚠️ أرقام تجريبية — تستبدل بقراءات حقيقية من Firestore
  const mockData = {
    toia: { budget: 78, reviews: 92 },
    wardana: { budget: 68, reviews: 84 },
  };

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
      className="relative min-h-full px-5 pt-5 pb-8 overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* تبويبات شهري/سنوي — مطابقة لـ .tabs في الـ prototype */}
      <div className="flex bg-blue-50 p-1 rounded-2xl mb-4 relative z-10">
        <button
          onClick={() => setPeriod('month')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            period === 'month'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          {lang === 'en' ? 'Monthly' : 'شهري'}
        </button>
        <button
          onClick={() => setPeriod('year')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
            period === 'year'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          {lang === 'en' ? 'Yearly' : 'سنوي'}
        </button>
      </div>

      {/* منتقي الفترة */}
      <button
        onClick={openPicker}
        className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-3 px-4 mb-5 shadow-sm hover:shadow-md transition-shadow relative z-10"
      >
        <Calendar size={16} className="text-blue-600" />
        <span className="font-bold text-sm text-slate-700">{currentLabel}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {/* فرع تويا */}
      <BranchSection
        name={lang === 'en' ? 'Toia Branch' : 'فرع تويا'}
        budgetPct={mockData.toia.budget}
        reviewsPct={mockData.toia.reviews}
        lang={lang}
      />

      {/* فرع وردانة */}
      <BranchSection
        name={lang === 'en' ? 'Wardana Branch' : 'فرع وردانة'}
        budgetPct={mockData.wardana.budget}
        reviewsPct={mockData.wardana.reviews}
        lang={lang}
      />

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
