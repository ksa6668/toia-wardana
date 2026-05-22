// src/components/ExpenseFormV2.jsx
// ----------------------------------------------------------
// نموذج تسجيل المصروف — تصميم مطابق للـ prototype (screen-addExpense)
//
// المنطق محفوظ كاملاً:
//   - addExpense من firebase.js
//   - uploadInvoiceImage لـ Cloudflare R2
//   - getCategories + getPaymentMethods
//   - i18n
//
// التصميم الجديد:
//   - chips للتصنيفات (primary للأكثر استخداماً، عادية للباقي)
//   - chip "ورد" يفعّل كاميرا إلزامية لصورة الفاتورة
//   - photo-up: مستطيل dashed يفتح الكاميرا
//   - preview للصورة بعد الاختيار
//   - أزرار صف (إلغاء + حفظ)
// ----------------------------------------------------------
import { useState, useEffect, useRef } from 'react';
import {
  Calendar, MapPin, Camera, CheckCircle2, Loader2, ChevronRight, X, Image as ImageIcon,
} from 'lucide-react';
import {
  addExpense, getCategories, getPaymentMethods, uploadInvoiceImage,
} from '../firebase';
import { t, translateCategory, translatePM } from '../i18n';
import SarSymbol from './SarSymbol';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// التصنيفات الأكثر استخداماً تظهر بـ chip "primary" (cyan tint).
// لو الـ category في Firestore فيه expenseType من هذه، نعتبره primary.
const PRIMARY_TYPES = ['flower', 'delivery', 'customerOrders', 'supplies'];

