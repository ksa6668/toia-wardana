// src/components/SheetPortal.jsx
// ----------------------------------------------------------
// Portal to render bottom sheets inside the phone-frame element (#tw-app-frame)
// regardless of where the sheet is invoked from in the component tree.
//
// لماذا؟
//   - الـ sheets الموجودة داخل مكوّنات عندها overflow:hidden كانت تُقصّ
//   - الـ sheets كانت تُحسب موضعها بالنسبة للـ wrapper الأقرب (مش phone-frame)
//   - الحل: نقل الـ sheet عبر portal إلى phone-frame مباشرة
//     → ينتمي بصرياً للـ phone-frame كاملاً
//     → يطلع فوق Bottom Nav بسلاسة
//     → ما يتأثر بـ overflow-hidden للمكوّنات الفرعية
// ----------------------------------------------------------
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function SheetPortal({ children }) {
  const [container, setContainer] = useState(null);

  useEffect(() => {
    // إيجاد الـ phone-frame؛ إن لم يوجد، fallback إلى document.body
    const el = document.getElementById('tw-app-frame') || document.body;
    setContainer(el);
  }, []);

  if (!container) return null;
  return createPortal(children, container);
}
