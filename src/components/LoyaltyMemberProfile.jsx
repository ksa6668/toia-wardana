// src/components/LoyaltyMemberProfile.jsx
// ----------------------------------------------------------
// ملف العضو (شاشة مدير فرعية): البيانات، سجل المشتريات،
// حركة النقاط الكاملة، التصحيح/العكس بسبب إلزامي (بلا حذف)،
// الترقية اليدوية للفئة، وتعطيل/تفعيل العضوية.
// حالة "معكوسة" تُشتق من حركات reverse (reversesTxId) — السجل إضافي فقط.
// ----------------------------------------------------------
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Undo2, Star, ShieldOff, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import {
  getLoyaltyMember,
  getLoyaltyTransactions,
  getLoyaltySettings,
  reverseLoyaltyTransaction,
  adjustLoyaltyPoints,
  setLoyaltyManualTier,
  setLoyaltyMemberStatus,
} from '../firebase';
import { effectiveTier, toDateSafe, addMonths } from '../loyaltyMath';
import { useScreenHeader } from '../context/ScreenCtx';
import LoyaltyConfirmSheet from './LoyaltyConfirmSheet';

const TIER_STYLE = {
  silver:   { bg: '#EDF1F7', color: '#5A6B85' },
  gold:     { bg: '#FFF4D6', color: '#9A7000' },
  platinum: { bg: '#E9E4FA', color: '#5B3FA8' },
};

const TYPE_LABEL = {
  earn:    { ar: 'إضافة نقاط', en: 'Earn' },
  redeem:  { ar: 'استبدال',    en: 'Redeem' },
  adjust:  { ar: 'تسوية',      en: 'Adjust' },
  reverse: { ar: 'عكس حركة',   en: 'Reverse' },
  expire:  { ar: 'انتهاء',     en: 'Expire' },
};