export default function ExpenseFormV2({ setView, branch, branchId, lang = 'ar' }) {
  const [date, setDate] = useState(todayStr());
  const [categories, setCategories] = useState([]);
  const [methods, setMethods] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, pm] = await Promise.all([getCategories(), getPaymentMethods()]);
        if (!cancelled) {
          setCategories(cats);
          setMethods(pm);
          // التصنيف الافتراضي: أول تصنيف primary
          const firstPrimary = cats.find((c) => PRIMARY_TYPES.includes(c.expenseType));
          if (firstPrimary) setCategoryId(firstPrimary.id);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || t(lang, 'expense.loading'));
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lang]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const requiresImage = selectedCategory?.requiresImage || false;

  // الكاميرا الإلزامية للتصنيفات التي تتطلب صورة، gallery للباقي
  const triggerPhotoCapture = () => {
    if (requiresImage) cameraInputRef.current?.click();
    else fileInputRef.current?.click();
  };

  const onPhotoSelected = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError(t(lang, 'expense.err.imgType')); return; }
    if (f.size > 7 * 1024 * 1024) { setError(t(lang, 'expense.err.imgSize')); return; }
    setError('');
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const removePhoto = () => {
    setImageFile(null);
    setImagePreview('');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setError('');
    if (!categoryId) { setError(t(lang, 'expense.err.cat')); return; }
    if (!(Number(amount) > 0)) { setError(t(lang, 'expense.err.amount')); return; }
    if (requiresImage && !imageFile) { setError(t(lang, 'expense.err.img')); return; }

    setSaving(true);
    try {
      let invoiceUrl = null, invoicePath = null;
      if (imageFile) {
        setUploading(true);
        const up = await uploadInvoiceImage(imageFile);
        invoiceUrl = up.invoiceUrl;
        invoicePath = up.invoicePath;
        setUploading(false);
      }
      await addExpense({
        date,
        branchId,
        categoryId,
        categoryName: selectedCategory?.name,
        expenseType: selectedCategory?.expenseType || 'general',
        amount,
        paymentMethodId: payMethod,
        notes: notes.trim() || null,
        invoiceUrl,
        invoicePath,
      });
      setDone(true);
      setTimeout(() => setView('employeeHome'), 1200);
    } catch (err) {
      setError(err?.message || t(lang, 'expense.err.save'));
      setSaving(false);
      setUploading(false);
    }
  };

  const pmLabel = (id) => {
    const tr = translatePM(lang, id);
    if (tr && !tr.startsWith('pm.')) return tr;
    const m = methods.find((x) => x.id === id);
    return m?.labelAr || id;
  };

  const dateLabel = date === todayStr()
    ? (lang === 'en' ? 'Today' : 'اليوم')
    : date;

  return (
    <div
      className="min-h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* شريط العنوان */}
      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button
          onClick={() => setView('employeeHome')}
          className="p-2 text-tw-muted bg-tw-soft rounded-full hover:bg-slate-200 transition-colors"
        >
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">
          {t(lang, 'expense.title')}
        </h2>
      </div>

      <div className="relative z-10 p-4 space-y-4 pb-8">
        {/* Pills: التاريخ + الفرع */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <div className="flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-2.5 px-3 shadow-sm">
              <Calendar size={14} className="text-tw-blue" />
              <span className="font-bold text-xs text-tw-navy">{dateLabel}</span>
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-2.5 px-3 shadow-sm">
            <MapPin size={14} className="text-tw-blue" />
            <span className="font-bold text-xs text-tw-navy">
              {lang === 'en' ? branch : `فرع ${branch}`}
            </span>
          </div>
        </div>

        {/* التصنيف — chips */}
        <div>
          <h4 className="text-sm font-bold text-tw-navy mb-2">{t(lang, 'expense.category')}</h4>
          {loadingCats ? (
            <div className="bg-white border border-tw-line rounded-xl p-4 text-sm text-tw-muted/70 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> {t(lang, 'expense.loading')}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const isPrimary = PRIMARY_TYPES.includes(c.expenseType);
                const isActive = c.id === categoryId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      isActive
                        ? 'bg-tw-blue text-white border-blue-600 shadow-md scale-105'
                        : isPrimary
                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100'
                        : 'bg-white text-tw-muted border-tw-line hover:bg-tw-soft/40'
                    }`}
                  >
                    {translateCategory(lang, c.name)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* تفاصيل المصروف — كارت */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-tw-line space-y-3">
          <h4 className="text-sm font-bold text-tw-navy">{lang === 'en' ? 'Expense details' : 'تفاصيل المصروف'}</h4>

          {/* المبلغ */}
          <div>
            <label className="text-xs font-bold text-tw-muted mb-1.5 block">{t(lang, 'expense.amount')}</label>
            <div className="flex items-center gap-2 bg-tw-soft/40 border border-tw-line rounded-xl p-3">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 text-lg font-bold text-tw-navy outline-none bg-transparent placeholder:text-tw-muted/50"
                dir="ltr"
              />
              <SarSymbol className="text-tw-muted/70 text-base" />
            </div>
          </div>

          {/* طريقة الدفع */}
          <div>
            <label className="text-xs font-bold text-tw-muted mb-1.5 block">{t(lang, 'expense.payMethod')}</label>
            <div className="flex gap-2">
              {(methods.length ? methods : [{ id: 'Cash' }, { id: 'Mada' }, { id: 'Transfer' }]).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPayMethod(p.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                    payMethod === p.id
                      ? 'bg-tw-blue text-white border-blue-600'
                      : 'bg-tw-soft/40 text-tw-muted border-tw-line'
                  }`}
                >
                  {pmLabel(p.id)}
                </button>
              ))}
            </div>
          </div>

          {/* الملاحظات */}
          <div>
            <label className="text-xs font-bold text-tw-muted mb-1.5 block">
              {lang === 'en' ? 'Notes (optional)' : 'الملاحظات (اختياري)'}
            </label>
            <input
              type="text"
              placeholder={lang === 'en' ? 'Short description' : 'وصف مختصر'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-tw-soft/40 border border-tw-line rounded-xl p-3 text-sm outline-none focus:border-tw-blue"
            />
          </div>

          {/* صورة الفاتورة */}
          <div>
            <label className="text-xs font-bold text-tw-muted mb-1.5 block">
              {lang === 'en' ? 'Invoice photo' : 'صورة الفاتورة'}
              {requiresImage && <span className="text-tw-red mr-1">*</span>}
            </label>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPhotoSelected}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoSelected}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="w-full max-h-48 object-cover rounded-xl border border-tw-line"
                />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={triggerPhotoCapture}
                className={`w-full p-5 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-colors ${
                  requiresImage
                    ? 'border-red-300 bg-red-50 text-tw-red hover:bg-red-50'
                    : 'border-tw-line bg-tw-soft/40 text-tw-muted hover:bg-tw-soft'
                }`}
              >
                {requiresImage ? <Camera size={28} /> : <ImageIcon size={28} />}
                <span className="text-xs font-bold">
                  {lang === 'en' ? 'Tap to attach invoice photo' : 'اضغط لإرفاق صورة الفاتورة'}
                </span>
              </button>
            )}
            {requiresImage && !imageFile && (
              <p className="text-[11px] text-tw-red mt-2 font-bold">
                📷 {lang === 'en'
                  ? 'Photo must be captured with camera for this category.'
                  : 'يجب التقاط الصورة بالكاميرا مباشرة لهذا التصنيف.'}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
            {error}
          </p>
        )}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {t(lang, 'expense.saved')}
          </p>
        )}

        {/* أزرار الإجراءات */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setView('employeeHome')}
            className="flex-1 bg-white border border-tw-line text-tw-navy font-bold py-3.5 rounded-xl hover:bg-tw-soft/40 transition-colors"
          >
            {lang === 'en' ? 'Cancel' : 'إلغاء'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || done || uploading}
            className="flex-1 text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
              boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
            }}
          >
            {(saving || uploading) && <Loader2 size={18} className="animate-spin" />}
            {uploading
              ? (lang === 'en' ? 'Uploading...' : 'جارٍ رفع الصورة...')
              : saving
              ? t(lang, 'expense.saving')
              : t(lang, 'expense.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
