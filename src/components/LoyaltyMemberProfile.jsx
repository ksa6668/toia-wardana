// src/components/LoyaltyMemberProfile.jsx
// ----------------------------------------------------------
// ملف العضو (شاشة مدير فرعية): البيانات، سجل المشتريات،
// حركة النقاط الكاملة، التصحيح/العكس بسبب إلزامي (بلا حذف)،
// الترقية اليدوية للفئة، وتعطيل/تفعيل العضوية.
// حالة "معكوسة" تُشتق من حركات reverse (reversesTxId) — السجل إضافي فقط.
// ----------------------------------------------------------
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Undo2, Star, ShieldOff, ShieldCheck, SlidersHorizontal, Pencil, MessageCircle, AlertTriangle, UserX, Trash2 } from 'lucide-react';
import {
  getLoyaltyMember,
  getLoyaltyTransactions,
  getLoyaltySettings,
  reverseLoyaltyTransaction,
  adjustLoyaltyPoints,
  setLoyaltyManualTier,
  setLoyaltyMemberStatus,
  updateLoyaltyMemberContact,
  loyaltyAnonymizeMember,
  loyaltyDeleteMemberWithArchive,
} from '../firebase';
import { effectiveTier, toDateSafe, addMonths } from '../loyaltyMath';
import {
  renderWelcomeMessage,
  buildWhatsappUrl,
  cardUrlFor,
  isLocalOrigin,
  STORE_NAMES,
} from '../loyaltyShare';
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
  audit:   { ar: 'إجراء إداري', en: 'Audit' },
};

// أسماء إجراءات التدقيق (المرحلة 2 + المرحلة 5)
const AUDIT_ACTION_LABEL = {
  disable:    { ar: 'تعطيل العضوية',  en: 'Membership disabled' },
  enable:     { ar: 'إعادة التفعيل',  en: 'Membership re-enabled' },
  editPhone:  { ar: 'تعديل الجوال',   en: 'Phone edited' },
  editName:   { ar: 'تعديل الاسم',    en: 'Name edited' },
  editGender: { ar: 'تعديل الجنس',    en: 'Gender edited' },
  anonymize:  { ar: 'إخفاء الهوية',   en: 'Anonymized' },
};

