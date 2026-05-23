// src/components/PageTransition.jsx
// ----------------------------------------------------------
// Batch 26: غلاف انتقال بين الصفحات — fade + scale خفيف
// يحوّط أي محتوى ويُفعّل التلاشي عند تغيّر الـ key
//
// الاستخدام:
//   <PageTransition pageKey={currentView}>
//     <SomeScreen />
//   </PageTransition>
//
// لا يستخدم framer-motion (يعتمد CSS animations فقط — أخف وأسرع)
// ----------------------------------------------------------
import { useEffect, useState } from 'react';

export default function PageTransition({ pageKey, children, duration = 220 }) {
  const [renderKey, setRenderKey] = useState(pageKey);
  const [animClass, setAnimClass] = useState('tw-page-enter');

  useEffect(() => {
    if (pageKey === renderKey) return;
    // مرحلة الخروج
    setAnimClass('tw-page-exit');
    const t1 = setTimeout(() => {
      setRenderKey(pageKey);
      setAnimClass('tw-page-enter');
    }, duration);
    return () => clearTimeout(t1);
  }, [pageKey, renderKey, duration]);

  return (
    <div
      key={renderKey}
      className={animClass}
      style={{ width: '100%', minHeight: '100%' }}
    >
      {children}
    </div>
  );
}
