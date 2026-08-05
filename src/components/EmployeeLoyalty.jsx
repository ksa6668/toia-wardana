// src/components/EmployeeLoyalty.jsx
// ----------------------------------------------------------
// شاشة الموظف — برنامج الولاء (المرحلة 1).
// صفحة واحدة تبدأ بحقل رقم الجوال:
//   • البحث يوحّد صيغة الرقم ويبحث في المتجر الحالي فقط (branchId)
//   • لا عضوية → نموذج إنشاء (اسم/جوال/مصدر/موافقة) ثم فاتورة ومبلغ
//   • عضوية → بطاقة العضو + شبكة المكافآت + إضافة نقاط + استبدال
//   • الاستبدال معطّل عند رصيد سالب مع رسالة السبب
// ملاحظة: زر مسح QR مؤجل للمرحلة 2 — البحث بالجوال هو الوسيلة الوحيدة.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Search, Loader2, UserPlus, Star, Gift, ReceiptText, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  getLoyaltySettings,
  findLoyaltyMemberByPhone,
  createLoyaltyMember,
  getLoyaltyMember,
  getLoyaltyTransactions,
  earnLoyaltyPoints,
  redeemLoyaltyReward,
} from '../firebase';
import { effectiveTier, normalizePhone } from '../loyaltyMath';
import LoyaltyConfirmSheet from './LoyaltyConfirmSheet';

// ألوان شارات الفئات
const TIER_STYLE = {
  silver:   { bg: '#EDF1F7', color: '#5A6B85' },
  gold:     { bg: '#FFF4D6', color: '#9A7000' },
  platinum: { bg: '#E9E4FA', color: '#5B3FA8' },
};