function fmtDate(v, en) {
  const d = toDateSafe(v);
  if (!d) return '—';
  return d.toLocaleDateString(en ? 'en-GB' : 'ar-SA-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function LoyaltyMemberProfile({ memberId, store, lang, user, onBack }) {
  const en = lang === 'en';
  const byMeta = { byUid: user?.uid || '', byName: user?.displayName || user?.username || '' };

  const [member, setMember] = useState(null);
  const [txs, setTxs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // عكس حركة
  const [reverseTx, setReverseTx] = useState(null);
  // تسوية يدوية
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjPoints, setAdjPoints] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjBusy, setAdjBusy] = useState(false);
  // ترقية يدوية
  const [showTier, setShowTier] = useState(false);
  const [tierKey, setTierKey] = useState('');
  const [tierReason, setTierReason] = useState('');
  const [tierMonths, setTierMonths] = useState('');
  const [tierBusy, setTierBusy] = useState(false);
  // تعطيل/تفعيل
  const [statusBusy, setStatusBusy] = useState(false);

  useScreenHeader(en ? 'Member profile' : 'ملف العضو', onBack);

  const load = useCallback(async () => {
    try {
      // getLoyaltyMember يطبّق الانتهاء الكسول عند فتح الملف
      const [m, list, s] = await Promise.all([
        getLoyaltyMember(memberId, byMeta),
        getLoyaltyTransactions(memberId),
        getLoyaltySettings(store),
      ]);
      setMember(m);
      setTxs(list);
      setSettings(s);
      setError('');
    } catch (err) {
      setError(err?.message || (en ? 'Failed to load' : 'تعذّر التحميل'));
    } finally {
      setLoading(false);
    }
    // byMeta ثابت عملياً خلال الجلسة
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, store]);

  // جلب أولي عند فتح الملف — نفس نمط الشاشات القائمة (ManageUsers وغيرها)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-tw-muted">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm font-bold">{en ? 'Loading…' : 'جارٍ التحميل…'}</span>
      </div>
    );
  }
  if (error || !member) {
    return <p className="p-6 text-center text-sm font-bold text-tw-red">{error || '—'}</p>;
  }

  const balance = Number(member.pointsBalance) || 0;
  const tierInfo = settings ? effectiveTier(member, txs, settings) : null;
  const tierStyle = tierInfo?.tier ? (TIER_STYLE[tierInfo.tier.key] || TIER_STYLE.silver) : null;
  // الحركات المعكوسة — تُشتق من reversesTxId
  const reversedIds = new Set(txs.filter((x) => x.type === 'reverse' && x.reversesTxId).map((x) => x.reversesTxId));
  const purchases = txs.filter((x) => x.type === 'earn');
  const disabled = member.status === 'disabled';

  const handleAdjust = async () => {
    const p = Math.round(Number(adjPoints));
    if (!p) return;
    setAdjBusy(true);
    try {
      await adjustLoyaltyPoints({ store, memberId, points: p, reason: adjReason, ...byMeta });
      setShowAdjust(false); setAdjPoints(''); setAdjReason('');
      setNotice(en ? 'Adjustment saved ✓' : 'تمت التسوية ✓');
      await load();
    } catch (err) {
      setError(err?.message || (en ? 'Failed' : 'تعذّر التنفيذ'));
    } finally {
      setAdjBusy(false);
    }
  };

  const handleTierSave = async () => {
    setTierBusy(true);
    setError('');
    try {
      if (!tierKey) {
        await setLoyaltyManualTier(memberId, null, byMeta); // إلغاء الترقية
      } else {
        const months = Number(tierMonths);
        await setLoyaltyManualTier(memberId, {
          tier: tierKey,
          reason: tierReason,
          until: months > 0 ? addMonths(new Date(), months) : null,
        }, byMeta);
      }
      setShowTier(false); setTierKey(''); setTierReason(''); setTierMonths('');
      setNotice(en ? 'Tier updated ✓' : 'تم تحديث الفئة ✓');
      await load();
    } catch (err) {
      setError(err?.message || (en ? 'Failed' : 'تعذّر التنفيذ'));
    } finally {
      setTierBusy(false);
    }
  };

  const handleToggleStatus = async () => {
    setStatusBusy(true);
    try {
      await setLoyaltyMemberStatus(memberId, disabled ? 'active' : 'disabled');
      await load();
    } catch (err) {
      setError(err?.message || (en ? 'Failed' : 'تعذّر التنفيذ'));
    } finally {
      setStatusBusy(false);
    }
  };

  const inputCls = 'w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue';

  return (
    <div
      className="min-h-full px-4 pt-3 pb-8 space-y-3"
      style={{ fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif' }}
    >
      {/* بطاقة البيانات */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-extrabold text-base text-tw-navy leading-tight">{member.name}</h3>
            <p className="text-[11px] text-tw-muted font-mono" dir="ltr" style={{ textAlign: en ? 'left' : 'right' }}>
              {member.memberNo} · {member.phone}
            </p>
          </div>
          {tierStyle && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold flex-shrink-0"
                  style={{ background: tierStyle.bg, color: tierStyle.color }}>
              {tierInfo.tier.name}{tierInfo.manual ? ' ★' : ''}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="bg-tw-soft/50 rounded-xl p-2">
            <p className="text-[10px] text-tw-muted font-bold">{en ? 'Balance' : 'الرصيد'}</p>
            <p className={`text-lg font-extrabold ${balance < 0 ? 'text-tw-red' : 'text-tw-navy'}`}>
              {balance.toLocaleString('en-US')}
            </p>
          </div>
          <div className="bg-tw-soft/50 rounded-xl p-2">
            <p className="text-[10px] text-tw-muted font-bold">{en ? 'Tier points' : 'نقاط الفئة'}</p>
            <p className="text-lg font-extrabold text-tw-navy">
              {(tierInfo?.tierPoints || 0).toLocaleString('en-US')}
            </p>
          </div>
          <div className="bg-tw-soft/50 rounded-xl p-2">
            <p className="text-[10px] text-tw-muted font-bold">{en ? 'Redemptions' : 'الاستبدالات'}</p>
            <p className="text-lg font-extrabold text-tw-navy">
              {Number(member.redemptionsCount) || 0}
            </p>
          </div>
        </div>
        <div className="text-[11px] text-tw-muted font-semibold space-y-0.5 pt-1">
          <p>{en ? 'Joined:' : 'الانضمام:'} {fmtDate(member.joinedAt, en)} · {en ? 'Last purchase:' : 'آخر شراء:'} {fmtDate(member.lastPurchaseAt, en)}</p>
          <p>{en ? 'Points expire:' : 'انتهاء النقاط:'} {fmtDate(member.pointsExpireAt, en)} · {en ? 'Marketing consent:' : 'موافقة تسويقية:'} {member.marketingConsent ? '✓' : '✗'}</p>
          {tierInfo?.manual && member.manualTier && (
            <p className="text-[#9A7000]">
              {en ? 'Manual tier:' : 'ترقية يدوية:'} {member.manualTier.reason}
              {member.manualTier.until ? ` (${en ? 'until' : 'حتى'} ${fmtDate(member.manualTier.until, en)})` : ''}
            </p>
          )}
        </div>
      </div>

      {notice && <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl p-2.5 text-center">{notice}</p>}
      {error && <p className="text-xs font-bold text-tw-red bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">{error}</p>}

      {/* أزرار الإجراءات */}
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setShowAdjust((v) => !v)}
                className="py-2.5 rounded-xl bg-white border border-tw-line text-tw-navy text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-tw-soft">
          <SlidersHorizontal size={14} /> {en ? 'Adjust' : 'تسوية'}
        </button>
        <button type="button" onClick={() => setShowTier((v) => !v)}
                className="py-2.5 rounded-xl bg-white border border-tw-line text-tw-navy text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-tw-soft">
          <Star size={14} /> {en ? 'Manual tier' : 'ترقية يدوية'}
        </button>
        <button type="button" onClick={handleToggleStatus} disabled={statusBusy}
                className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                  disabled
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    : 'bg-red-50 border-red-200 text-tw-red hover:bg-red-100'
                }`}>
          {statusBusy ? <Loader2 size={14} className="animate-spin" /> : (disabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />)}
          {disabled ? (en ? 'Enable' : 'تفعيل') : (en ? 'Disable' : 'تعطيل')}
        </button>
      </div>

      {/* نموذج التسوية */}
      {showAdjust && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-blue/30 space-y-2">
          <h4 className="font-bold text-sm text-tw-navy">{en ? 'Points adjustment' : 'تسوية نقاط'}</h4>
          <input type="number" inputMode="numeric" value={adjPoints}
                 onChange={(e) => setAdjPoints(e.target.value)}
                 placeholder={en ? 'Points (+ or −)' : 'النقاط (+ أو −)'} className={inputCls} />
          <input type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)}
                 placeholder={en ? 'Reason (required)' : 'السبب (إلزامي)'} className={inputCls} />
          <button type="button" onClick={handleAdjust}
                  disabled={adjBusy || !Math.round(Number(adjPoints)) || !adjReason.trim()}
                  className="w-full py-2.5 rounded-xl bg-tw-blue text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {adjBusy && <Loader2 size={14} className="animate-spin" />}
            {en ? 'Save adjustment' : 'حفظ التسوية'}
          </button>
        </div>
      )}

      {/* نموذج الترقية اليدوية */}
      {showTier && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-blue/30 space-y-2">
          <h4 className="font-bold text-sm text-tw-navy">{en ? 'Manual tier upgrade' : 'الترقية اليدوية للفئة'}</h4>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setTierKey('')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                      tierKey === '' ? 'bg-tw-blue text-white border-tw-blue' : 'bg-tw-soft/40 text-tw-navy border-tw-line'
                    }`}>
              {en ? 'None (auto)' : 'بلا (آلي)'}
            </button>
            {(settings?.tiers || []).map((tr) => (
              <button key={tr.key} type="button" onClick={() => setTierKey(tr.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        tierKey === tr.key ? 'bg-tw-blue text-white border-tw-blue' : 'bg-tw-soft/40 text-tw-navy border-tw-line'
                      }`}>
                {tr.name}
              </button>
            ))}
          </div>
          {tierKey && (
            <>
              <input type="text" value={tierReason} onChange={(e) => setTierReason(e.target.value)}
                     placeholder={en ? 'Reason (required)' : 'السبب (إلزامي)'} className={inputCls} />
              <input type="number" inputMode="numeric" min="0" value={tierMonths}
                     onChange={(e) => setTierMonths(e.target.value)}
                     placeholder={en ? 'Duration in months (empty = until cancelled)' : 'المدة بالشهور (فارغ = حتى الإلغاء)'}
                     className={inputCls} />
            </>
          )}
          <button type="button" onClick={handleTierSave}
                  disabled={tierBusy || (tierKey && !tierReason.trim())}
                  className="w-full py-2.5 rounded-xl bg-tw-blue text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {tierBusy && <Loader2 size={14} className="animate-spin" />}
            {tierKey ? (en ? 'Apply upgrade' : 'تطبيق الترقية') : (en ? 'Cancel manual tier' : 'إلغاء الترقية اليدوية')}
          </button>
        </div>
      )}

      {/* سجل المشتريات */}
      <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
        <h4 className="font-bold text-sm text-tw-navy p-3 border-b border-tw-line/70">
          {en ? 'Purchases' : 'سجل المشتريات'} ({purchases.length})
        </h4>
        {purchases.length === 0 && (
          <p className="p-4 text-center text-xs font-bold text-tw-muted">{en ? 'No purchases yet' : 'لا مشتريات بعد'}</p>
        )}
        {purchases.map((x) => {
          const reversed = reversedIds.has(x.id);
          return (
            <div key={x.id} className={`flex items-center gap-2 p-3 border-b border-tw-line/50 last:border-b-0 ${reversed ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-tw-navy">
                  {en ? 'Invoice' : 'فاتورة'} {x.invoiceNo} · {(Number(x.amount) || 0).toLocaleString('en-US')} {en ? 'SAR' : 'ريال'}
                  {reversed && <span className="text-tw-red mx-1.5">({en ? 'reversed' : 'معكوسة'})</span>}
                </p>
                <p className="text-[10px] text-tw-muted font-semibold">{fmtDate(x.at, en)} · {x.byName || '—'}</p>
              </div>
              <span className="text-xs font-extrabold text-green-700 flex-shrink-0">
                +{(Number(x.points) || 0).toLocaleString('en-US')}
              </span>
              {!reversed && (
                <button type="button" onClick={() => setReverseTx(x)}
                        title={en ? 'Reverse' : 'عكس'}
                        className="p-1.5 rounded-lg text-tw-red hover:bg-red-50 flex-shrink-0">
                  <Undo2 size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* حركة النقاط الكاملة */}
      <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
        <h4 className="font-bold text-sm text-tw-navy p-3 border-b border-tw-line/70">
          {en ? 'Points activity' : 'حركة النقاط'} ({txs.length})
        </h4>
        {txs.length === 0 && (
          <p className="p-4 text-center text-xs font-bold text-tw-muted">{en ? 'No activity yet' : 'لا حركات بعد'}</p>
        )}
        {txs.map((x) => {
          const reversed = reversedIds.has(x.id);
          const p = Number(x.points) || 0;
          const label = TYPE_LABEL[x.type] ? TYPE_LABEL[x.type][en ? 'en' : 'ar'] : x.type;
          const canReverse = ['redeem', 'adjust'].includes(x.type) && !reversed;
          return (
            <div key={x.id} className={`flex items-center gap-2 p-3 border-b border-tw-line/50 last:border-b-0 ${reversed ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-tw-navy">
                  {label}
                  {x.rewardLabel ? ` — ${x.rewardLabel}` : ''}
                  {x.invoiceNo ? ` — ${x.invoiceNo}` : ''}
                  {reversed && <span className="text-tw-red mx-1.5">({en ? 'reversed' : 'معكوسة'})</span>}
                </p>
                {x.reason && <p className="text-[10px] text-tw-muted font-semibold truncate">{x.reason}</p>}
                <p className="text-[10px] text-tw-muted font-semibold">
                  {fmtDate(x.at, en)} · {x.byName || '—'} · {en ? 'balance after:' : 'الرصيد بعدها:'} {(Number(x.balanceAfter) || 0).toLocaleString('en-US')}
                </p>
              </div>
              <span className={`text-xs font-extrabold flex-shrink-0 ${p >= 0 ? 'text-green-700' : 'text-tw-red'}`}>
                {p >= 0 ? '+' : ''}{p.toLocaleString('en-US')}
              </span>
              {canReverse && (
                <button type="button" onClick={() => setReverseTx(x)}
                        title={en ? 'Reverse' : 'عكس'}
                        className="p-1.5 rounded-lg text-tw-red hover:bg-red-50 flex-shrink-0">
                  <Undo2 size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* تأكيد العكس — سبب إلزامي */}
      <LoyaltyConfirmSheet
        open={!!reverseTx}
        variant="reverse"
        lang={lang}
        requireReason
        title={en ? 'Reverse this transaction?' : 'عكس هذه الحركة؟'}
        message={reverseTx
          ? (en
              ? `A reverse entry of ${(-(Number(reverseTx.points) || 0)).toLocaleString('en-US')} points will be created. Nothing is deleted.`
              : `ستُنشأ حركة عكسية بقيمة ${(-(Number(reverseTx.points) || 0)).toLocaleString('en-US')} نقطة. لا يُحذف أي سجل.`)
          : ''}
        confirmLabel={en ? 'Reverse' : 'عكس الحركة'}
        onConfirm={async (reason) => {
          await reverseLoyaltyTransaction({
            store, memberId, txId: reverseTx.id, reason, ...byMeta,
          });
          setNotice(en ? 'Transaction reversed ✓' : 'تم عكس الحركة ✓');
          await load();
        }}
        onClose={() => setReverseTx(null)}
      />
    </div>
  );
}
