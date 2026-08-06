// src/components/QrScanSheet.jsx
// ----------------------------------------------------------
// شيت سفلي لمسح رمز QR من بطاقة الولاء (المرحلة 2).
// الكاميرا الخلفية (facingMode: environment) + فك الرمز بـ jsQR
// (لا BarcodeDetector — غير مدعوم في iOS Safari).
//
// معالجة الأخطاء إلزامية: رفض الإذن / لا كاميرا / سياق غير آمن
// (non-HTTPS) / تعذّر التشغيل. إيقاف كل مسارات الكاميرا
// (stream.getTracks().forEach(t => t.stop())) عند الإغلاق وعند unmount.
// ----------------------------------------------------------
import { useEffect, useRef, useState } from 'react';
import { X, CameraOff, Loader2 } from 'lucide-react';
import jsQR from 'jsqr';
import SheetPortal from './SheetPortal';

// ملاحظة: المكوّن يُركَّب عند الفتح ويُفكَّك عند الإغلاق (الأب يعرضه شرطياً)
// — الكاميرا تبدأ عند mount وتتوقف حتماً في cleanup عند unmount.
export default function QrScanSheet({ onResult, onClose, lang = 'ar' }) {
  const en = lang === 'en';
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const doneRef = useRef(false); // يمنع تكرار onResult بعد أول قراءة
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    doneRef.current = false;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // إيقاف الكاميرا بالكامل — يُستدعى عند الإغلاق وunmount
    const stopStream = () => {
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const tick = () => {
      if (cancelled || doneRef.current) return;
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) {
          doneRef.current = true;
          stopStream();
          onResult?.(String(code.data).trim());
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    (async () => {
      // سياق غير آمن (http بدون localhost) → لا mediaDevices أصلاً
      if (!navigator.mediaDevices?.getUserMedia) {
        setStarting(false);
        setError(en
          ? 'Camera requires a secure (HTTPS) connection'
          : 'الكاميرا تتطلب اتصالاً آمناً (HTTPS)');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        // iOS: يتطلب playsinline + muted للتشغيل بلا تفاعل إضافي
        await video.play();
        setStarting(false);
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        setStarting(false);
        if (err?.name === 'NotAllowedError') {
          setError(en
            ? 'Camera permission denied — allow it from browser settings'
            : 'تم رفض إذن الكاميرا — فعّله من إعدادات المتصفح');
        } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
          setError(en ? 'No camera found on this device' : 'لا توجد كاميرا متاحة على هذا الجهاز');
        } else {
          setError(en ? 'Failed to start the camera' : 'تعذّر تشغيل الكاميرا');
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // تشغيل مرة واحدة عند mount — onResult تُقرأ من الـ closure الأولي
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SheetPortal>
      <div className="tw-sheet-overlay show" onClick={onClose} />
      <div className="tw-sheet-panel show" role="dialog" aria-modal="true">
        <div className="tw-sheet-grab" />
        <div style={{ padding: '10px 0 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--tw-navy)' }}>
              {en ? 'Scan the card QR' : 'مسح رمز البطاقة'}
            </h4>
            <button
              type="button"
              onClick={onClose}
              aria-label={en ? 'Close' : 'إغلاق'}
              style={{
                background: 'var(--tw-soft, #Eef3FB)', border: 'none', borderRadius: 10,
                width: 32, height: 32, display: 'grid', placeItems: 'center',
                cursor: 'pointer', color: 'var(--tw-navy)',
              }}
            >
              <X size={16} />
            </button>
          </div>

          {error ? (
            <div style={{ textAlign: 'center', padding: '26px 10px' }}>
              <CameraOff size={34} style={{ color: 'var(--tw-red)', margin: '0 auto 10px' }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tw-red)' }}>{error}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tw-muted)', marginTop: 6 }}>
                {en ? 'You can always search by phone number instead' : 'يمكنك دائماً البحث برقم الجوال بدلاً من المسح'}
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000' }}>
              {starting && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff', zIndex: 1,
                }}>
                  <Loader2 size={26} className="animate-spin" />
                  <p style={{ fontSize: 12, fontWeight: 700 }}>
                    {en ? 'Starting camera…' : 'جارٍ تشغيل الكاميرا…'}
                  </p>
                </div>
              )}
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', height: 280, objectFit: 'cover', display: 'block' }}
              />
              {/* إطار تصويب بسيط */}
              <div style={{
                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none',
              }}>
                <div style={{
                  width: 180, height: 180, borderRadius: 18,
                  border: '3px solid rgba(255,255,255,0.85)',
                  boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)',
                }} />
              </div>
            </div>
          )}

          {!error && (
            <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--tw-muted)', marginTop: 10 }}>
              {en ? 'Point the camera at the QR on the customer card' : 'وجّه الكاميرا نحو الرمز في بطاقة العميل'}
            </p>
          )}
        </div>
      </div>
    </SheetPortal>
  );
}
