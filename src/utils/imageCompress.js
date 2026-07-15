// src/utils/imageCompress.js
// ====================================================================
// Batch 75: ضغط صور الفواتير في المتصفح قبل الرفع (مسار الرفع فقط).
//
// الهدف: صورة كاميرا حديثة (3-10MB) تصبح مئات الكيلوبايتات قبل إرسالها
// لـ /api/upload، فيسرع الرفع ويصغر كل ما يُعرض لاحقاً في شاشات الفواتير.
//
// الضمانات:
//   - الصور فقط — المتصل بها مسؤول عن استثناء PDF وغيره.
//   - لا تكبير: صورة ضلعها الأطول ≤ maxEdge تُعاد بنفس الأبعاد (تعاد ترميزها JPEG).
//   - لو خرج الناتج أكبر من الأصل (صورة مضغوطة أصلاً) نعيد الملف الأصلي كما هو.
//   - EXIF orientation: نطلب من المتصفح تطبيقه عند الفك
//     (createImageBitmap مع imageOrientation، و<img> يطبّقه افتراضياً في
//     المتصفحات الحديثة) — فلا تنقلب صور الكاميرا العمودية.
//   - أي فشل هنا يُرمى للمتصل — والمتصل يلتقطه ويرفع الملف الأصلي
//     (الرفع يجب ألا يفشل أبداً بسبب الضغط).
// ====================================================================

// فكّ الصورة إلى مصدر صالح لـ drawImage مع تطبيق اتجاه EXIF ما أمكن
async function loadDrawable(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' يطبّق EXIF orientation (الافتراضي الحديث، نطلبه صراحةً)
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      try {
        // بعض المتصفحات ترفض الخيار — نحاول بدونه
        return await createImageBitmap(file);
      } catch { /* نكمل لمسار <img> */ }
    }
  }
  // fallback: عنصر <img> — المتصفحات الحديثة تفكّه مع تطبيق EXIF افتراضياً
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذّر فك ترميز الصورة'));
      el.src = url;
    });
  } finally {
    // الفك اكتمل عند onload — الرابط المؤقت لم يعد مطلوباً
    URL.revokeObjectURL(url);
  }
}

/**
 * يضغط صورة قبل الرفع: تصغير الضلع الأطول إلى maxEdge (مع حفظ النسبة،
 * بلا تكبير) + إعادة ترميز JPEG بجودة quality.
 *
 * @param {File} file - ملف صورة (image/*)
 * @param {Object} [options]
 * @param {number} [options.maxEdge=1600] - أقصى طول للضلع الأطول بالبكسل
 * @param {number} [options.quality=0.7] - جودة JPEG (0..1)
 * @returns {Promise<File>} ملف JPEG مضغوط، أو الملف الأصلي إن لم يكن الضغط أصغر
 * @throws أي فشل (فك/رسم/ترميز) — على المتصل الرجوع للملف الأصلي
 */
export async function compressImage(file, { maxEdge = 1600, quality = 0.7 } = {}) {
  const source = await loadDrawable(file);
  const srcW = source.naturalWidth || source.width;
  const srcH = source.naturalHeight || source.height;
  if (!srcW || !srcH) throw new Error('أبعاد الصورة غير صالحة');

  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH)); // لا تكبير أبداً
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas غير مدعوم');
  // خلفية بيضاء: شفافية PNG تتحول لأسود عند الترميز JPEG بدونها
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  if (typeof source.close === 'function') source.close(); // تحرير ImageBitmap

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('فشل ترميز JPEG'))),
      'image/jpeg',
      quality
    );
  });

  // الضغط لم يفد (صورة صغيرة/مضغوطة أصلاً) ⇒ الأصل أفضل
  if (blob.size >= file.size) return file;

  const baseName = (file.name || 'invoice').replace(/\.[^.]*$/, '');
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}
