// src/hooks/useCachedQuery.test.js
// ====================================================================
// اختبارات Batch 91.2 — قرار استراتيجية الكاش (resolveCacheStrategy):
// الحالات الثلاث (بلا كاش / كاش أحدث من TTL / كاش أقدم من TTL)
// مع freshWhenStale مفعّلاً ومعطّلاً.
//
// ملاحظة: بيئة الاختبار node بلا DOM (لا jsdom في المشروع) — لذلك
// استُخرج القرار كدالة نقية يستخدمها الـ hook في موضعي البدء والـ effect،
// وتُختبر هنا مباشرة. + اختبار invalidateCache على sessionStorage بديلة.
// ====================================================================
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCacheStrategy, invalidateCache } from './useCachedQuery';

const TTL = 60 * 1000;

describe('resolveCacheStrategy — المصفوفة الكاملة 3×2', () => {
  describe('freshWhenStale معطّل (الافتراضي — سلوك كل الشاشات القائمة)', () => {
    it('بلا كاش → no-cache (جلب مع loading)', () => {
      expect(resolveCacheStrategy({ hasCache: false, ageMs: Infinity, ttl: TTL, freshWhenStale: false }))
        .toBe('no-cache');
    });
    it('كاش أحدث من TTL → fresh (عرض فوري بلا جلب)', () => {
      expect(resolveCacheStrategy({ hasCache: true, ageMs: 10_000, ttl: TTL, freshWhenStale: false }))
        .toBe('fresh');
    });
    it('كاش أقدم من TTL → stale-swr (عرض القديم + تجديد صامت — السلوك التاريخي)', () => {
      expect(resolveCacheStrategy({ hasCache: true, ageMs: TTL + 1, ttl: TTL, freshWhenStale: false }))
        .toBe('stale-swr');
    });
  });

  describe('freshWhenStale مفعّل (إحصائيات الولاء)', () => {
    it('بلا كاش → no-cache — لا فرق', () => {
      expect(resolveCacheStrategy({ hasCache: false, ageMs: Infinity, ttl: TTL, freshWhenStale: true }))
        .toBe('no-cache');
    });
    it('كاش أحدث من TTL → fresh — لا فرق (فائدة الكاش باقية)', () => {
      expect(resolveCacheStrategy({ hasCache: true, ageMs: 10_000, ttl: TTL, freshWhenStale: true }))
        .toBe('fresh');
    });
    it('كاش أقدم من TTL → stale-wait (loading — اللقطة القديمة لا تُعرض إطلاقاً)', () => {
      expect(resolveCacheStrategy({ hasCache: true, ageMs: TTL + 1, ttl: TTL, freshWhenStale: true }))
        .toBe('stale-wait');
    });
  });

  it('حدود TTL: أقل منه بواحدة fresh، ويساويه stale', () => {
    expect(resolveCacheStrategy({ hasCache: true, ageMs: TTL - 1, ttl: TTL, freshWhenStale: true })).toBe('fresh');
    expect(resolveCacheStrategy({ hasCache: true, ageMs: TTL, ttl: TTL, freshWhenStale: true })).toBe('stale-wait');
    expect(resolveCacheStrategy({ hasCache: true, ageMs: TTL, ttl: TTL, freshWhenStale: false })).toBe('stale-swr');
  });
});

describe('invalidateCache — مسح المفاتيح ورفع version token', () => {
  // sessionStorage بديلة لبيئة node (نفس واجهة Web Storage المستخدمة في الـ hook)
  beforeEach(() => {
    const store = new Map();
    globalThis.sessionStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      key: (i) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    };
  });

  it('يمسح مفاتيح البادئة ويرفع الإصدار (ما يجبر إعادة الجلب بعد كتابة محلية)', () => {
    sessionStorage.setItem('tw_cache_loyalty:txs:toia', JSON.stringify({ timestamp: 1, data: [] }));
    sessionStorage.setItem('tw_cache_sales:toia', JSON.stringify({ timestamp: 1, data: [] }));
    invalidateCache('loyalty');
    expect(sessionStorage.getItem('tw_cache_loyalty:txs:toia')).toBe(null);
    expect(sessionStorage.getItem('tw_cache_sales:toia')).not.toBe(null); // بادئة أخرى لا تُمس
    expect(sessionStorage.getItem('tw_cache_v_loyalty')).toBe('1');
    invalidateCache('loyalty');
    expect(sessionStorage.getItem('tw_cache_v_loyalty')).toBe('2');
  });
});