const GENDER_LABEL = {
  male:   { ar: 'ذكر',  en: 'Male' },
  female: { ar: 'أنثى', en: 'Female' },
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
  // تعطيل/تفعيل — المرحلة 2: عبر ConfirmSheet بسبب إلزامي
  const [statusConfirm, setStatusConfirm] = useState(false);
  // تعديل الجوال/الاسم — المرحلة 2 (+ الجنس — المرحلة 5)
  const [showEditContact, setShowEditContact] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  // درجات الحذف — المرحلة 5
  const [anonConfirm, setAnonConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  // تحذير واتساب (بيئة محلية / جوال غير صالح)
  const [waWarning, setWaWarning] = useState('');

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
  // المرحلة 5: مخفي الهوية — تُعرض سجلاته للتقارير، وتُخفى إجراءات التشغيل
  const anonymized = !!member.anonymized;

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

  // المرحلة 2: فتح نموذج تعديل الجوال/الاسم بقيم العضو الحالية
  const openEditContact = () => {
    setEditName(member?.name || '');
    setEditPhone(member?.phone || '');
    setEditGender(member?.gender || '');
    setEditReason('');
    setEditError('');
    setShowEditContact(true);
  };

  const handleSaveContact = async () => {
    setEditError('');
    if (!editReason.trim()) {
      setEditError(en ? 'Reason is required' : 'السبب إلزامي');
      return;
    }
    setEditBusy(true);
    try {
      const res = await updateLoyaltyMemberContact({
        memberId,
        name: editName,
        phone: editPhone,
        // لا نمرر gender إلا إذا اختير — القدامى بلا الحقل يبقون «غير مسجّل»
        ...(editGender ? { gender: editGender } : {}),
        reason: editReason,
        ...byMeta,
      });
      setShowEditContact(false);
      setNotice(res.changed
        ? (en ? 'Contact info updated ✓' : 'تم تحديث البيانات ✓')
        : (en ? 'No changes to save' : 'لا تغييرات للحفظ'));
      await load();
    } catch (err) {
      setEditError(err?.message || (en ? 'Failed' : 'تعذّر التنفيذ'));
    } finally {
      setEditBusy(false);
    }
  };

  // المرحلة 2: إعادة إرسال البطاقة عبر واتساب من ملف العضو
  const handleSendWhatsapp = () => {
    setWaWarning('');
    const origin = window.location.origin;
    if (isLocalOrigin(origin)) {
      setWaWarning(en
        ? 'Local development environment — the card link would be broken. Send from the deployed app.'
        : 'أنت على بيئة تطوير محلية — رابط البطاقة سيكون معطلاً. أرسل من التطبيق المنشور.');
      return;
    }
    const text = renderWelcomeMessage(settings?.welcomeMessage, {
      name: member.name,
      storeName: STORE_NAMES[member.store] || member.store,
      memberNo: member.memberNo,
      tier: tierInfo?.tier?.name || 'عضو',
      points: Number(member.pointsBalance) || 0,
      cardUrl: cardUrlFor(origin, member.cardToken),
    });
    const url = buildWhatsappUrl(member.phone, text);
    if (!url) {
      setWaWarning(en ? 'Invalid phone number' : 'رقم الجوال غير صالح');
      return;
    }
    window.open(url, '_blank', 'noopener');
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
          <p>
            {en ? 'Points expire:' : 'انتهاء النقاط:'} {fmtDate(member.pointsExpireAt, en)}
            {' · '}{en ? 'Gender:' : 'الجنس:'} {GENDER_LABEL[member.gender]?.[en ? 'en' : 'ar'] || (en ? 'Unregistered' : 'غير مسجّل')}
            {' · '}{en ? 'Marketing consent:' : 'موافقة تسويقية:'} {member.marketingConsent ? '✓' : '✗'}
          </p>
          {tierInfo?.manual && member.manualTier && (
            <p className="text-[#9A7000]">
              {en ? 'Manual tier:' : 'ترقية يدوية:'} {member.manualTier.reason}
              {member.manualTier.until ? ` (${en ? 'until' : 'حتى'} ${fmtDate(member.manualTier.until, en)})` : ''}
            </p>
          )}
          {disabled && (
            <p className="text-tw-red font-bold">
              {en ? 'Disabled:' : 'معطّلة:'} {member.statusReason || '—'}
              {member.statusBy ? ` · ${member.statusBy}` : ''}
              {member.statusChangedAt ? ` · ${fmtDate(member.statusChangedAt, en)}` : ''}
            </p>
          )}
        </div>
      </div>

      {notice && <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl p-2.5 text-center">{notice}</p>}
      {error && <p className="text-xs font-bold text-tw-red bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">{error}</p>}

      {/* حالة مخفي الهوية */}
      {anonymized && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <UserX size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs font-bold text-amber-700">
            {en
              ? 'This membership is anonymized — records are kept for reports only. Available action: full delete with archive.'
              : 'هذه العضوية مخفاة الهوية — السجلات محفوظة للتقارير فقط. المتاح: الحذف الكامل مع الأرشفة.'}
          </p>
        </div>
      )}

      {/* أزرار الإجراءات — تُخفى لمخفي الهوية */}
      {!anonymized && (
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setShowAdjust((v) => !v)}
                className="py-2.5 rounded-xl bg-white border border-tw-line text-tw-navy text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-tw-soft">
          <SlidersHorizontal size={14} /> {en ? 'Adjust' : 'تسوية'}
        </button>
        <button type="button" onClick={() => setShowTier((v) => !v)}
                className="py-2.5 rounded-xl bg-white border border-tw-line text-tw-navy text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-tw-soft">
          <Star size={14} /> {en ? 'Manual tier' : 'ترقية يدوية'}
        </button>
        <button type="button" onClick={openEditContact}
                className="py-2.5 rounded-xl bg-white border border-tw-line text-tw-navy text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-tw-soft">
          <Pencil size={14} /> {en ? 'Edit contact' : 'تعديل البيانات'}
        </button>
        {/* المرحلة 2: تعطيل/تفعيل عبر ConfirmSheet بسبب إلزامي — الحذف ممنوع بالتصميم */}
        <button type="button" onClick={() => setStatusConfirm(true)}
                className={`py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                  disabled
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    : 'bg-red-50 border-red-200 text-tw-red hover:bg-red-100'
                }`}>
          {disabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
          {disabled ? (en ? 'Re-enable' : 'إعادة التفعيل') : (en ? 'Disable membership' : 'تعطيل العضوية')}
        </button>
      </div>
      )}

      {/* إعادة إرسال البطاقة عبر واتساب */}
      {!disabled && !anonymized && (
        <>
          <button
            type="button"
            onClick={handleSendWhatsapp}
            className="w-full py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
          >
            <MessageCircle size={15} />
            {en ? 'Resend card via WhatsApp' : 'إرسال البطاقة عبر واتساب'}
          </button>
          {waWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
              <p className="text-[11px] font-bold text-amber-700">{waWarning}</p>
            </div>
          )}
        </>
      )}

      {/* نموذج تعديل الجوال/الاسم — سبب إلزامي وسجل تدقيق */}
      {showEditContact && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-blue/30 space-y-2">
          <h4 className="font-bold text-sm text-tw-navy">{en ? 'Edit contact info' : 'تعديل بيانات العضو'}</h4>
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                 placeholder={en ? 'Name' : 'الاسم'} className={inputCls} />
          <input type="tel" inputMode="tel" dir="ltr" value={editPhone}
                 onChange={(e) => setEditPhone(e.target.value)}
                 placeholder={en ? 'Phone' : 'رقم الجوال'}
                 className={`${inputCls} text-center font-mono`} />
          {/* المرحلة 5: تعديل الجنس — للمدير فقط، يُسجَّل بحركة audit */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-tw-muted flex-shrink-0">{en ? 'Gender:' : 'الجنس:'}</span>
            {[
              { v: 'male', label: en ? 'Male' : 'ذكر' },
              { v: 'female', label: en ? 'Female' : 'أنثى' },
            ].map((g) => (
              <button key={g.v} type="button" onClick={() => setEditGender(g.v)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        editGender === g.v
                          ? 'bg-tw-blue text-white border-tw-blue'
                          : 'bg-tw-soft/40 text-tw-navy border-tw-line'
                      }`}>
                {g.label}
              </button>
            ))}
            {!member.gender && !editGender && (
              <span className="text-[10px] font-bold text-tw-muted">({en ? 'unregistered' : 'غير مسجّل'})</span>
            )}
          </div>
          <input type="text" value={editReason} onChange={(e) => setEditReason(e.target.value)}
                 placeholder={en ? 'Reason (required)' : 'السبب (إلزامي)'} className={inputCls} />
          {editError && <p className="text-xs font-bold text-tw-red">{editError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowEditContact(false)} disabled={editBusy}
                    className="flex-1 py-2.5 rounded-xl bg-white border border-tw-line text-tw-navy text-sm font-bold">
              {en ? 'Cancel' : 'إلغاء'}
            </button>
            <button type="button" onClick={handleSaveContact} disabled={editBusy}
                    className="flex-1 py-2.5 rounded-xl bg-tw-blue text-white text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2">
              {editBusy && <Loader2 size={14} className="animate-spin" />}
              {en ? 'Save' : 'حفظ'}
            </button>
          </div>
        </div>
      )}

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

      {/* المرحلة 5: درجات الحذف — الحذف ممنوع مباشرة؛ إخفاء هوية أو حذف كامل مع أرشفة */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-red-200 space-y-2">
        <h4 className="font-bold text-sm text-tw-red">{en ? 'Danger zone' : 'إجراءات حساسة'}</h4>
        <div className="grid grid-cols-2 gap-2">
          {!anonymized && (
            <button type="button" onClick={() => setAnonConfirm(true)}
                    className="py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-amber-100">
              <UserX size={14} /> {en ? 'Anonymize' : 'إخفاء الهوية'}
            </button>
          )}
          <button type="button" onClick={() => setDeleteConfirm(true)}
                  className={`py-2.5 rounded-xl bg-red-50 border border-red-200 text-tw-red text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-red-100 ${anonymized ? 'col-span-2' : ''}`}>
            <Trash2 size={14} /> {en ? 'Full delete + archive' : 'حذف كامل مع أرشفة'}
          </button>
        </div>
        <p className="text-[10px] text-tw-muted font-semibold leading-relaxed">
          {en
            ? 'Anonymize: clears name/phone/gender and kills the card link, keeps all records for reports. Full delete: archives the member and all transactions then removes them — invoice locks are never deleted.'
            : 'إخفاء الهوية: يمسح الاسم والجوال والجنس ويبطل رابط البطاقة مع بقاء كل السجلات للتقارير. الحذف الكامل: يؤرشف العضوية وكل حركاتها ثم يحذفها — قيود أرقام الفواتير لا تُحذف أبداً.'}
        </p>
      </div>

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
          const isAudit = x.type === 'audit';
          // حركات audit (المرحلة 2): إجراء إداري بنقاط 0 — خارج حسابات الرصيد والفئة
          const label = isAudit
            ? (AUDIT_ACTION_LABEL[x.action]?.[en ? 'en' : 'ar'] || TYPE_LABEL.audit[en ? 'en' : 'ar'])
            : (TYPE_LABEL[x.type] ? TYPE_LABEL[x.type][en ? 'en' : 'ar'] : x.type);
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
                {isAudit && (x.action === 'editPhone' || x.action === 'editName') && (
                  <p className="text-[10px] text-tw-muted font-semibold truncate" dir="ltr" style={{ textAlign: en ? 'left' : 'right' }}>
                    {x.oldValue} ← {x.newValue}
                  </p>
                )}
                {x.reason && <p className="text-[10px] text-tw-muted font-semibold truncate">{x.reason}</p>}
                <p className="text-[10px] text-tw-muted font-semibold">
                  {fmtDate(x.at, en)} · {x.byName || '—'}
                  {!isAudit && <> · {en ? 'balance after:' : 'الرصيد بعدها:'} {(Number(x.balanceAfter) || 0).toLocaleString('en-US')}</>}
                </p>
              </div>
              {!isAudit && (
                <span className={`text-xs font-extrabold flex-shrink-0 ${p >= 0 ? 'text-green-700' : 'text-tw-red'}`}>
                  {p >= 0 ? '+' : ''}{p.toLocaleString('en-US')}
                </span>
              )}
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

      {/* تأكيد التعطيل/التفعيل — سبب إلزامي وسجل تدقيق (الحذف ممنوع بالتصميم) */}
      <LoyaltyConfirmSheet
        open={statusConfirm}
        variant={disabled ? 'redeem' : 'reverse'}
        lang={lang}
        requireReason
        title={disabled
          ? (en ? 'Re-enable this membership?' : 'إعادة تفعيل العضوية؟')
          : (en ? 'Disable this membership?' : 'تعطيل العضوية؟')}
        message={disabled
          ? (en
              ? 'Earning and redemption will work again, and the public card will be available.'
              : 'سيعود كسب النقاط والاستبدال للعمل، وستتاح البطاقة العامة من جديد.')
          : (en
              ? 'Earning and redemption will stop and the public card returns 404. All records stay intact — nothing is deleted.'
              : 'سيتوقف كسب النقاط والاستبدال وتصبح البطاقة العامة غير متاحة. كل السجلات تبقى كما هي — لا يُحذف شيء.')}
        confirmLabel={disabled ? (en ? 'Re-enable' : 'إعادة التفعيل') : (en ? 'Disable' : 'تعطيل')}
        onConfirm={async (reason) => {
          await setLoyaltyMemberStatus(memberId, disabled ? 'active' : 'disabled', { reason, ...byMeta });
          setNotice(disabled
            ? (en ? 'Membership re-enabled ✓' : 'تمت إعادة التفعيل ✓')
            : (en ? 'Membership disabled ✓' : 'تم تعطيل العضوية ✓'));
          await load();
        }}
        onClose={() => setStatusConfirm(false)}
      />

      {/* المرحلة 5: تأكيد إخفاء الهوية — سبب إلزامي */}
      <LoyaltyConfirmSheet
        open={anonConfirm}
        variant="reverse"
        lang={lang}
        requireReason
        title={en ? 'Anonymize this membership?' : 'إخفاء هوية العضوية؟'}
        message={en
          ? 'Name, phone and gender will be cleared ("Deleted member") and the public card link dies. All transactions stay for reports. This cannot be undone.'
          : 'سيُمسح الاسم والجوال والجنس («عضو محذوف») ويبطل رابط البطاقة العامة. كل الحركات تبقى للتقارير. لا يمكن التراجع.'}
        confirmLabel={en ? 'Anonymize' : 'إخفاء الهوية'}
        onConfirm={async (reason) => {
          await loyaltyAnonymizeMember({ memberId, reason });
          setNotice(en ? 'Membership anonymized ✓' : 'تم إخفاء الهوية ✓');
          await load();
        }}
        onClose={() => setAnonConfirm(false)}
      />

      {/* المرحلة 5: تأكيد الحذف الكامل — سبب إلزامي + كتابة رقم العضوية */}
      <LoyaltyConfirmSheet
        open={deleteConfirm}
        variant="reverse"
        lang={lang}
        requireReason
        confirmText={member.memberNo || ''}
        title={en ? 'Full delete with archive?' : 'حذف كامل مع أرشفة؟'}
        message={en
          ? 'The member and all transactions are copied to the archive first, then removed. Invoice locks are never deleted. If any step fails, nothing is removed.'
          : 'تُنسخ العضوية وكل حركاتها إلى الأرشيف أولاً ثم تُحذف. قيود أرقام الفواتير لا تُحذف أبداً. إن فشلت أي خطوة لا يُحذف شيء.'}
        confirmLabel={en ? 'Delete permanently' : 'حذف نهائي'}
        onConfirm={async (reason, typedMemberNo) => {
          await loyaltyDeleteMemberWithArchive({
            memberId,
            reason,
            // ما كتبه المدير بيده — يُتحقق منه خادمياً مرة ثانية
            confirmMemberNo: typedMemberNo,
          });
          onBack?.(); // العضوية لم تعد موجودة — عودة للقائمة
        }}
        onClose={() => setDeleteConfirm(false)}
      />
    </div>
  );
}
