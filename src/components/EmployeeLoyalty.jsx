// src/components/EmployeeLoyalty.jsx
// ----------------------------------------------------------
// شاشة الموظف — برنامج الولاء (النسخة 3.0: رصيد بالريال).
// صفحة واحدة تبدأ بحقل رقم الجوال:
//   • البحث يوحّد صيغة الرقم ويبحث في المتجر الحالي فقط (branchId)
//   • لا عضوية → نموذج إنشاء (اسم/جنس/لغة/مصدر/موافقة + فاتورة ومبلغ
//     اختياريان — تسجيل مع شراء = معاملة واحدة كل شيء أو لا شيء)
//   • عضوية → الرصيد بالريال + الفئة ونسبة الكسب + إضافة شراء
//     (يعرض المكتسب قبل التأكيد) + خصم بمضاعفات ربع ريال
//   • الرصيد المتاح يُخصم منه الترحيبية المعلّقة مع توضيح «متاحة بعد …»
// كل الإدخالات بالريال وتُحوَّل هللات صحيحة قبل طبقة البيانات.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Search, Loader2, UserPlus, Star, Wallet, ReceiptText, CheckCircle2, AlertTriangle, QrCode, MessageCircle } from 'lucide-react';
import {
  getLoyaltySettings,
  findLoyaltyMemberByPhone,
  findLoyaltyMemberByMemberNo,
  createLoyaltyMember,
  getLoyaltyMember,
  getLoyaltyTransactions,
  earnLoyaltyCredit,
  redeemLoyaltyCredit,
  markLoyaltyWelcomeSent,
} from '../firebase';
import {
  effectiveTier,
  tierName,
  normalizePhone,
  storeLetter,
  riyalsToHalalas,
  halalasToRiyalLabel,
  availableBalanceHalalas,
  isWelcomeOnHold,
  welcomeAvailableAt,
  isValidRedeemAmount,
  computeEarnedHalalas,
  toDateSafe,
} from '../loyaltyMath';
import {
  renderWelcomeMessage,
  buildCreditMessage,
  buildWhatsappUrl,
  cardUrlFor,
  isLocalOrigin,
  STORE_NAMES,
} from '../loyaltyShare';
import LoyaltyConfirmSheet from './LoyaltyConfirmSheet';
import QrScanSheet from './QrScanSheet';
import { toLatinDigits } from '../utils/digits';

// ألوان شارات الفئات
const TIER_STYLE = {
  silver:   { bg: '#EDF1F7', color: '#5A6B85' },
  gold:     { bg: '#FFF4D6', color: '#9A7000' },
  platinum: { bg: '#E9E4FA', color: '#5B3FA8' },
};

