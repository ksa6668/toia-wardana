// src/hooks/usePersistedState.js
// ===================================================================
// Batch 45: useState مع حفظ في sessionStorage
//
// يحفظ القيمة تلقائياً بمفتاح فريد. عند إعادة mount الـ component
// (مثلاً الرجوع للشاشة بعد التنقل)، تُسترجع آخر قيمة محفوظة.
//
// المدة: خلال جلسة المتصفح فقط (sessionStorage).
// عند إغلاق التبويب، البيانات تُحذف.
//
// الاستخدام:
//   const [period, setPeriod] = usePersistedState('home.period', 'month');
// ===================================================================

import { useState, useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'tw_state_';

export function usePersistedState(key, defaultValue) {
  const storageKey = STORAGE_PREFIX + key;

  // عند mount: استرجع القيمة من sessionStorage
  const [value, setValue] = useState(() => {
    // احسب الـ default الفعلي (لو function، ناديها)
    const actualDefault = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw === null || raw === 'undefined' || raw === 'null') return actualDefault;
      const parsed = JSON.parse(raw);
      // تحقق: parsed ليس null/undefined لو الـ default محدد
      if ((parsed === null || parsed === undefined) && actualDefault !== null && actualDefault !== undefined) {
        try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
        return actualDefault;
      }
      // تحقق توافق النوع - لو الـ stored value نوع مختلف عن default، نعود لـ default
      // (مثلاً لو default رقم لكن stored = string بسبب bug سابق)
      if (typeof parsed !== typeof actualDefault) {
        try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
        return actualDefault;
      }
      return parsed;
    } catch {
      // قيمة تالفة - امسحها واستخدم default
      try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
      return actualDefault;
    }
  });

  // عند كل تغيير: احفظ في sessionStorage
  // نستخدم useRef لتجنّب الكتابة الأولى (لو لم تتغيّر)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // لا نحفظ قيم تالفة (undefined أو function)
    if (value === undefined || typeof value === 'function') return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // sessionStorage ممتلئ أو غير متاح
    }
  }, [storageKey, value]);

  return [value, setValue];
}

// مسح كل state محفوظ (مفيد عند تسجيل الخروج)
export function clearAllPersistedState() {
  try {
    const keys = Object.keys(sessionStorage);
    for (const k of keys) {
      if (k.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
