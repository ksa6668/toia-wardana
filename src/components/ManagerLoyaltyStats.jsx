// src/components/ManagerLoyaltyStats.jsx
// ----------------------------------------------------------
// تبويب الإحصائيات داخل ولاء المدير (المرحلة 5).
// البيانات: جلبتان لكل متجر (الأعضاء + كل الحركات) عبر useCachedQuery،
// وكل التجميع محلي في loyaltyStats — لا استعلامات متعددة.
// الرسوم: أشرطة CSS بلا أي مكتبة (نمط أشرطة التقدم القائم في التطبيق).
// حركات audit مستثناة من كل الأرقام، والمعطّلون/مخفيو الهوية خارج
// العد الأساسي مع مفتاح إظهارهم.
// ----------------------------------------------------------
import { useState } from 'react';
import { Download, Users2, Wallet, Repeat2, ReceiptText, UserRound, ChevronLeft, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  getLoyaltyMembers,
  getLoyaltyTransactionsByStore,
  getLoyaltySettings,
} from '../firebase';
import { useCachedQuery } from '../hooks/useCachedQuery';
import {
  periodRange,
  countedMembers,
  outstandingLiabilitySAR,
  newMembersCount,
  returnRate,
  purchaseAverages,
  sourcesRanking,
  tierDistribution,
  genderDistribution,
  monthlyPoints,
  idleMembers,
  nearRewardMembers,
  topSpenders,
  pointsByEmployee,
  toCsvString,
} from '../loyaltyStats';
import { toDateSafe } from '../loyaltyMath';
import { toLatinDigits } from '../utils/digits';

const PERIODS = [
  { key: 'week', ar: 'هذا الأسبوع', en: 'This week' },
  { key: 'month', ar: 'هذا الشهر', en: 'This month' },
  { key: '3m', ar: 'آخر 3 أشهر', en: 'Last 3 months' },
  { key: '12m', ar: 'آخر 12 شهراً', en: 'Last 12 months' },
  { key: 'all', ar: 'الكل', en: 'All time' },
];

const TIER_NAMES = { silver: 'فضية', gold: 'ذهبية', platinum: 'بلاتينية', none: 'بلا فئة' };
const TIER_NAMES_EN = { silver: 'Silver', gold: 'Gold', platinum: 'Platinum', none: 'No tier' };

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const fmt1 = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });

function fmtDate(v, en) {
  const d = toDateSafe(v);
  if (!d) return '—';
  return d.toLocaleDateString(en ? 'en-GB' : 'ar-SA-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

// تنزيل CSV (ترويسة BOM من toCsvString — العربية سليمة في Excel)
function downloadCsv(filename, rows) {
  const blob = new Blob([toCsvString(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// شريط أفقي بسيط (الرسم بلا مكتبة)
function Bar({ label, value, max, suffix, color = 'var(--color-tw-blue, #005BFF)', extra }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[11px] font-bold text-tw-navy">
        <span>{label}</span>
        <span className="text-tw-muted">
          {fmt(value)}{suffix || ''} {extra}
        </span>
      </div>
      <div className="h-2 bg-tw-soft rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white border border-tw-line rounded-2xl p-3">
      <div className="flex items-center gap-1.5 text-tw-muted mb-1">
        <Icon size={14} />
        <p className="text-[10px] font-bold">{label}</p>
      </div>
      <p className="text-lg font-extrabold text-tw-navy leading-tight">{value}</p>
      {sub && <p className="text-[10px] font-semibold text-tw-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// صف عميل قابل للنقر — يفتح ملف العضو داخل التطبيق (Batch 91.1):
// الاسم + رقم العضوية (الأسماء تتكرر، الرقم هو المميز)، هدف لمس ≥44px،
// وسهم كمؤشر بصري. children = المحتوى الإضافي في نهاية الصف.
function MemberRow({ m, en, onOpen, children }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(m.id)}
      className="w-full flex items-center gap-2 text-start px-1 py-1.5 border-b border-tw-line/40 last:border-b-0 hover:bg-tw-soft/40 active:bg-tw-soft/60 rounded-lg transition-colors"
      style={{ minHeight: 44 }}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-bold text-tw-navy truncate">{m.name}</span>
        <span className="block text-[10px] font-semibold text-tw-muted" dir="ltr"
              style={{ textAlign: en ? 'left' : 'right' }}>
          {m.memberNo}
        </span>
      </span>
      {children}
      <ChevronLeft size={14} className={`text-tw-muted flex-shrink-0 ${en ? 'rotate-180' : ''}`} />
    </button>
  );
}

function ExportBtn({ onClick, lang }) {
  return (
    <button type="button" onClick={onClick}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tw-soft text-tw-blue text-[10px] font-bold hover:bg-tw-soft/70">
      <Download size={12} /> {lang === 'en' ? 'CSV' : 'CSV تصدير'}
    </button>
  );
}

export default function ManagerLoyaltyStats({ store, lang, onOpenMember }) {
  const en = lang === 'en';
  const [period, setPeriod] = useState('month');
  const [includeHidden, setIncludeHidden] = useState(false);
  const [idleDays, setIdleDays] = useState(90);

  // Batch 91.2: freshWhenStale — الكاش الأقدم من TTL يعامَل كتحميل بدل عرض
  // لقطة قديمة (أصفار مضللة) ثم تصحيحها بصمت. الكتابات تأتي غالباً من جهاز
  // الموظف فلا يصل إبطالها إلى sessionStorage هذا المتصفح.
  const qOpts = { ttl: 60 * 1000, freshWhenStale: true };
  const { data: members, loading: l1, error: e1, refresh: r1 } = useCachedQuery(
    ['loyalty', 'members', store], () => getLoyaltyMembers(store),
    { ...qOpts, defaultData: [] });
  const { data: txs, loading: l2, error: e2, refresh: r2 } = useCachedQuery(
    ['loyalty', 'txs', store], () => getLoyaltyTransactionsByStore(store),
    { ...qOpts, defaultData: [] });
  const { data: settings, loading: l3, error: e3, refresh: r3 } = useCachedQuery(
    ['loyalty', 'settings', store], () => getLoyaltySettings(store),
    { ...qOpts, defaultData: null });

  const anyError = e1 || e2 || e3;
  const loading = l1 || l2 || l3 || (!settings && !anyError);

  // الحالة 2: خطأ — بطاقة خطأ بنص عربي وزر إعادة المحاولة (يعيد الجلبات الثلاث)
  if (anyError && !loading) {
    return (
      <div className="bg-white border border-red-200 rounded-2xl p-6 text-center space-y-3">
        <AlertTriangle size={28} className="mx-auto text-tw-red" />
        <p className="text-sm font-bold text-tw-navy">
          {en ? 'Failed to load statistics' : 'تعذّر تحميل الإحصائيات'}
        </p>
        <p className="text-xs font-semibold text-tw-muted">{String(anyError)}</p>
        <button
          type="button"
          onClick={() => { r1(); r2(); r3(); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-tw-blue text-white text-sm font-bold"
        >
          <RefreshCw size={14} /> {en ? 'Retry' : 'إعادة المحاولة'}
        </button>
      </div>
    );
  }

  // الحالة 1: تحميل — هيكل animate-pulse على نمط ManagerMonthly
  // (لا أرقام صفرية مضللة ولا رسائل «لا بيانات» قبل اكتمال جلب موثوق)
  if (loading) {
    return (
      <div className="space-y-3" aria-hidden="true">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 w-20 bg-tw-soft rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white border border-tw-line rounded-2xl p-3 animate-pulse">
              <div className="h-2.5 w-16 bg-tw-soft rounded mb-2" />
              <div className="h-5 w-24 bg-tw-soft rounded mb-1.5" />
              <div className="h-2 w-20 bg-tw-soft rounded" />
            </div>
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-tw-line rounded-2xl p-4 space-y-2.5 animate-pulse">
            <div className="h-3.5 w-32 bg-tw-soft rounded" />
            {[1, 2, 3].map((j) => (
              <div key={j} className="space-y-1">
                <div className="h-2.5 w-full bg-tw-soft rounded" />
                <div className="h-2 w-2/3 bg-tw-soft rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  // الحالة 3 (فارغ فعلاً): تصل هنا فقط بعد جلب مكتمل موثوق —
  // رسائل «لا بيانات/لا أحد حالياً» أدناه صادقة الآن

  const opts = { includeHidden };
  const range = periodRange(period);
  // فلترة الحركات بالمتجر تمت في الاستعلام — هنا الفترة والتجميع فقط
  const counted = countedMembers(members, opts);
  const liability = outstandingLiabilitySAR(members, settings, opts);
  const newCount = newMembersCount(members, range, opts);
  const rr = returnRate(txs, range);
  const avgs = purchaseAverages(txs, range);
  const sources = sourcesRanking(members, settings, range, opts);
  const tiers = tierDistribution(members, txs, settings, new Date(), opts);
  const genders = genderDistribution(members, opts);
  const monthly = monthlyPoints(txs, range).slice(-12);
  const idle = idleMembers(members, Number(idleDays) || 90, new Date(), opts);
  const near = nearRewardMembers(members, settings, opts);
  const top = topSpenders(members, txs, range, 20, opts);
  const byEmployee = pointsByEmployee(txs, range);

  const sourceMax = Math.max(1, ...sources.map((s) => s.count));
  const tierEntries = ['silver', 'gold', 'platinum', 'none'].filter((k) => tiers[k] !== undefined);
  const tierMax = Math.max(1, ...tierEntries.map((k) => tiers[k]));
  const genderRows = [
    { key: 'male', label: en ? 'Male' : 'ذكر', v: genders.male },
    { key: 'female', label: en ? 'Female' : 'أنثى', v: genders.female },
    { key: 'unregistered', label: en ? 'Unregistered' : 'غير مسجّل', v: genders.unregistered },
  ];
  const genderMax = Math.max(1, ...genderRows.map((g) => g.v));
  const monthlyMax = Math.max(1, ...monthly.flatMap((m) => [m.granted, m.redeemed, m.expired]));

  const deltaBadge = (d) => {
    if (d === null || d === 0) return null;
    return (
      <span className={`text-[10px] font-extrabold ${d > 0 ? 'text-green-600' : 'text-tw-red'}`} dir="ltr">
        {d > 0 ? `+${d}` : d}
      </span>
    );
  };

  const sectionCls = 'bg-white border border-tw-line rounded-2xl p-4 space-y-2.5';
  const headRow = (title, onExport) => (
    <div className="flex items-center justify-between">
      <h4 className="font-bold text-sm text-tw-navy">{title}</h4>
      {onExport && <ExportBtn onClick={onExport} lang={lang} />}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* الفلاتر الموحدة: الفترة + إظهار المستثنين */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <button key={p.key} type="button" onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                    period === p.key ? 'bg-tw-blue text-white border-tw-blue' : 'bg-white text-tw-navy border-tw-line'
                  }`}>
            {en ? p.en : p.ar}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[11px] font-bold text-tw-muted cursor-pointer w-fit">
        <input type="checkbox" checked={includeHidden}
               onChange={(e) => setIncludeHidden(e.target.checked)} className="w-4 h-4 accent-[#005BFF]" />
        {en ? 'Include disabled & anonymized members' : 'شمول المعطّلين ومخفيي الهوية'}
      </label>

      {/* البطاقات العلوية */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={Users2}
          label={en ? 'Total members' : 'إجمالي الأعضاء'}
          value={fmt(counted.length)}
          sub={`${en ? 'New in period:' : 'الجدد في الفترة:'} ${fmt(newCount)}`} />
        <StatCard icon={Wallet}
          label={en ? 'Outstanding liability' : 'الالتزام القائم'}
          value={`${fmt1(liability.sar)} ${en ? 'SAR' : 'ريال'}`}
          sub={`${fmt(liability.points)} ${en ? 'pts × ' : 'نقطة × '}${liability.pointValue.toFixed(4)}`} />
        <StatCard icon={Repeat2}
          label={en ? 'Return rate' : 'نسبة العودة'}
          value={`${rr.pct}%`}
          sub={`${fmt(rr.returners)} / ${fmt(rr.buyers)} ${en ? 'buyers' : 'من المشترين'}`} />
        <StatCard icon={ReceiptText}
          label={en ? 'Avg invoice' : 'متوسط الفاتورة'}
          value={`${fmt1(avgs.avgInvoice)} ${en ? 'SAR' : 'ريال'}`}
          sub={`${fmt(avgs.invoices)} ${en ? 'invoices' : 'فاتورة'}`} />
        <StatCard icon={UserRound}
          label={en ? 'Avg member spend' : 'متوسط إنفاق العضو'}
          value={`${fmt1(avgs.avgMemberSpend)} ${en ? 'SAR' : 'ريال'}`}
          sub={`${fmt(avgs.buyers)} ${en ? 'buyers in period' : 'عضو اشترى في الفترة'}`} />
      </div>

      {/* المصادر مع دلتا الفترة السابقة */}
      <div className={sectionCls}>
        {headRow(en ? 'Acquisition sources (joined in period)' : 'مصادر التعرف (المنضمون في الفترة)')}
        {sources.every((s) => s.count === 0 && !s.prevCount)
          ? <p className="text-xs text-tw-muted font-bold text-center py-2">{en ? 'No data' : 'لا بيانات'}</p>
          : sources.map((s) => (
              <Bar key={s.id} label={s.label} value={s.count} max={sourceMax}
                   extra={deltaBadge(s.delta)} />
            ))}
      </div>

      {/* توزيع الفئات */}
      <div className={sectionCls}>
        {headRow(en ? 'Tier distribution' : 'توزيع الفئات')}
        {tierEntries.map((k) => (
          <Bar key={k} label={en ? TIER_NAMES_EN[k] : TIER_NAMES[k]} value={tiers[k]} max={tierMax}
               color={k === 'none' ? '#B9C2CF' : undefined} />
        ))}
      </div>

      {/* توزيع الجنس */}
      <div className={sectionCls}>
        {headRow(en ? 'Gender distribution' : 'توزيع الجنس')}
        {genderRows.map((g) => (
          <Bar key={g.key} label={g.label} value={g.v} max={genderMax}
               color={g.key === 'unregistered' ? '#B9C2CF' : undefined} />
        ))}
      </div>

      {/* النقاط شهرياً */}
      <div className={sectionCls}>
        {headRow(en ? 'Points per month' : 'النقاط شهرياً')}
        {monthly.length === 0
          ? <p className="text-xs text-tw-muted font-bold text-center py-2">{en ? 'No data' : 'لا بيانات'}</p>
          : monthly.map((m) => (
              <div key={m.month} className="space-y-1 pb-1.5 border-b border-tw-line/50 last:border-b-0">
                <p className="text-[11px] font-extrabold text-tw-navy" dir="ltr" style={{ textAlign: en ? 'left' : 'right' }}>{m.month}</p>
                <Bar label={en ? 'Granted' : 'ممنوحة'} value={m.granted} max={monthlyMax} color="#22A06B" />
                <Bar label={en ? 'Redeemed' : 'مستبدلة'} value={m.redeemed} max={monthlyMax} color="#E8930C" />
                <Bar label={en ? 'Expired' : 'منتهية'} value={m.expired} max={monthlyMax} color="#E5484D" />
              </div>
            ))}
      </div>

      {/* الخاملون */}
      <div className={sectionCls}>
        {headRow(
          en ? `Idle customers (${idle.length})` : `العملاء الخاملون (${idle.length})`,
          () => downloadCsv(`idle-${store}.csv`, [
            // بلا رقم جوال — رقم العضوية هو المميز (Batch 91.1)
            [en ? 'Name' : 'الاسم', en ? 'Member no' : 'رقم العضوية', en ? 'Last purchase' : 'آخر شراء', en ? 'Balance' : 'الرصيد'],
            ...idle.map((m) => [m.name, m.memberNo, fmtDate(m.lastPurchaseAt, true), m.pointsBalance]),
          ])
        )}
        <label className="flex items-center gap-2 text-[11px] font-bold text-tw-muted">
          {en ? 'No purchase since' : 'بلا شراء منذ'}
          <input type="number" inputMode="numeric" min="1" value={idleDays}
                 onChange={(e) => setIdleDays(toLatinDigits(e.target.value))}
                 className="w-16 p-1.5 bg-tw-soft/40 border border-tw-line rounded-lg text-center font-mono text-xs" />
          {en ? 'days' : 'يوماً'}
        </label>
        {idle.slice(0, 10).map((m) => (
          <MemberRow key={m.id} m={m} en={en} onOpen={onOpenMember}>
            <span className="text-[11px] font-bold text-tw-muted flex-shrink-0" dir="ltr">
              {fmtDate(m.lastPurchaseAt, en) || '—'}
            </span>
          </MemberRow>
        ))}
        {idle.length > 10 && (
          <p className="text-[10px] text-tw-muted font-bold text-center">
            {en ? `+${idle.length - 10} more in the CSV export` : `+${idle.length - 10} آخرون في ملف التصدير`}
          </p>
        )}
      </div>

      {/* القريبون من مكافأة */}
      <div className={sectionCls}>
        {headRow(
          en ? `Near a reward 80–99% (${near.length})` : `القريبون من مكافأة 80–99% (${near.length})`,
          () => downloadCsv(`near-reward-${store}.csv`, [
            // بلا رقم جوال — رقم العضوية هو المميز (Batch 91.1)
            [en ? 'Name' : 'الاسم', en ? 'Member no' : 'رقم العضوية', en ? 'Balance' : 'الرصيد', en ? 'Next reward' : 'المكافأة التالية', '%'],
            ...near.map((m) => [m.name, m.memberNo, m.pointsBalance, m.nextRewardLabel, m.progressPct]),
          ])
        )}
        {near.slice(0, 10).map((m) => (
          <MemberRow key={m.id} m={m} en={en} onOpen={onOpenMember}>
            <span className="flex flex-col items-end gap-1 flex-shrink-0" style={{ minWidth: 90 }}>
              <span className="text-[10px] font-bold text-tw-muted truncate">{m.nextRewardLabel}</span>
              <span className="w-full h-1.5 bg-tw-soft rounded-full overflow-hidden">
                <span className="block h-full rounded-full bg-tw-blue" style={{ width: `${m.progressPct}%`, background: 'var(--color-tw-blue, #005BFF)' }} />
              </span>
              <span className="text-[10px] font-extrabold text-tw-navy">{m.progressPct}%</span>
            </span>
          </MemberRow>
        ))}
        {near.length === 0 && <p className="text-xs text-tw-muted font-bold text-center py-1">{en ? 'None currently' : 'لا أحد حالياً'}</p>}
      </div>

      {/* أعلى 20 إنفاقاً */}
      <div className={sectionCls}>
        {headRow(
          en ? 'Top 20 spenders (period)' : 'أعلى 20 عميلاً إنفاقاً (الفترة)',
          () => downloadCsv(`top-spenders-${store}.csv`, [
            [en ? 'Name' : 'الاسم', en ? 'Member no' : 'رقم العضوية', en ? 'Amount' : 'المبلغ', en ? 'Invoices' : 'الفواتير'],
            ...top.map((m) => [m.name, m.memberNo, m.spendAmount, m.spendInvoices]),
          ])
        )}
        {top.length === 0 && <p className="text-xs text-tw-muted font-bold text-center py-1">{en ? 'No purchases in period' : 'لا مشتريات في الفترة'}</p>}
        {top.map((m, i) => (
          <div key={m.id} className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-tw-muted w-5 flex-shrink-0">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <MemberRow m={m} en={en} onOpen={onOpenMember}>
                <span className="text-[11px] font-bold text-tw-navy flex-shrink-0">
                  {fmt(m.spendAmount)} {en ? 'SAR' : 'ريال'}
                </span>
                <span className="text-[10px] font-bold text-tw-muted flex-shrink-0">({fmt(m.spendInvoices)})</span>
              </MemberRow>
            </div>
          </div>
        ))}
      </div>

      {/* النقاط الممنوحة لكل موظف */}
      <div className={sectionCls}>
        {headRow(
          en ? 'Points granted per employee (period)' : 'النقاط الممنوحة لكل موظف (الفترة)',
          () => downloadCsv(`points-by-employee-${store}.csv`, [
            [en ? 'Employee' : 'الموظف', en ? 'Points' : 'النقاط', en ? 'Invoices' : 'الفواتير', en ? 'Amount' : 'المبلغ'],
            ...byEmployee.map((r) => [r.name || r.uid, r.points, r.invoices, r.amount]),
          ])
        )}
        {byEmployee.length === 0 && <p className="text-xs text-tw-muted font-bold text-center py-1">{en ? 'No data' : 'لا بيانات'}</p>}
        {byEmployee.map((r) => (
          <div key={r.uid} className="flex items-center gap-2 text-[11px] font-bold border-b border-tw-line/40 last:border-b-0 py-1">
            <span className="text-tw-navy truncate flex-1">{r.name || (en ? 'Unknown' : 'غير معروف')}</span>
            <span className="text-tw-navy flex-shrink-0">{fmt(r.points)} {en ? 'pts' : 'نقطة'}</span>
            <span className="text-tw-muted flex-shrink-0">({fmt(r.invoices)} {en ? 'inv' : 'فاتورة'})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
