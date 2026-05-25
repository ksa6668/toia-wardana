// src/components/ReviewsExplain.jsx
// ----------------------------------------------------------
// Batch 46.9: شاشة شرح نسبة تحقيق تقييمات قوقل ماب للموظف
// ----------------------------------------------------------
import { Star, Calculator, Lightbulb, Info } from 'lucide-react';
import { useScreenHeader } from '../App';

export default function ReviewsExplain({ onBack, lang = 'ar' }) {
  useScreenHeader(
    lang === 'en' ? 'Google Reviews Target' : 'تقييمات قوقل ماب',
    onBack
  );

  const t = (ar, en) => (lang === 'en' ? en : ar);

  return (
    <div
      className="relative min-h-full px-4 pt-4 pb-8 overflow-y-auto page-bg-soft"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      {/* ===== ما هي النسبة ===== */}
      <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-tw-orange flex items-center justify-center">
            <Star size={18} />
          </div>
          <h3 className="text-sm font-bold text-tw-navy">
            {t('ما هي هذه النسبة؟', 'What is this percentage?')}
          </h3>
        </div>
        <p className="text-xs text-tw-muted leading-relaxed">
          {t(
            'النسبة تقيس كم وصلت من هدف التقييمات الشهري في قوقل ماب. كل ما زاد عدد العملاء اللي قيّموا الفرع، كل ما ارتفعت النسبة وقربت من 100%.',
            'This percentage measures how close you are to the monthly Google Maps review target. The more customers who review the branch, the higher the percentage gets toward 100%.'
          )}
        </p>
      </div>

      {/* ===== كيف تُحسب ===== */}
      <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-tw-soft text-tw-blue flex items-center justify-center">
            <Calculator size={18} />
          </div>
          <h3 className="text-sm font-bold text-tw-navy">
            {t('كيف تُحسب؟', 'How is it calculated?')}
          </h3>
        </div>
        <div
          className="rounded-xl p-3 text-white"
          style={{
            background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
          }}
        >
          <div className="text-center" dir="ltr">
            <p className="text-[11px] opacity-80 mb-1">
              {t('عدد التقييمات المُحقّقة', 'Reviews achieved')}
            </p>
            <div className="border-b-2 border-white/40 mx-6 my-1.5"></div>
            <p className="text-[11px] opacity-80 mb-2">
              {t('هدف التقييمات الشهري', 'Monthly review target')}
            </p>
            <p className="text-base font-extrabold">× 100</p>
          </div>
        </div>
      </div>

      {/* ===== مثال عملي ===== */}
      <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-tw-green flex items-center justify-center">
            <Info size={18} />
          </div>
          <h3 className="text-sm font-bold text-tw-navy">
            {t('مثال عملي', 'Real example')}
          </h3>
        </div>
        <div className="bg-tw-soft/40 border border-tw-line rounded-xl p-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-tw-muted">{t('هدف الشهر:', 'Monthly target:')}</span>
            <span className="font-bold text-tw-navy">{t('30 تقييم', '30 reviews')}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-tw-muted">{t('التقييمات اللي وصلت:', 'Reviews received:')}</span>
            <span className="font-bold text-tw-navy">{t('8 تقييمات', '8 reviews')}</span>
          </div>
          <div className="border-t border-tw-line/60 pt-2 mt-2">
            <div className="flex justify-between text-xs">
              <span className="text-tw-muted">{t('الحسبة:', 'Calculation:')}</span>
              <span className="font-bold text-tw-navy" dir="ltr">(8 ÷ 30) × 100</span>
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-tw-navy font-bold">{t('النسبة', 'Percentage')}</span>
              <span className="font-extrabold text-tw-blue text-lg">27%</span>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-tw-muted mt-2 leading-relaxed">
          {t(
            'يعني وصلت لربع الهدف تقريباً، باقي 22 تقييم لإكمال الشهر.',
            'You reached about a quarter of the goal — 22 more reviews to complete the month.'
          )}
        </p>
      </div>

      {/* ===== كيف توصل للهدف ===== */}
      <div className="bg-white rounded-2xl border border-tw-line shadow-sm p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-tw-soft text-tw-blue flex items-center justify-center">
            <Lightbulb size={18} />
          </div>
          <h3 className="text-sm font-bold text-tw-navy">
            {t('كيف توصل للهدف؟', 'How to reach the goal?')}
          </h3>
        </div>
        <ul className="space-y-2.5">
          {[
            t(
              'اطلب التقييم من كل عميل راضي — خاصة بعد تجربة إيجابية',
              'Ask every satisfied customer for a review — especially after a great experience'
            ),
            t(
              'جهّز رابط التقييم لعملاء المتجر والواتساب — رمز QR للمتجر ورابط مباشر للواتساب',
              'Prepare the review link for in-store and WhatsApp customers — QR code in-store, direct link via WhatsApp'
            ),
            t(
              'اختر التوقيت المناسب — لحظة الاستلام والفرح بالورد',
              'Pick the right moment — when they receive and admire the flowers'
            ),
            t(
              'اشكره بابتسامة — التقييم الإيجابي يجي مع المشاعر الإيجابية',
              'Thank them with a smile — positive reviews come with positive feelings'
            ),
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-tw-blue text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-xs text-tw-navy leading-relaxed pt-0.5">{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ===== ملاحظة ===== */}
      <div
        className="rounded-xl p-3 border border-amber-200"
        style={{ background: 'rgba(255, 217, 128, 0.15)' }}
      >
        <div className="flex items-start gap-2">
          <Info size={14} className="text-tw-orange flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-tw-navy leading-relaxed">
            {t(
              'عدد التقييمات يُسجّله المدير من شاشة الرئيسية. كلّم المدير لو وصل تقييم جديد ولم يُسجّل بعد.',
              'The manager records review counts from the home screen. Inform the manager if new reviews arrive but are not yet recorded.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
