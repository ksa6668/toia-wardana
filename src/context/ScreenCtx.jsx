// src/context/ScreenCtx.jsx
// ----------------------------------------------------------
// Batch 18: Context للهيدر — تنشره الشاشات الفرعية لإظهار العنوان وزر العودة.
// مُستخرَج من App.jsx لكسر الاقتران الدائري (الشاشات كانت تستورد
// useScreenHeader من App بينما App يستورد تلك الشاشات).
// ----------------------------------------------------------
import { createContext, useContext, useEffect, useRef } from 'react';

export const ScreenCtxContext = createContext({ setScreenCtx: () => {} });

/**
 * Hook لاستخدامه في أي شاشة فرعية:
 *   useScreenHeader('عنوان الشاشة', () => onBackHandler);
 * عند unmount: يُمسح تلقائياً.
 *
 * Batch 41: نعتمد على title فقط في deps (onBack دالة جديدة كل render)
 * لكن نُسجّل أحدث onBack دائماً عبر ref لتجنّب stale closures.
 */
export function useScreenHeader(title, onBack) {
  const { setScreenCtx } = useContext(ScreenCtxContext);
  // نحتفظ بـ ref للـ onBack حتى نقدر نمرّر أحدث نسخة دائماً
  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; }, [onBack]);

  useEffect(() => {
    if (title) {
      setScreenCtx({
        title,
        onBack: () => onBackRef.current && onBackRef.current(),
      });
    }
    return () => setScreenCtx(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
}
