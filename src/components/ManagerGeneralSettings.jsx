// src/components/ManagerGeneralSettings.jsx
// ----------------------------------------------------------
// الإعدادات العامة — مطابقة لتصميم prototype:
//   - اللغة (عربية/إنجليزية)
//   - العملة (الريال السعودي)
//   - نظام التاريخ (ميلادي/هجري)
//   - اسم النشاط
//   - رقم التواصل
//   - معلومات التطبيق (للقراءة فقط)
//   - منطقة خطرة: زر إعادة تعيين (معطّل حالياً لحماية الإنتاج)
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  Settings as Gear, Calendar, CheckCircle2, Loader2,
  AlertTriangle, Trash2,
} from 'lucide-react';
import { getAppSettings, setAppSettings, resetAllData } from '../firebase';
import BottomSheet from './BottomSheet';
import DeleteConfirmSheet from './DeleteConfirmSheet';
import SarSymbol from './SarSymbol';
import { useScreenHeader } from '../context/ScreenCtx';

const APP_VERSION = '1.0.0';
const APP_BUILD = '2026.05';

export default function ManagerGeneralSettings({ onBack, lang = 'ar' }) {
  useScreenHeader(lang === 'en' ? 'General Settings' : 'الإعدادات العامة', onBack);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // الإعدادات
  const [businessName, setBusinessName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [defaultLang, setDefaultLang] = useState('ar');
  const [currency, setCurrency] = useState('SAR');
  const [dateSystem, setDateSystem] = useState('gregorian');
  // للقائمة المنبثقة
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getAppSettings();
        if (cancelled) return;
        setBusinessName(s.businessName || 'Toia & Wardana');
        setContactPhone(s.contactPhone || '');
        setDefaultLang(s.defaultLang || 'ar');
        setCurrency(s.currency || 'SAR');
        setDateSystem(s.dateSystem || 'gregorian');
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل الإعدادات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await setAppSettings({ businessName, contactPhone, defaultLang, currency, dateSystem });
      // حفظ اللغة في localStorage عشان تُطبَّق فوراً عند إعادة التحميل
      try {
        localStorage.setItem('tw-lang', defaultLang);
        localStorage.setItem('tw-currency', currency);
        localStorage.setItem('tw-dateSystem', dateSystem);
      } catch { /* ignore */ }
      setDone(true);
      // إعادة تحميل الصفحة بعد ثانية ليطبّق التغييرات (اللغة/الاتجاه)
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      setError(err?.message || 'تعذّر حفظ الإعدادات');
      setSaving(false);
    }
  };

  // النصوص حسب القيمة المختارة
  const langLabel = defaultLang === 'ar' ? 'العربية' : 'English';
  const currencyLabel = lang === 'en' ? `${currency} - Saudi Riyal` : 'ريال سعودي';
  const dateSystemLabel = dateSystem === 'gregorian'
    ? (lang === 'en' ? 'Gregorian' : 'ميلادي')
    : (lang === 'en' ? 'Hijri' : 'هجري');

  const openLangPicker = () => setSheet({
    title: lang === 'en' ? 'Default Language' : 'اللغة الافتراضية',
    options: [
      { value: 'ar', label: 'العربية' },
      { value: 'en', label: 'English' },
    ],
    current: defaultLang,
    onPick: (v) => { setDefaultLang(v); setSheet(null); },
  });

  const openCurrencyPicker = () => setSheet({
    title: lang === 'en' ? 'Currency' : 'العملة',
    options: [
      { value: 'SAR', label: lang === 'en' ? 'SAR - Saudi Riyal' : 'ريال سعودي - SAR' },
    ],
    current: currency,
    onPick: (v) => { setCurrency(v); setSheet(null); },
  });

  const openDateSystemPicker = () => setSheet({
    title: lang === 'en' ? 'Date System' : 'نظام التاريخ',
    options: [
      { value: 'gregorian', label: lang === 'en' ? 'Gregorian' : 'ميلادي' },
      { value: 'hijri', label: lang === 'en' ? 'Hijri' : 'هجري' },
    ],
    current: dateSystem,
    onPick: (v) => { setDateSystem(v); setSheet(null); },
  });

  // الزر الخطر — يمسح المبيعات والمصاريف والأهداف
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState('');

  const handleResetConfirm = async () => {
    setResetResult('');
    try {
      const { totalDeleted } = await resetAllData({ alsoGoals: true, alsoFixed: false });
      setResetResult(
        lang === 'en'
          ? `Deleted ${totalDeleted} records successfully`
          : `تم حذف ${totalDeleted} سجلاً بنجاح`
      );
      setTimeout(() => setResetResult(''), 3500);
    } catch (err) {
      setResetResult(err?.message || (lang === 'en' ? 'Reset failed' : 'تعذّرت العملية'));
    }
  };

  return (
    <div
      className="min-h-full relative overflow-hidden"
      style={{
        background: 'transparent',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* شريط العنوان */}
      <div className="hidden">
        <h2>{lang === 'en' ? 'General Settings' : 'الإعدادات العامة'}</h2>
      </div>

      {/* وصف القسم */}
      <div className="relative z-10 px-4 pt-4 pb-2">
        <p className="text-xs text-tw-muted text-center">
          {lang === 'en'
            ? 'Language, currency, date system, business name'
            : 'اللغة، العملة، نظام التاريخ، اسم النشاط'}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-tw-muted/70">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {!loading && (
        <div className="relative z-10 px-4 pb-8 space-y-5">
          {/* اللغة */}
          <div>
            <h4 className="text-sm font-bold text-tw-navy mb-2">{lang === 'en' ? 'Language' : 'اللغة'}</h4>
            <button
              onClick={openLangPicker}
              className="w-full flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <Gear size={16} className="text-tw-blue" />
              <span className="font-bold text-sm text-tw-navy">{langLabel}</span>
            </button>
          </div>

          {/* العملة */}
          <div>
            <h4 className="text-sm font-bold text-tw-navy mb-1">{lang === 'en' ? 'Currency' : 'العملة'}</h4>
            <p className="text-xs text-tw-muted mb-2">
              {lang === 'en' ? 'Applied to all amounts in the app.' : 'تُطبَّق على جميع المبالغ في التطبيق.'}
            </p>
            <button
              onClick={openCurrencyPicker}
              className="w-full flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <Gear size={16} className="text-tw-blue" />
              <span className="font-bold text-sm text-tw-navy">{currencyLabel}</span>
              <SarSymbol className="text-tw-blue text-sm" />
            </button>
          </div>

          {/* نظام التاريخ */}
          <div>
            <h4 className="text-sm font-bold text-tw-navy mb-2">{lang === 'en' ? 'Date System' : 'نظام التاريخ'}</h4>
            <button
              onClick={openDateSystemPicker}
              className="w-full flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <Calendar size={16} className="text-tw-blue" />
              <span className="font-bold text-sm text-tw-navy">{dateSystemLabel}</span>
            </button>
          </div>

          {/* فاصل */}
          <div className="border-t border-tw-line my-2" />

          {/* معلومات النشاط */}
          <div>
            <h4 className="text-sm font-bold text-tw-navy mb-3">{lang === 'en' ? 'Business Info' : 'معلومات النشاط'}</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-tw-muted mb-1.5 block">
                  {lang === 'en' ? 'Business name' : 'اسم النشاط'}
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Toia & Wardana"
                  className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm font-bold outline-none focus:border-tw-blue"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-tw-muted mb-1.5 block">
                  {lang === 'en' ? 'Contact number' : 'رقم التواصل'}
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+966 5XX XXX XXXX"
                  className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* زر الحفظ */}
          {done && (
            <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
              <CheckCircle2 size={18} /> {lang === 'en' ? 'Information saved' : 'تم حفظ المعلومات'}
            </p>
          )}
          {error && (
            <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
              {error}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
              boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
            }}
          >
            <Gear size={16} />
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving
              ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
              : (lang === 'en' ? 'Save Information' : 'حفظ المعلومات')}
          </button>

          {/* فاصل */}
          <div className="border-t border-tw-line my-4" />

          {/* معلومات التطبيق */}
          <div>
            <h4 className="text-sm font-bold text-tw-navy mb-3">{lang === 'en' ? 'App Info' : 'معلومات التطبيق'}</h4>
            <div className="bg-white rounded-2xl border border-tw-line overflow-hidden">
              <div className="p-3 flex items-center justify-between border-b border-tw-line/60">
                <span className="text-xs text-tw-muted">{lang === 'en' ? 'App Name' : 'اسم التطبيق'}</span>
                <span className="text-sm font-bold text-tw-navy">Toia & Wardana</span>
              </div>
              <div className="p-3 flex items-center justify-between border-b border-tw-line/60">
                <span className="text-xs text-tw-muted">{lang === 'en' ? 'Version' : 'الإصدار'}</span>
                <span className="text-sm font-bold text-tw-navy" dir="ltr">{APP_VERSION}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-xs text-tw-muted">{lang === 'en' ? 'Build' : 'رقم البناء'}</span>
                <span className="text-sm font-bold text-tw-navy" dir="ltr">{APP_BUILD}</span>
              </div>
            </div>
          </div>

          {/* فاصل */}
          <div className="border-t border-tw-line my-4" />

          {/* منطقة خطرة */}
          <div>
            <h4 className="text-sm font-bold text-tw-red mb-1 flex items-center gap-1.5">
              <AlertTriangle size={16} />
              {lang === 'en' ? 'Danger Zone' : 'منطقة خطرة'}
            </h4>
            <p className="text-xs text-tw-muted mb-3">
              {lang === 'en'
                ? 'Irreversible operation. Make sure you have a backup before proceeding.'
                : 'عملية لا يمكن التراجع عنها. تأكد من وجود نسخة احتياطية قبل المتابعة.'}
            </p>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full text-white font-bold py-3.5 rounded-xl bg-tw-red hover:bg-tw-red transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              {lang === 'en' ? 'Reset All Data' : 'إعادة تعيين جميع البيانات'}
            </button>
            {resetResult && (
              <p className="text-xs text-center mt-3 p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-tw-green font-bold">
                {resetResult}
              </p>
            )}
          </div>
        </div>
      )}

      <DeleteConfirmSheet
        open={showResetConfirm}
        title={lang === 'en' ? 'Delete all sales & expenses?' : 'مسح كل المبيعات والمصاريف والأهداف؟'}
        message={lang === 'en'
          ? 'This will permanently delete all sales, expenses and goals. Branches, users, categories and settings will be kept. This cannot be undone.'
          : 'سيتم حذف كل المبيعات والمصاريف والأهداف بشكل نهائي. الفروع والمستخدمون والتصنيفات والإعدادات ستبقى. لا يمكن التراجع عن هذا الإجراء.'}
        onConfirm={handleResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        lang={lang}
      />

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
