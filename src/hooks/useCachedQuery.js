// src/hooks/useCachedQuery.js
// ===================================================================
// Batch 45: استعلام مع cache (SWR - Stale While Revalidate)
//
// السلوك:
//   1. عند الطلب: ابحث في cache (sessionStorage)
//   2. لو موجود وعمره < TTL: استخدمه فوراً، لا انتظار
//   3. لو موجود وعمره > TTL: استخدمه فوراً + اطلب تحديث في الخلفية
//   4. لو غير موجود: اطلب من الـ fetcher (مع loading)
//
// Cache Invalidation:
//   - عند add/update/delete، استدعِ invalidateCache(prefix) لمسح المفاتيح
//
// الاستخدام:
//   const { data, loading, error, refresh } = useCachedQuery(
//     ['sales', branchId, month],  // مفتاح
//     () => getSales(from, to),     // الـ fetcher
//     { ttl: 30 * 1000 }            // 30 ثانية
//   );
// ===================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

const CACHE_PREFIX = 'tw_cache_';
const VERSION_PREFIX = 'tw_cache_v_'; // tokens لمسح الـ cache بانتقائية

// ----- Helpers لإدارة Cache -----

function getCacheKey(keyArray) {
  return CACHE_PREFIX + keyArray.join(':');
}

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp || !('data' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      timestamp: Date.now(),
      data,
    }));
  } catch {
    // sessionStorage ممتلئ → نمسح الأقدم
    cleanupOldestCache();
    try {
      sessionStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        data,
      }));
    } catch { /* استسلم */ }
  }
}

function cleanupOldestCache() {
  // مسح أقدم 5 مفاتيح cache لتحرير مساحة
  try {
    const entries = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        const v = readCache(k);
        if (v) entries.push({ key: k, ts: v.timestamp });
      }
    }
    entries.sort((a, b) => a.ts - b.ts);
    entries.slice(0, 5).forEach((e) => sessionStorage.removeItem(e.key));
  } catch { /* ignore */ }
}

// ----- Invalidation API -----

/**
 * يُلغي كل cache يطابق البادئة المُعطاة.
 * أمثلة:
 *   invalidateCache('sales')           - يلغي كل cache يبدأ بـ "sales"
 *   invalidateCache('sales:toia')      - يلغي cache فرع تويا فقط
 *   invalidateCache('sales:toia:2026-05') - يلغي شهر معيّن
 */
export function invalidateCache(prefix) {
  try {
    const fullPrefix = CACHE_PREFIX + prefix;
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));

    // زيادة version token (يجبر الاستعلامات على re-fetch حتى لو cache فيه قيمة)
    const versionKey = VERSION_PREFIX + prefix;
    const currentV = Number(sessionStorage.getItem(versionKey) || '0');
    sessionStorage.setItem(versionKey, String(currentV + 1));
  } catch { /* ignore */ }
}

/**
 * مسح كامل cache (مفيد عند logout)
 */
export function clearAllCache() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith(CACHE_PREFIX) || k.startsWith(VERSION_PREFIX))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ----- قرار استراتيجية الكاش (نقي — قابل للاختبار بـ vitest) -----

/**
 * Batch 91.2: يحدد تعامل الاستعلام مع حالة الكاش:
 *   'no-cache'   لا كاش → جلب مع loading
 *   'fresh'      كاش أحدث من TTL → يُعرض فوراً بلا جلب (بلا تغيير)
 *   'stale-swr'  كاش أقدم من TTL والخيار معطّل → يُعرض + تجديد صامت
 *                (السلوك التاريخي — افتراضي كل الشاشات القائمة)
 *   'stale-wait' كاش أقدم من TTL وfreshWhenStale مفعّل → loading وجلب
 *                غير صامت — اللقطة القديمة لا تُعرض إطلاقاً.
 *                السبب: الكتابة من جهاز آخر (مثل جوال الموظف) لا تصل
 *                إبطالاتها إلى sessionStorage هذا المتصفح، فتُعرض لقطة
 *                قديمة (أصفار) كأنها نتيجة نهائية ثم تُصحّح بصمت.
 */
export function resolveCacheStrategy({ hasCache, ageMs, ttl, freshWhenStale }) {
  if (!hasCache) return 'no-cache';
  if (ageMs < ttl) return 'fresh';
  return freshWhenStale ? 'stale-wait' : 'stale-swr';
}

// ----- الـ Hook الرئيسي -----