export default function EmployeeLoyalty({ branchId, lang, user }) {
  const en = lang === 'en';
  const byMeta = { byUid: user?.uid || '', byName: user?.displayName || user?.username || '' };

  const [settings, setSettings] = useState(null);
  // stage: 'search' | 'register' | 'member'
  const [stage, setStage] = useState('search');
  const [phoneInput, setPhoneInput] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [member, setMember] = useState(null);
  const [txs, setTxs] = useState([]);

  // نموذج التسجيل
  const [regName, setRegName] = useState('');
  const [regSource, setRegSource] = useState('');
  const [regSourceOther, setRegSourceOther] = useState('');
  const [regConsent, setRegConsent] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState('');

  // إضافة نقاط
  const [invoiceNo, setInvoiceNo] = useState('');
  const [amount, setAmount] = useState('');
  const [earnBusy, setEarnBusy] = useState(false);
  const [earnError, setEarnError] = useState('');
  const [earnMsg, setEarnMsg] = useState('');

  // استبدال
  const [confirmReward, setConfirmReward] = useState(null);

  // إعدادات المتجر الحالي
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getLoyaltySettings(branchId);
        if (!cancelled) setSettings(s);
      } catch (err) {
        console.error('EmployeeLoyalty settings error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [branchId]);

  const resetToSearch = () => {
    setStage('search');
    setMember(null);
    setTxs([]);
    setSearchError('');
    setRegName(''); setRegSource(''); setRegSourceOther(''); setRegConsent(false); setRegError('');
    setInvoiceNo(''); setAmount(''); setEarnError(''); setEarnMsg('');
  };

  // إعادة تحميل العضو + حركاته (تشمل الانتهاء الكسول)
  const reloadMember = async (memberId) => {
    const [m, list] = await Promise.all([
      getLoyaltyMember(memberId, byMeta),
      getLoyaltyTransactions(memberId),
    ]);
    setMember(m);
    setTxs(list);
    return m;
  };

  const handleSearch = async () => {
    setSearchError('');
    setEarnMsg('');
    if (!normalizePhone(phoneInput)) {
      setSearchError(en ? 'Invalid phone number' : 'رقم الجوال غير صالح');
      return;
    }
    setSearchBusy(true);
    try {
      const found = await findLoyaltyMemberByPhone(branchId, phoneInput);
      if (found) {
        await reloadMember(found.id);
        setStage('member');
      } else {
        setStage('register');
      }
    } catch (err) {
      setSearchError(err?.message || (en ? 'Search failed' : 'تعذّر البحث'));
    } finally {
      setSearchBusy(false);
    }
  };

  const handleRegister = async () => {
    setRegError('');
    if (!regName.trim()) { setRegError(en ? 'Enter the customer name' : 'أدخل اسم العميل'); return; }
    if (regSource === 'other' && !regSourceOther.trim()) {
      setRegError(en ? 'Specify the source' : 'حدّد المصدر');
      return;
    }
    setRegBusy(true);
    try {
      const created = await createLoyaltyMember({
        store: branchId,
        phone: phoneInput,
        name: regName,
        source: regSource,
        sourceOther: regSourceOther,
        marketingConsent: regConsent,
        ...byMeta,
      });
      await reloadMember(created.id);
      setStage('member');
    } catch (err) {
      setRegError(err?.message || (en ? 'Failed to create membership' : 'تعذّر إنشاء العضوية'));
    } finally {
      setRegBusy(false);
    }
  };

  const handleEarn = async () => {
    setEarnError('');
    setEarnMsg('');
    if (!invoiceNo.trim()) { setEarnError(en ? 'Invoice number is required' : 'رقم الفاتورة إلزامي'); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { setEarnError(en ? 'Enter a valid amount' : 'أدخل مبلغاً صحيحاً'); return; }
    setEarnBusy(true);
    try {
      const res = await earnLoyaltyPoints({
        store: branchId,
        memberId: member.id,
        invoiceNo,
        amount: amt,
        ...byMeta,
      });
      setInvoiceNo('');
      setAmount('');
      setEarnMsg(en
        ? `+${res.points.toLocaleString('en-US')} points added ✓`
        : `تمت إضافة ${res.points.toLocaleString('en-US')} نقطة ✓`);
      await reloadMember(member.id);
    } catch (err) {
      // duplicate-invoice تصل برسالتها العربية من طبقة البيانات
      setEarnError(err?.code === 'duplicate-invoice' && en
        ? 'Invoice number already used in this store'
        : err?.message || (en ? 'Failed to add points' : 'تعذّرت إضافة النقاط'));
    } finally {
      setEarnBusy(false);
    }
  };

  const handleRedeem = async () => {
    if (!confirmReward) return;
    await redeemLoyaltyReward({
      store: branchId,
      memberId: member.id,
      rewardId: confirmReward.id,
      ...byMeta,
    });
    setEarnMsg(en
      ? `Redeemed: ${confirmReward.label} ✓`
      : `تم الاستبدال: ${confirmReward.label} ✓`);
    await reloadMember(member.id);
  };

  const balance = Number(member?.pointsBalance) || 0;
  const negativeBalance = balance < 0;
  const tierInfo = member && settings ? effectiveTier(member, txs, settings) : null;
  const tierStyle = tierInfo?.tier ? (TIER_STYLE[tierInfo.tier.key] || TIER_STYLE.silver) : null;
  const activeSources = (settings?.sources || []).filter((s) => s.active !== false);

  const inputCls = 'w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue';

  return (
    <div
      className="min-h-full px-5 pt-3 pb-8 md:max-w-2xl md:mx-auto space-y-3"
      style={{ fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif' }}
    >
      {/* ===== البحث بالجوال ===== */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-3">
        <div className="flex items-center gap-2">
          <Star size={18} className="text-tw-blue" />
          <h3 className="font-bold text-sm text-tw-navy">
            {en ? 'Loyalty program' : 'برنامج الولاء'}
          </h3>
        </div>
        <div className="flex gap-2">
          <input
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder={en ? 'Phone e.g. 05XXXXXXXX' : 'رقم الجوال مثال 05XXXXXXXX'}
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            className={`${inputCls} text-center font-mono`}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searchBusy}
            className="px-4 rounded-xl bg-tw-blue text-white font-bold text-sm flex items-center gap-1.5 disabled:opacity-60"
          >
            {searchBusy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {en ? 'Search' : 'بحث'}
          </button>
        </div>
        {searchError && <p className="text-xs font-bold text-tw-red">{searchError}</p>}
        {stage !== 'search' && (
          <button
            type="button"
            onClick={resetToSearch}
            className="text-xs font-bold text-tw-blue underline underline-offset-2"
          >
            {en ? 'Search for another member' : 'بحث عن عضو آخر'}
          </button>
        )}
      </div>

      {/* ===== لا توجد عضوية → نموذج الإنشاء ===== */}
      {stage === 'register' && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-blue/30 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-tw-blue" />
            <h3 className="font-bold text-sm text-tw-navy">
              {en ? 'No membership found — register a new member' : 'لا توجد عضوية بهذا الرقم — تسجيل عضو جديد'}
            </h3>
          </div>
          <p className="text-xs text-tw-muted font-semibold" dir="ltr" style={{ textAlign: en ? 'left' : 'right' }}>
            {normalizePhone(phoneInput)}
          </p>
          <input
            type="text"
            placeholder={en ? 'Customer name' : 'اسم العميل'}
            value={regName}
            onChange={(e) => setRegName(e.target.value)}
            className={inputCls}
          />
          {/* مصدر التعرف — أزرار سريعة */}
          <div>
            <p className="text-xs font-bold text-tw-muted mb-1.5">{en ? 'How did they hear about us?' : 'مصدر التعرف علينا'}</p>
            <div className="flex flex-wrap gap-1.5">
              {activeSources.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setRegSource(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    regSource === s.id
                      ? 'bg-tw-blue text-white border-tw-blue'
                      : 'bg-tw-soft/40 text-tw-navy border-tw-line'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {regSource === 'other' && (
            <input
              type="text"
              placeholder={en ? 'Specify the source' : 'حدّد المصدر'}
              value={regSourceOther}
              onChange={(e) => setRegSourceOther(e.target.value)}
              className={inputCls}
            />
          )}
          <label className="flex items-center gap-2 text-xs font-bold text-tw-navy cursor-pointer">
            <input
              type="checkbox"
              checked={regConsent}
              onChange={(e) => setRegConsent(e.target.checked)}
              className="w-4 h-4 accent-[#005BFF]"
            />
            {en ? 'Agrees to receive marketing messages' : 'موافقة على استقبال رسائل تسويقية'}
          </label>
          {regError && <p className="text-xs font-bold text-tw-red">{regError}</p>}
          <button
            type="button"
            onClick={handleRegister}
            disabled={regBusy}
            className="w-full py-3 rounded-xl bg-tw-blue text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {regBusy && <Loader2 size={16} className="animate-spin" />}
            {regBusy ? (en ? 'Creating…' : 'جارٍ الإنشاء…') : (en ? 'Create membership' : 'إنشاء العضوية')}
          </button>
        </div>
      )}

      {/* ===== بطاقة العضو ===== */}
      {stage === 'member' && member && (
        <>
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
            <div className="relative space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-base leading-tight">{member.name}</h3>
                  <p className="text-[11px] opacity-80 font-mono" dir="ltr" style={{ textAlign: en ? 'left' : 'right' }}>
                    {member.memberNo} · {member.phone}
                  </p>
                </div>
                {tierStyle && (
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-extrabold flex-shrink-0"
                    style={{ background: tierStyle.bg, color: tierStyle.color }}
                  >
                    {tierInfo.tier.name}{tierInfo.manual ? ' ★' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-end justify-between gap-2 pt-1">
                <div>
                  <p className="text-[10px] opacity-80 font-semibold">{en ? 'Points balance' : 'رصيد النقاط'}</p>
                  <p className={`text-3xl font-extrabold leading-none ${negativeBalance ? 'text-[#FFB4B4]' : ''}`}>
                    {balance.toLocaleString('en-US')}
                  </p>
                </div>
                <p className="text-[11px] opacity-80 font-semibold">
                  {en ? 'Redemptions:' : 'الاستبدالات:'} {Number(member.redemptionsCount) || 0}
                </p>
              </div>
            </div>
          </div>

          {member.status === 'disabled' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-tw-red flex-shrink-0" />
              <p className="text-xs font-bold text-tw-red">
                {en ? 'This membership is disabled — contact the manager.' : 'هذه العضوية معطّلة — تواصل مع المدير.'}
              </p>
            </div>
          )}

          {earnMsg && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
              <p className="text-xs font-bold text-green-700">{earnMsg}</p>
            </div>
          )}

          {/* ===== إضافة نقاط ===== */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-3">
            <div className="flex items-center gap-2">
              <ReceiptText size={18} className="text-tw-blue" />
              <h3 className="font-bold text-sm text-tw-navy">{en ? 'Add points' : 'إضافة نقاط'}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={en ? 'Invoice no. (required)' : 'رقم الفاتورة (إلزامي)'}
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className={inputCls}
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder={en ? 'Amount (SAR)' : 'المبلغ (ريال)'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls}
              />
            </div>
            {earnError && <p className="text-xs font-bold text-tw-red">{earnError}</p>}
            <button
              type="button"
              onClick={handleEarn}
              disabled={earnBusy || member.status === 'disabled'}
              className="w-full py-3 rounded-xl bg-tw-blue text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {earnBusy && <Loader2 size={16} className="animate-spin" />}
              {earnBusy ? (en ? 'Saving…' : 'جارٍ الحفظ…') : (en ? 'Add points' : 'إضافة النقاط')}
            </button>
          </div>

          {/* ===== شبكة المكافآت ===== */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-3">
            <div className="flex items-center gap-2">
              <Gift size={18} className="text-tw-blue" />
              <h3 className="font-bold text-sm text-tw-navy">{en ? 'Rewards' : 'المكافآت'}</h3>
            </div>
            {negativeBalance && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-tw-red flex-shrink-0" />
                <p className="text-xs font-bold text-tw-red">
                  {en
                    ? 'Balance is negative — redemption is disabled until the balance is settled.'
                    : 'الرصيد سالب — الاستبدال معطّل حتى تسوية الرصيد.'}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(settings?.rewards || []).filter((r) => r.active !== false).map((r) => {
                const available = !negativeBalance
                  && balance >= Number(r.points)
                  && member.status !== 'disabled';
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={!available}
                    onClick={() => setConfirmReward(r)}
                    className={`p-3 rounded-xl border text-center transition-transform ${
                      available
                        ? 'bg-tw-blue text-white border-tw-blue active:scale-95 shadow-sm'
                        : 'bg-tw-soft/40 text-[#8A96AA] border-tw-line cursor-not-allowed'
                    }`}
                  >
                    <p className="font-extrabold text-sm leading-tight">{r.label}</p>
                    <p className={`text-[11px] font-bold mt-1 ${available ? 'opacity-90' : ''}`}>
                      {Number(r.points).toLocaleString('en-US')} {en ? 'pts' : 'نقطة'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* تأكيد الاستبدال */}
      <LoyaltyConfirmSheet
        open={!!confirmReward}
        variant="redeem"
        lang={lang}
        title={en ? 'Confirm redemption?' : 'تأكيد الاستبدال؟'}
        message={confirmReward
          ? (en
              ? `${confirmReward.label}\n${Number(confirmReward.points).toLocaleString('en-US')} points will be deducted`
              : `${confirmReward.label}\nسيتم خصم ${Number(confirmReward.points).toLocaleString('en-US')} نقطة من الرصيد`)
          : ''}
        confirmLabel={en ? 'Redeem' : 'استبدال'}
        onConfirm={handleRedeem}
        onClose={() => setConfirmReward(null)}
      />
    </div>
  );
}
