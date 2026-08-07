// اختبارات toLatinDigits — Batch 94
import { describe, it, expect } from 'vitest';
import { toLatinDigits } from './digits';

describe('toLatinDigits', () => {
  it('يحوّل الأرقام العربية-الهندية كاملة', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('يحوّل الأرقام الفارسية كاملة', () => {
    expect(toLatinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  it('يحوّل نصاً مختلطاً ويُبقي غير الأرقام كما هو', () => {
    expect(toLatinDigits('فاتورة ١٢۳4')).toBe('فاتورة 1234');
    expect(toLatinDigits('٠٥٠-١٢٣ ٤٥٦٧')).toBe('050-123 4567');
  });

  it('يُعيد نصاً بلا أرقام هندية مطابقاً', () => {
    expect(toLatinDigits('hello مرحبا 123')).toBe('hello مرحبا 123');
    expect(toLatinDigits('')).toBe('');
  });

  it('يُعيد القيم غير النصية كما هي بأمان', () => {
    expect(toLatinDigits(null)).toBe(null);
    expect(toLatinDigits(undefined)).toBe(undefined);
    expect(toLatinDigits(123)).toBe(123);
    const obj = { a: 1 };
    expect(toLatinDigits(obj)).toBe(obj);
  });
});