function fmtDateTime(v, en) {
  const d = toDateSafe(v);
  if (!d) return '—';
  return d.toLocaleString(en ? 'en-GB' : 'ar-SA-u-nu-latn', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

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
  const [regGender, setRegGender] = useState(''); // إلزامي — male | female
  const [regLanguage, setRegLanguage] = useState(''); // النسخة 3.0: إلزامي — ar | en
  const [regSource, setRegSource] = useState('');
  const [regSourceOther, setRegSourceOther] = useState('');
  const [regConsent, setRegConsent] = useState(false);
  // شراء عند التسجيل — اختياري (الفاتورة والمبلغ معاً أو لا شيء)
  const [regInvoiceNo, setRegInvoiceNo] = useState('');
  const [regAmount, setRegAmount] = useState(''); // بالريال
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState('');

  // إضافة شراء
  const [invoiceNo, setInvoiceNo] = useState('');
  const [amount, setAmount] = useState(''); // بالريال
  const [earnBusy, setEarnBusy] = useState(false);
  const [earnError, setEarnError] = useState('');
  const [earnMsg, setEarnMsg] = useState('');

  // خصم من الرصيد
  const [redeemAmount, setRedeemAmount] = useState(''); // بالريال
  const [redeemError, setRedeemError] = useState('');
  const [confirmRedeem, setConfirmRedeem] = useState(null); // {halalas}

  // مسح QR + إرسال واتساب
  const [showScan, setShowScan] = useState(false);
  const [waWarning, setWaWarning] = useState('');
  // آخر إضافة رصيد ناجحة — {earnedHalalas, balanceAfterHalalas} من نتيجة
  // المعاملة نفسها (لا قراءة جديدة). زر الإشعار يظهر بعدها مباشرة فقط.
  const [lastEarn, setLastEarn] = useState(null);

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
    setLastEarn(null);
    setSearchError('');
    setRegName(''); setRegGender(''); setRegLanguage(''); setRegSource(''); setRegSourceOther('');
    setRegConsent(false); setRegInvoiceNo(''); setRegAmount(''); setRegError('');
    setInvoiceNo(''); setAmount(''); setEarnError(''); setEarnMsg('');
    setRedeemAmount(''); setRedeemError('');
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
    setLastEarn(null); // زر الإشعار خاص بآخر عملية للعضو المعروض فقط
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
    if (regGender !== 'male' && regGender !== 'female') {
      setRegError(en ? 'Select the customer gender' : 'حدّد جنس العميل');
      return;
    }
    if (regLanguage !== 'ar' && regLanguage !== 'en') {
      setRegError(en ? 'Select the customer language' : 'حدّد لغة العميل');
      return;
    }
    if (regSource === 'other' && !regSourceOther.trim()) {
      setRegError(en ? 'Specify the source' : 'حدّد المصدر');
      return;
    }
    // شراء عند التسجيل: التحقق يسري فقط إن أُدخل أحد الحقلين
    const hasInvoice = !!regInvoiceNo.trim();
    const amtHalalas = regAmount.trim() === '' ? null : riyalsToHalalas(regAmount);
    const hasAmount = amtHalalas != null && amtHalalas > 0;
    if (hasInvoice && !hasAmount) {
      setRegError(en ? 'Enter the invoice amount' : 'أدخل مبلغ الفاتورة');
      return;
    }
    if (hasAmount && !hasInvoice) {
      setRegError(en ? 'Enter the invoice number' : 'أدخل رقم الفاتورة');
      return;
    }
    setRegBusy(true);
    try {
      const created = await createLoyaltyMember({
        store: branchId,
        phone: phoneInput,
        name: regName,
        gender: regGender,
        language: regLanguage,
        source: regSource,
        sourceOther: regSourceOther,
        marketingConsent: regConsent,
        invoiceNo: hasInvoice ? regInvoiceNo : '',
        amountHalalas: hasAmount ? amtHalalas : null,
        ...byMeta,
      });
      if (created.earnedHalalas > 0) {
        setEarnMsg(en
          ? `Membership created — SAR ${halalasToRiyalLabel(created.earnedHalalas)} earned ✓`
          : `أُنشئت العضوية — كسب ${halalasToRiyalLabel(created.earnedHalalas)} ريال ✓`);
      }
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
    const amtHalalas = riyalsToHalalas(amount);
    if (!amtHalalas || amtHalalas <= 0) { setEarnError(en ? 'Enter a valid amount' : 'أدخل مبلغاً صحيحاً'); return; }
    setEarnBusy(true);
    try {
      const res = await earnLoyaltyCredit({
        store: branchId,
        memberId: member.id,
        invoiceNo,
        amountHalalas: amtHalalas,
        ...byMeta,
      });
      setInvoiceNo('');
      setAmount('');
      setEarnMsg(en
        ? `SAR ${halalasToRiyalLabel(res.earnedHalalas)} added ✓`
        : `أُضيف ${halalasToRiyalLabel(res.earnedHalalas)} ريال إلى الرصيد ✓`);
      // قيم الإشعار من نتيجة المعاملة نفسها — دقيقة حتى مع عمليات لاحقة
      setLastEarn({ earnedHalalas: res.earnedHalalas, balanceAfterHalalas: res.balanceAfterHalalas });
      await reloadMember(member.id);
    } catch (err) {
      // duplicate-invoice تصل برسالتها العربية من طبقة البيانات
      setEarnError(err?.code === 'duplicate-invoice' && en
        ? 'Invoice number already used in this store'
        : err?.message || (en ? 'Failed to add credit' : 'تعذّرت إضافة الرصيد'));
    } finally {
      setEarnBusy(false);
    }
  };

  // نتيجة مسح QR — الرمز يحمل رقم العضوية (مثل T-48271)
  const handleScanResult = async (code) => {
    setShowScan(false);
    setSearchError('');
    setEarnMsg('');
    setLastEarn(null);
    const clean = String(code || '').trim().toUpperCase();
    if (!/^[TW]-\d{5}$/.test(clean)) {
      setSearchError(en ? 'Invalid QR code' : 'رمز غير صالح — ليست بطاقة ولاء');
      return;
    }
    if (!clean.startsWith(storeLetter(branchId))) {
      setSearchError(en
        ? 'This card belongs to the other store'
        : 'هذه البطاقة تخص المتجر الآخر — كل متجر بعضوياته المستقلة');
      return;
    }
    setSearchBusy(true);
    try {
      const found = await findLoyaltyMemberByMemberNo(branchId, clean);
      if (!found) {
        setSearchError(en ? 'No membership found for this code' : 'لا توجد عضوية بهذا الرمز في هذا المتجر');
        return;
      }
      setPhoneInput(found.phone || '');
      await reloadMember(found.id);
      setStage('member');
    } catch (err) {
      setSearchError(err?.message || (en ? 'Search failed' : 'تعذّر البحث'));
    } finally {
      setSearchBusy(false);
    }
  };

  // إرسال البطاقة عبر واتساب (يدوي — يفتح wa.me بنص جاهز، عربي حالياً؛
  // اختيار القالب بلغة العميل — المرحلة B)
  const handleSendWhatsapp = () => {
    setWaWarning('');
    const origin = window.location.origin;
    // شرط: من أصل تطوير محلي لا نبني رابطاً معطلاً — تحذير واضح بدل الإرسال
    if (isLocalOrigin(origin)) {
      setWaWarning(en
        ? 'Local development environment — the card link would be broken. Send from the deployed app.'
        : 'أنت على بيئة تطوير محلية — رابط البطاقة سيكون معطلاً. أرسل من التطبيق المنشور.');
      return;
    }
    const tierInfo2 = settings ? effectiveTier(member, txs, settings) : null;
    const text = renderWelcomeMessage(settings?.welcomeMessage?.ar, {
      name: member.name,
      storeName: STORE_NAMES[branchId] || branchId,
      memberNo: member.memberNo,
      tier: tierName(tierInfo2?.tier, 'ar') || 'عضو',
      balance: halalasToRiyalLabel(Number(member.balanceHalalas) || 0),
      cardUrl: cardUrlFor(origin, member.cardToken),
    });
    const url = buildWhatsappUrl(member.phone, text);
    if (!url) {
      setWaWarning(en ? 'Invalid phone number' : 'رقم الجوال غير صالح');
      return;
    }
    window.open(url, '_blank', 'noopener');
    // يسجّل «فتح تبويب wa.me» لا «الإرسال الفعلي داخل واتساب» — غرضه
    // الوحيد تبديل نص الزر لمنع التكرار؛ لا يُبنى عليه أي تقرير وصول
    if (!member.welcomeSentAt) {
      markLoyaltyWelcomeSent(member.id).catch(() => { /* أفضل جهد */ });
      setMember((prev) => (prev ? { ...prev, welcomeSentAt: new Date() } : prev));
    }
  };

  // إشعار الرصيد المعاملاتي — من قيم آخر عملية (lastEarn) حصراً
  const handleSendCreditNotify = () => {
    if (!lastEarn || !member) return;
    setWaWarning('');
    const origin = window.location.origin;
    if (isLocalOrigin(origin)) {
      setWaWarning(en
        ? 'Local development environment — the card link would be broken. Send from the deployed app.'
        : 'أنت على بيئة تطوير محلية — رابط البطاقة سيكون معطلاً. أرسل من التطبيق المنشور.');
      return;
    }
    // القالب من إعدادات المتجر (creditMessage) — فارغ/غير محمّل → الثابت تلقائياً
    const text = buildCreditMessage({
      name: member.name,
      earned: halalasToRiyalLabel(lastEarn.earnedHalalas),
      balance: halalasToRiyalLabel(lastEarn.balanceAfterHalalas),
      cardUrl: cardUrlFor(origin, member.cardToken),
      storeName: STORE_NAMES[branchId] || branchId,
    }, settings?.creditMessage);
    const url = buildWhatsappUrl(member.phone, text);
    if (!url) {
      setWaWarning(en ? 'Invalid phone number' : 'رقم الجوال غير صالح');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  // ---- الرصيد والمتاح (الترحيبية المعلّقة) ----
  const balance = Number(member?.balanceHalalas) || 0;
  const negativeBalance = balance < 0;
  const available = member && settings ? availableBalanceHalalas(member, settings) : 0;
  const welcomeHeld = member && settings ? isWelcomeOnHold(member, settings) : false;
  const welcomeAt = welcomeHeld ? welcomeAvailableAt(member, settings) : null;
  const tierInfo = member && settings ? effectiveTier(member, txs, settings) : null;
  const tierStyle = tierInfo?.tier ? (TIER_STYLE[tierInfo.tier.key] || TIER_STYLE.silver) : null;
  const activeSources = (settings?.sources || []).filter((s) => s.active !== false);
  const ratePercent = Number(tierInfo?.tier?.ratePercent) || 0;
  const redeemStep = Number(settings?.redeemStepHalalas) || 25;

  // معاينة المكتسب قبل التأكيد — بنسبة فئة العميل الحالية
  const amountHalalasPreview = amount.trim() === '' ? null : riyalsToHalalas(amount);
  const earnPreview = amountHalalasPreview && amountHalalasPreview > 0 && settings
    ? computeEarnedHalalas(amountHalalasPreview, ratePercent, settings)
    : null;

  const handleRedeemRequest = () => {
    setRedeemError('');
    const amtHalalas = riyalsToHalalas(redeemAmount);
    if (!amtHalalas || amtHalalas <= 0) {
      setRedeemError(en ? 'Enter a valid amount' : 'أدخل مبلغاً صحيحاً');
      return;
    }
    if (!isValidRedeemAmount(amtHalalas, redeemStep)) {
      setRedeemError(en
        ? `Amount must be a multiple of SAR ${halalasToRiyalLabel(redeemStep)}`
        : `المبلغ يجب أن يكون من مضاعفات ${halalasToRiyalLabel(redeemStep)} ريال`);
      return;
    }
    if (amtHalalas > available) {
      setRedeemError(en
        ? `Available balance is SAR ${halalasToRiyalLabel(available)}`
        : `الرصيد المتاح ${halalasToRiyalLabel(available)} ريال فقط`);
      return;
    }
    setConfirmRedeem({ halalas: amtHalalas });
  };

  const handleRedeem = async () => {
    if (!confirmRedeem) return;
    await redeemLoyaltyCredit({
      store: branchId,
      memberId: member.id,
      amountHalalas: confirmRedeem.halalas,
      ...byMeta,
    });
    setRedeemAmount('');
    setEarnMsg(en
      ? `SAR ${halalasToRiyalLabel(confirmRedeem.halalas)} redeemed ✓`
      : `تم خصم ${halalasToRiyalLabel(confirmRedeem.halalas)} ريال من الرصيد ✓`);
    await reloadMember(member.id);
  };

  const inputCls = 'w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue';
  const chipCls = (active) => `px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
    active ? 'bg-tw-blue text-white border-tw-blue' : 'bg-tw-soft/40 text-tw-navy border-tw-line'
  }`;

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
            onChange={(e) => setPhoneInput(toLatinDigits(e.target.value))}
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
          {/* مسح QR من بطاقة العميل — البحث بالجوال يبقى الأساس */}
          <button
            type="button"
            onClick={() => setShowScan(true)}
            disabled={searchBusy}
            title={en ? 'Scan QR' : 'مسح QR'}
            aria-label={en ? 'Scan QR' : 'مسح QR'}
            className="px-3 rounded-xl bg-white border border-tw-line text-tw-blue hover:bg-tw-soft disabled:opacity-60"
          >
            <QrCode size={18} />
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
          {/* الجنس — إلزامي، خياران فقط */}
          <div>
            <p className="text-xs font-bold text-tw-muted mb-1.5">{en ? 'Gender (required)' : 'الجنس (إلزامي)'}</p>
            <div className="flex gap-1.5">
              {[
                { v: 'male', label: en ? 'Male' : 'ذكر' },
                { v: 'female', label: en ? 'Female' : 'أنثى' },
              ].map((g) => (
                <button key={g.v} type="button" onClick={() => setRegGender(g.v)} className={chipCls(regGender === g.v)}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          {/* النسخة 3.0: لغة العميل — إلزامية، بجانب الجنس */}
          <div>
            <p className="text-xs font-bold text-tw-muted mb-1.5">{en ? 'Language (required)' : 'اللغة (إلزامي)'}</p>
            <div className="flex gap-1.5">
              {[
                { v: 'ar', label: 'عربي' },
                { v: 'en', label: 'English' },
              ].map((l) => (
                <button key={l.v} type="button" onClick={() => setRegLanguage(l.v)} className={chipCls(regLanguage === l.v)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          {/* مصدر التعرف — أزرار سريعة */}
          <div>
            <p className="text-xs font-bold text-tw-muted mb-1.5">{en ? 'How did they hear about us?' : 'مصدر التعرف علينا'}</p>
            <div className="flex flex-wrap gap-1.5">
              {activeSources.map((s) => (
                <button key={s.id} type="button" onClick={() => setRegSource(s.id)} className={chipCls(regSource === s.id)}>
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
          {/* شراء عند التسجيل — اختياري: العضوية + الترحيبية + الشراء في معاملة واحدة */}
          <div>
            <p className="text-xs font-bold text-tw-muted mb-1.5">
              {en ? 'First purchase (optional)' : 'شراء مع التسجيل (اختياري)'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={en ? 'Invoice no. (optional)' : 'رقم الفاتورة (اختياري)'}
                value={regInvoiceNo}
                onChange={(e) => setRegInvoiceNo(toLatinDigits(e.target.value))}
                className={inputCls}
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder={en ? 'Amount SAR (optional)' : 'المبلغ بالريال (اختياري)'}
                value={regAmount}
                onChange={(e) => setRegAmount(toLatinDigits(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>
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
                    {tierName(tierInfo.tier, lang)}{tierInfo.manual ? ' ★' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-end justify-between gap-2 pt-1">
                <div>
                  <p className="text-[10px] opacity-80 font-semibold">{en ? 'Balance (SAR)' : 'الرصيد (ريال)'}</p>
                  <p className={`text-3xl font-extrabold leading-none ${negativeBalance ? 'text-[#FFB4B4]' : ''}`}>
                    {halalasToRiyalLabel(balance)}
                  </p>
                </div>
                {ratePercent > 0 && (
                  <p className="text-[11px] opacity-80 font-semibold" dir="ltr">
                    {en ? `Earn rate ${ratePercent}%` : `نسبة الكسب ${ratePercent}%`}
                  </p>
                )}
              </div>
              {/* الترحيبية المعلّقة — توضيح المتاح فعلياً */}
              {welcomeHeld && (
                <p className="text-[11px] font-bold text-[#BFE0FF]">
                  {en
                    ? `Available now: SAR ${halalasToRiyalLabel(available)} — welcome bonus (SAR ${halalasToRiyalLabel(settings?.welcomeBonusHalalas)}) available after ${fmtDateTime(welcomeAt, true)}`
                    : `المتاح للاستخدام الآن: ${halalasToRiyalLabel(available)} ريال — الترحيبية (${halalasToRiyalLabel(settings?.welcomeBonusHalalas)} ريال) متاحة بعد ${fmtDateTime(welcomeAt, false)}`}
                </p>
              )}
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

          {/* إشعار الرصيد — يظهر مباشرة بعد نجاح الإضافة فقط (ليس دائماً) */}
          {lastEarn && member.status !== 'disabled' && (
            <button
              type="button"
              onClick={handleSendCreditNotify}
              className="w-full py-2.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/40 text-[#128C4A] font-bold text-xs flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <MessageCircle size={15} />
              {en
                ? `Send credit notification (+SAR ${halalasToRiyalLabel(lastEarn.earnedHalalas)})`
                : `إرسال إشعار الرصيد عبر واتساب (+${halalasToRiyalLabel(lastEarn.earnedHalalas)} ريال)`}
            </button>
          )}

          {/* إرسال البطاقة عبر واتساب — بعد أول عملية شراء */}
          {member.lastPurchaseAt && member.status !== 'disabled' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSendWhatsapp}
                className="w-full py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <MessageCircle size={17} />
                {member.welcomeSentAt
                  ? (en ? 'Resend welcome message' : 'إعادة إرسال الترحيب')
                  : (en ? 'Send card via WhatsApp' : 'إرسال البطاقة عبر واتساب')}
              </button>
              {waWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                  <p className="text-xs font-bold text-amber-700">{waWarning}</p>
                </div>
              )}
            </div>
          )}

          {/* ===== إضافة شراء ===== */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-3">
            <div className="flex items-center gap-2">
              <ReceiptText size={18} className="text-tw-blue" />
              <h3 className="font-bold text-sm text-tw-navy">{en ? 'Add purchase' : 'إضافة شراء'}</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder={en ? 'Invoice no. (required)' : 'رقم الفاتورة (إلزامي)'}
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(toLatinDigits(e.target.value))}
                className={inputCls}
              />
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder={en ? 'Amount (SAR)' : 'المبلغ (ريال)'}
                value={amount}
                onChange={(e) => setAmount(toLatinDigits(e.target.value))}
                className={inputCls}
              />
            </div>
            {/* المكتسب قبل التأكيد — بنسبة فئة العميل الحالية */}
            {earnPreview != null && earnPreview >= 0 && (
              <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl p-2.5">
                {en
                  ? `Will earn: SAR ${halalasToRiyalLabel(earnPreview)} (${ratePercent}%)`
                  : `سيكسب: ${halalasToRiyalLabel(earnPreview)} ريال (نسبة ${ratePercent}%)`}
              </p>
            )}
            {earnError && <p className="text-xs font-bold text-tw-red">{earnError}</p>}
            <button
              type="button"
              onClick={handleEarn}
              disabled={earnBusy || member.status === 'disabled'}
              className="w-full py-3 rounded-xl bg-tw-blue text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {earnBusy && <Loader2 size={16} className="animate-spin" />}
              {earnBusy ? (en ? 'Saving…' : 'جارٍ الحفظ…') : (en ? 'Add credit' : 'إضافة الرصيد')}
            </button>
          </div>

          {/* ===== خصم من الرصيد ===== */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-tw-line space-y-3">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-tw-blue" />
              <h3 className="font-bold text-sm text-tw-navy">{en ? 'Redeem balance' : 'خصم من الرصيد'}</h3>
            </div>
            {negativeBalance ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle size={16} className="text-tw-red flex-shrink-0" />
                <p className="text-xs font-bold text-tw-red">
                  {en
                    ? 'Balance is negative — redemption is disabled until the balance is settled.'
                    : 'الرصيد سالب — الخصم معطّل حتى تسوية الرصيد.'}
                </p>
              </div>
            ) : (
              <>
                {/* الخصم بطلب العميل فقط — لا يُطبَّق تلقائياً */}
                <p className="text-[11px] text-tw-muted font-semibold">
                  {en
                    ? `Available: SAR ${halalasToRiyalLabel(available)} — deducted only at the customer's request, in multiples of SAR ${halalasToRiyalLabel(redeemStep)}.`
                    : `المتاح: ${halalasToRiyalLabel(available)} ريال — يُخصم بطلب العميل فقط، بمضاعفات ${halalasToRiyalLabel(redeemStep)} ريال.`}
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step={redeemStep / 100}
                    placeholder={en ? 'Amount (SAR)' : 'المبلغ (ريال)'}
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(toLatinDigits(e.target.value))}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setRedeemAmount(halalasToRiyalLabel(available).replace(/,/g, ''))}
                    disabled={available <= 0}
                    className="px-3 rounded-xl bg-white border border-tw-line text-tw-blue text-xs font-bold hover:bg-tw-soft disabled:opacity-50 flex-shrink-0"
                  >
                    {en ? 'Full balance' : 'الرصيد كاملًا'}
                  </button>
                </div>
                {redeemError && <p className="text-xs font-bold text-tw-red">{redeemError}</p>}
                <button
                  type="button"
                  onClick={handleRedeemRequest}
                  disabled={member.status === 'disabled' || available <= 0}
                  className="w-full py-3 rounded-xl bg-tw-navy text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {en ? 'Redeem' : 'خصم من الرصيد'}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* تأكيد الخصم */}
      <LoyaltyConfirmSheet
        open={!!confirmRedeem}
        variant="redeem"
        lang={lang}
        title={en ? 'Confirm redemption?' : 'تأكيد الخصم؟'}
        message={confirmRedeem
          ? (en
              ? `SAR ${halalasToRiyalLabel(confirmRedeem.halalas)} will be deducted from the balance`
              : `سيتم خصم ${halalasToRiyalLabel(confirmRedeem.halalas)} ريال من الرصيد`)
          : ''}
        confirmLabel={en ? 'Redeem' : 'خصم'}
        onConfirm={handleRedeem}
        onClose={() => setConfirmRedeem(null)}
      />

      {/* شيت مسح QR — يُركَّب عند الفتح فقط؛ الكاميرا تتوقف حتماً عند unmount */}
      {showScan && (
        <QrScanSheet
          lang={lang}
          onResult={handleScanResult}
          onClose={() => setShowScan(false)}
        />
      )}
    </div>
  );
}
