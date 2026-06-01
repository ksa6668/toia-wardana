// src/components/WhatsappExplain.jsx
// ----------------------------------------------------------
// Batch 46.9: شاشة شرح نسبة تحقيق مبيعات واتساب للموظف
// ----------------------------------------------------------
import { MessageCircle, Calculator, Lightbulb, Info, Target } from 'lucide-react';
import { useScreenHeader } from '../context/ScreenCtx';

export default function WhatsappExplain({ onBack, lang = 'ar' }) {
  useScreenHeader(
    lang === 'en' ? 'WhatsApp Sales Target' : 'تحقيق مبيعات واتساب',
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
          <div className="w-9 h-9 rounded-xl bg-tw-soft text-tw-blue flex items-center justify-center">
            <MessageCircle size={18} />
          </div>
          <h3 className="text-sm font-bold text-tw-navy">
            {t('ما هي هذه النسبة؟', 'What is this percentage?')}
          </h3>
        </div>
        <p className="text-xs text-tw-muted leading-relaxed mb-2">
          {t(
            'النسبة تقيس مدى نجاحك في تحويل عملاء الواتساب إلى مشترين فعليين.',
            'This percentage measures how well you convert WhatsApp inquiries into actual buyers.'
          )}
        </p>
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 flex items-start gap-2">
          <Target size={14} className="text-tw-green flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-tw-navy leading-relaxed">
            {t(
              'الهدف الذهبي: 20% من اللي يكلّمونا في الواتساب يشترون فعلياً. لما توصل لـ 20% = حققت 100% من الهدف! 🎯',
              'Golden goal: 20% of WhatsApp inquiries become actual buyers. When you reach 20% = you achieved 100% of the goal! 🎯'
            )}
          </p>
        </div>
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

        {/* الخطوة 1 */}
        <p className="text-xs font-bold text-tw-muted mb-2">
          {t('الخطوة 1: نسبة الشراء الفعلية', 'Step 1: Actual purchase rate')}
        </p>
        <div
          className="rounded-xl p-3 text-white mb-3"
          style={{
            background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
          }}
        >
          <div className="text-center" dir="ltr">
            <p className="text-[11px] opacity-80 mb-1">
              {t('عدد المشترين فعلياً', 'Actual buyers')}
            </p>
            <div className="border-b-2 border-white/40 mx-6 my-1.5"></div>
            <p className="text-[11px] opacity-80 mb-2">
              {t('عدد عملاء الواتساب', 'WhatsApp customers')}
            </p>
            <p className="text-base font-extrabold">× 100</p>
          </div>
        </div>

        {/* الخطوة 2 */}
        <p className="text-xs font-bold text-tw-muted mb-2">
          {t('الخطوة 2: نسبة التحقيق من الهدف', 'Step 2: Goal achievement rate')}
        </p>
        <div
          className="rounded-xl p-3 text-white"
          style={{
            background: 'linear-gradient(145deg, #061742 0%, #082765 65%, #005BFF 100%)',
          }}
        >
          <div className="text-center" dir="ltr">
            <p className="text-[11px] opacity-80 mb-1">
              {t('النسبة الفعلية', 'Actual rate')}
            </p>
            <div className="border-b-2 border-white/40 mx-6 my-1.5"></div>
            <p className="text-[11px] opacity-80 mb-2">20%</p>
            <p className="text-base font-extrabold">× 100</p>
          </div>
        </div>

        <p className="text-[11px] text-tw-muted leading-relaxed mt-3 italic">
          💡 {t(
            'بمعنى مبسّط: كل ما زاد عدد العملاء اللي اشتروا فعلياً، كل ما زادت نسبة التحقيق.',
            'In simple terms: the more customers who actually buy, the higher the achievement rate.'
          )}
        </p>
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
            <span className="text-tw-muted">
              {t('عملاء الواتساب اليوم:', "Today's WhatsApp customers:")}
            </span>
            <span className="font-bold text-tw-navy">{t('10 عملاء', '10 customers')}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-tw-muted">
              {t('اللي اشتروا فعلياً:', 'Actual buyers:')}
            </span>
            <span className="font-bold text-tw-navy">{t('2 عميل', '2 customers')}</span>
          </div>
          <div className="border-t border-tw-line/60 pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-tw-muted">{t('النسبة الفعلية:', 'Actual rate:')}</span>
              <span className="font-bold text-tw-navy" dir="ltr">(2 ÷ 10) × 100 = 20%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tw-muted">{t('نسبة التحقيق:', 'Achievement:')}</span>
              <span className="font-bold text-tw-navy" dir="ltr">(20 ÷ 20) × 100</span>
            </div>
            <div className="flex justify-between mt-1.5 pt-1.5 border-t border-tw-line/60">
              <span className="text-tw-navy font-bold">{t('النتيجة', 'Result')}</span>
              <span className="font-extrabold text-tw-green text-lg">100% 🎯</span>
            </div>
          </div>
        </div>
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
              'رد بسرعة على رسائل الواتساب — العميل اللي ينتظر يضيع',
              'Reply quickly to WhatsApp messages — a waiting customer is a lost one'
            ),
            t(
              'استخدم صور واضحة وجذابة للورد — العين تشتري قبل القلب',
              'Use clear, attractive flower photos — the eye buys before the heart'
            ),
            t(
              'اقترح خيارات تناسب ميزانية العميل — قدّم بدائل',
              'Suggest options that fit the customer\'s budget — offer alternatives'
            ),
            t(
              'اعرض العروض والخصومات — قدّمها بشكل مغري',
              'Present offers and discounts attractively'
            ),
            t(
              'متابعة بسيطة بعد فترة — "هل قررت اللي يعجبك؟"',
              'A simple follow-up later — "Did you decide what you like?"'
            ),
            t(
              'اطلب رأيه قبل ما يقفل المحادثة — لو ما اشترى، اعرف السبب',
              'Ask for feedback before closing the chat — if no purchase, find out why'
            ),
            t(
              'احفظ أرقام العملاء وادعهم لمتابعة حالة الواتساب — حتى لو ما اشتروا اليوم، رح يشوفون عروضنا الجديدة',
              'Save customer numbers and invite them to follow our WhatsApp status — even non-buyers will see new offers'
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
          <div className="text-[11px] text-tw-navy leading-relaxed space-y-1">
            <p>
              <b>{t('عدد عملاء الواتساب:', 'WhatsApp customers:')}</b>{' '}
              {t('كل شخص كلّمنا في الواتساب اليوم.', 'Every person who messaged us today.')}
            </p>
            <p>
              <b>{t('عدد المشترين:', 'Buyers:')}</b>{' '}
              {t('من هؤلاء، كم واحد طلب فعلياً واشترى.', 'Of those, how many actually ordered and bought.')}
            </p>
            <p className="text-tw-muted mt-1.5">
              {t(
                'يتم التسجيل اليومي من شاشة "تسجيل عملاء واتساب".',
                'Daily entries are recorded from "WhatsApp customers" screen.'
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
