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
  ChevronRight, Globe, Settings as Gear, Calendar, CheckCircle2, Loader2,
  AlertTriangle, Trash2,
} from 'lucide-react';
import { getAppSettings, setAppSettings } from '../firebase';
import BottomSheet from './BottomSheet';
import SarSymbol from './SarSymbol';

const APP_VERSION = '1.0.0';
const APP_BUILD = '2026.05';

export default function ManagerGeneralSettings({ onBack, lang = 'ar' }) {
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
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (err) {
      setError(err?.message || 'تعذّر حفظ الإعدادات');
    } finally {
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

  // الزر الخطر — معطّل في الإنتاج
  const handleResetClick = () => {
    alert(
      lang === 'en'
        ? 'Reset is disabled in production. Contact developer to safely clear data.'
        : 'إعادة التعيين معطّلة في الإنتاج. تواصل مع المطوّر لمسح البيانات بأمان.'
    );
  };

  return (
    <div
      className="min-h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* شريط العنوان */}
      <div className="relative z-10 flex items-center p-4 border-b border-gray-100 bg-white/60 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="p-2 text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
        >
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-slate-800 px-8">
          {lang === 'en' ? 'General Settings' : 'الإعدادات العامة'}
        </h2>
      </div>

      {/* وصف القسم */}
      <div className="relative z-10 px-4 pt-4 pb-2">
        <p className="text-xs text-slate-500 text-center">
          {lang === 'en'
            ? 'Language, currency, date system, business name'
            : 'اللغة، العملة، نظام التاريخ، اسم النشاط'}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {!loading && (
        <div className="relative z-10 px-4 pb-8 space-y-5">
          {/* اللغة */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-2">{lang === 'en' ? 'Language' : 'اللغة'}</h4>
            <button
              onClick={openLangPicker}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <Gear size={16} className="text-blue-600" />
              <span className="font-bold text-sm text-slate-700">{langLabel}</span>
            </button>
          </div>

          {/* العملة */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">{lang === 'en' ? 'Currency' : 'العملة'}</h4>
            <p className="text-xs text-slate-500 mb-2">
              {lang === 'en' ? 'Applied to all amounts in the app.' : 'تُطبَّق على جميع المبالغ في التطبيق.'}
            </p>
            <button
              onClick={openCurrencyPicker}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <Gear size={16} className="text-blue-600" />
              <span className="font-bold text-sm text-slate-700">{currencyLabel}</span>
              <SarSymbol className="text-blue-600 text-sm" />
            </button>
          </div>

          {/* نظام التاريخ */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-2">{lang === 'en' ? 'Date System' : 'نظام التاريخ'}</h4>
            <button
              onClick={openDateSystemPicker}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <Calendar size={16} className="text-blue-600" />
              <span className="font-bold text-sm text-slate-700">{dateSystemLabel}</span>
            </button>
          </div>

          {/* فاصل */}
          <div className="border-t border-gray-100 my-2" />

          {/* معلومات النشاط */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-3">{lang === 'en' ? 'Business Info' : 'معلومات النشاط'}</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  {lang === 'en' ? 'Business name' : 'اسم النشاط'}
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Toia & Wardana"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1.5 block">
                  {lang === 'en' ? 'Contact number' : 'رقم التواصل'}
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+966 5XX XXX XXXX"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* زر الحفظ */}
          {done && (
            <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
              <CheckCircle2 size={18} /> {lang === 'en' ? 'Information saved' : 'تم حفظ المعلومات'}
            </p>
          )}
          {error && (
            <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
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
          <div className="border-t border-gray-100 my-4" />

          {/* معلومات التطبيق */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 mb-3">{lang === 'en' ? 'App Info' : 'معلومات التطبيق'}</h4>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="p-3 flex items-center justify-between border-b border-gray-50">
                <span className="text-xs text-gray-500">{lang === 'en' ? 'App Name' : 'اسم التطبيق'}</span>
                <span className="text-sm font-bold text-slate-800">Toia & Wardana</span>
              </div>
              <div className="p-3 flex items-center justify-between border-b border-gray-50">
                <span className="text-xs text-gray-500">{lang === 'en' ? 'Version' : 'الإصدار'}</span>
                <span className="text-sm font-bold text-slate-800" dir="ltr">{APP_VERSION}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">{lang === 'en' ? 'Build' : 'رقم البناء'}</span>
                <span className="text-sm font-bold text-slate-800" dir="ltr">{APP_BUILD}</span>
              </div>
            </div>
          </div>

          {/* فاصل */}
          <div className="border-t border-gray-100 my-4" />

          {/* منطقة خطرة */}
          <div>
            <h4 className="text-sm font-bold text-red-600 mb-1 flex items-center gap-1.5">
              <AlertTriangle size={16} />
              {lang === 'en' ? 'Danger Zone' : 'منطقة خطرة'}
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              {lang === 'en'
                ? 'Irreversible operation. Make sure you have a backup before proceeding.'
                : 'عملية لا يمكن التراجع عنها. تأكد من وجود نسخة احتياطية قبل المتابعة.'}
            </p>
            <button
              onClick={handleResetClick}
              className="w-full text-white font-bold py-3.5 rounded-xl bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              {lang === 'en' ? 'Reset All Data' : 'إعادة تعيين جميع البيانات'}
            </button>
          </div>
        </div>
      )}

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