/**
 * @param {Array} keyArray - مفتاح فريد للاستعلام (مصفوفة)
 * @param {Function} fetcher - دالة async تُرجع البيانات
 * @param {Object} options
 * @param {number} options.ttl - مدة الـ cache بالـ milliseconds (افتراضي: 60 ثانية)
 * @param {boolean} options.enabled - هل نُشغّل الاستعلام؟ (افتراضي: true)
 * @param {*} options.defaultData - القيمة الأولية قبل وصول البيانات (افتراضي: null)
 * @param {boolean} options.freshWhenStale - Batch 91.2 (افتراضي false = السلوك
 *   التاريخي حرفياً): عند التفعيل، الكاش الأقدم من TTL يُعامل كتحميل
 *   (loading=true وجلب غير صامت) بدل عرض اللقطة القديمة وتصحيحها بصمت.
 *   للشاشات التي تعرض أرقاماً محسوبة يضللها القديم (إحصائيات الولاء).
 */
export function useCachedQuery(keyArray, fetcher, options = {}) {
  const { ttl = 60 * 1000, enabled = true, defaultData = null, freshWhenStale = false } = options;
  const cacheKey = getCacheKey(keyArray);
  // version token من البادئة الأولى (مثلاً 'sales')
  const versionPrefix = VERSION_PREFIX + keyArray[0];

  // محاولة قراءة من cache في البداية
  const cached = readCache(cacheKey);
  const initialStrategy = resolveCacheStrategy({
    hasCache: !!cached,
    ageMs: cached ? Date.now() - cached.timestamp : Infinity,
    ttl,
    freshWhenStale,
  });
  // stale-wait: لا تُعرض اللقطة القديمة حتى كقيمة أولية
  const initialData = cached && initialStrategy !== 'stale-wait' ? cached.data : defaultData;

  const [data, setData] = useState(initialData);
  // مطابق حرفياً للسلوك القديم عند freshWhenStale=false:
  // loading يبدأ true فقط بلا كاش (أو الآن: مع كاش قديم في وضع stale-wait)
  const [loading, setLoading] = useState(
    enabled ? (initialStrategy === 'no-cache' || initialStrategy === 'stale-wait') : false
  );
  const [error, setError] = useState('');

  // نحفظ آخر key للحماية من race conditions
  const lastKeyRef = useRef(cacheKey);
  // نحفظ آخر version token المرئي (لمعرفة لو حصل invalidation)
  const lastVersionRef = useRef(sessionStorage.getItem(versionPrefix) || '0');

  const doFetch = useCallback(async (silent = false) => {
    if (!enabled) return;
    const myKey = cacheKey;
    if (!silent) setLoading(true);
    setError('');
    try {
      const result = await fetcher();
      // تحقق لم نتغيّر للـ key أثناء الـ fetch
      if (lastKeyRef.current !== myKey) return;
      setData(result);
      writeCache(myKey, result);
      // حدّث version token المُلاحَظ
      lastVersionRef.current = sessionStorage.getItem(versionPrefix) || '0';
    } catch (err) {
      if (lastKeyRef.current !== myKey) return;
      setError(err?.message || 'تعذّر تحميل البيانات');
    } finally {
      if (lastKeyRef.current !== myKey) return;
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled, versionPrefix]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    lastKeyRef.current = cacheKey;

    // تحقق من version token - لو تغيّر، الـ cache مُلغى
    const currentVersion = sessionStorage.getItem(versionPrefix) || '0';
    const versionChanged = currentVersion !== lastVersionRef.current;
    lastVersionRef.current = currentVersion;

    const fresh = readCache(cacheKey);
    if (fresh && !versionChanged) {
      const strategy = resolveCacheStrategy({
        hasCache: true,
        ageMs: Date.now() - fresh.timestamp,
        ttl,
        freshWhenStale,
      });
      if (strategy === 'fresh') {
        // cache طازج → استخدمه ولا تجلب
        setData(fresh.data);
        setLoading(false);
        return;
      }
      if (strategy === 'stale-swr') {
        // cache قديم → اعرض القيم القديمة + جدّد في الخلفية (السلوك التاريخي)
        setData(fresh.data);
        setLoading(false);
        doFetch(true); // silent fetch
        return;
      }
      // stale-wait (Batch 91.2): جلب غير صامت — لا عرض للقطة القديمة
      doFetch(false);
      return;
    }
    // لا cache → اجلب طبيعياً
    doFetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  // دالة refresh يدوية (لو احتجناها)
  const refresh = useCallback(() => doFetch(false), [doFetch]);

  return { data, loading, error, refresh };
}
