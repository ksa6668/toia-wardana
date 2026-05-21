// src/components/SarSymbol.jsx
// ----------------------------------------------------------
// رمز الريال السعودي الرسمي الجديد (إصدار SAMA فبراير 2025)
// SVG inline لا يعتمد على خطوط خارجية = يعمل في كل المتصفحات.
//
// الاستخدام:
//   <SarSymbol />                       حجم افتراضي (1em)
//   <SarSymbol className="w-5 h-5" />   حجم مخصص (Tailwind)
//   <SarSymbol style={{color:'#fff'}}/> لون مخصص (يرث currentColor)
//
// التصميم: أربعة paths من Lucide مبنية على تصميم SAMA الرسمي.
// الـ stroke يتبع currentColor، فلون الرمز = لون النص حواليه.
// ----------------------------------------------------------
export default function SarSymbol({ className = '', style = {}, size }) {
  // size اختياري — لو ما تم تمريره نستخدم 1em ليتبع حجم الخط حوله
  const dimension = size ? { width: size, height: size } : { width: '1em', height: '1em' };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block align-[-0.15em] flex-shrink-0 ${className}`}
      style={{ ...dimension, ...style }}
      aria-label="ريال سعودي"
      role="img"
    >
      <path d="M14 4v11.22a1 1 0 0 0 1.242.97L20 15" />
      <path d="m2.978 19.351 5.549-1.363A2 2 0 0 0 10 16V2" />
      <path d="M20 11 4 15" />
      <path d="m20 19-5.5 1.5" />
    </svg>
  );
}
