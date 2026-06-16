// src/firebaseCache.js
// ============================================================
// Batch 45 / S1: Cache Invalidation Helper (مُستخرج من firebase.js)
// يُستدعى من دوال CRUD لمسح cache الاستعلامات المتأثرة.
// يعمل عبر sessionStorage (نفس آلية useCachedQuery).
//
// ملاحظة: قيم البادئات يجب أن تطابق useCachedQuery.js حرفياً
//   CACHE_PREFIX = 'tw_cache_'  /  VERSION_PREFIX = 'tw_cache_v_'
// ============================================================
const CACHE_PREFIX = 'tw_cache_';
const VERSION_PREFIX = 'tw_cache_v_';

export function invalidateCachePrefix(prefix) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const fullPrefix = CACHE_PREFIX + prefix;
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    // version token: يجبر useCachedQuery على re-fetch حتى لو cache لا يزال موجوداً في الذاكرة
    const versionKey = VERSION_PREFIX + prefix;
    const currentV = Number(sessionStorage.getItem(versionKey) || '0');
    sessionStorage.setItem(versionKey, String(currentV + 1));
  } catch { /* ignore */ }
}
