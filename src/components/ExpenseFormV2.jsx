// src/components/ExpenseFormV2.jsx
// ----------------------------------------------------------
// نموذج تسجيل المصروف — تصميم 1:1 مع الـ prototype (screen-addExpense)
//
// المنطق محفوظ بالكامل:
//   - addExpense من firebase.js
//   - uploadInvoiceImage (Cloudflare R2)
//   - getCategories + getPaymentMethods
//   - منطق الكاميرا الإجبارية: requiresImage → cameraInput, غيرها → fileInput
//
// التصميم الجديد (Batch 12):
//   - .tw-controls-row pills للتاريخ + الفرع
//   - pill الفرع قابل للنقر → bottom sheet (للمدير)
//   - .tw-chips مع .tw-chip.primary للتصنيفات الأساسية (cyan tint)
//   - .tw-form-card لتفاصيل المصروف
//   - .tw-photo-up (dashed → solid عند الإرفاق)
//   - .tw-btn-row (إلغاء + حفظ)
// ----------------------------------------------------------
import { useState, useEffect, useRef } from 'react';
import {
  Calendar, MapPin, Camera, CheckCircle2, Loader2, ChevronRight, X, Image as ImageIcon,
} from 'lucide-react';
import {
  addExpense, getCategories, getPaymentMethods, getBranches, uploadInvoiceImage,
} from '../firebase';
import { t, translateCategory, translatePM } from '../i18n';
import SarSymbol from './SarSymbol';
import BranchPickerSheet from './BranchPickerSheet';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// التصنيفات الأساسية الأربعة (chip primary بلون cyan tint)
const PRIMARY_TYPES = ['flower', 'delivery', 'customerOrders', 'supplies'];

export default function ExpenseFormV2({
  setView,
  branch,
  branchId,
  lang = 'ar',
  allowBranchSwitch = false,
  onBranchChange,
}) {
  const [date, setDate] = useState(todayStr());
  const [categories, setCategories] = useState([]);
  const [methods, setMethods] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
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
          // ترتيب التصنيفات: الأساسية الأربعة أولاً ثم الباقي
          const orderMap = { flower: 1, delivery: 2, customerOrders: 3, supplies: 4 };
          const sorted = [...cats].sort((a, b) => {
            const ra = orderMap[a.expenseType] || 99;
            const rb = orderMap[b.expenseType] || 99;
            if (ra !== rb) return ra - rb;
            return (a.order || 0) - (b.order || 0);
          });
          setCategories(sorted);
          setMethods(pm);
          // التصنيف الافتراضي: أول تصنيف primary
          const firstPrimary = sorted.find((c) => PRIMARY_TYPES.includes(c.expenseType));
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

  // جلب الفروع للـ bottom sheet (للمدير فقط)
  useEffect(() => {
    if (!allowBranchSwitch) return;
    (async () => {
      try { setBranches(await getBranches()); }
      catch {
        setBranches([{ id: 'toia', name: 'تويا' }, { id: 'wardana', name: 'وردانة' }]);
      }
    })();
  }, [allowBranchSwitch]);

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
    <div className="tw-page-bg">
      {/* خلفية زخرفية */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* شريط العنوان */}
      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button
          onClick={() => setView('employeeHome')}
          className="tw-circle-btn"
          type="button"
          aria-label="Back"
        >
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">
          {t(lang, 'expense.title')}
        </h2>
        <div style={{ width: 36 }} />
      </div>

      <div className="relative z-10 p-4 pb-8">
        {/* Pills: التاريخ + الفرع */}
        <div className="tw-controls-row">
          <div className="tw-pill" style={{ position: 'relative' }}>
            <Calendar size={14} />
            <span>{dateLabel}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          <div
            className="tw-pill"
            onClick={() => allowBranchSwitch && setSheetOpen(true)}
            role={allowBranchSwitch ? 'button' : undefined}
            tabIndex={allowBranchSwitch ? 0 : undefined}
            style={{ cursor: allowBranchSwitch ? 'pointer' : 'default' }}
          >
            <MapPin size={14} />
            <span>{lang === 'en' ? branch : `فرع ${branch}`}</span>
            {allowBranchSwitch && (
              <ChevronRight
                size={12}
                style={{ marginInlineStart: 'auto', opacity: 0.5, transform: 'rotate(90deg)' }}
              />
            )}
          </div>
        </div>

        {/* عنوان التصنيف */}
        <div className="tw-sec-h" style={{ margin: '14px 4px 8px' }}>
          {t(lang, 'expense.category')}
        </div>

        {/* Chips التصنيفات */}
        {loadingCats ? (
          <div className="tw-form-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tw-muted)' }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t(lang, 'expense.loading')}</span>
          </div>
        ) : (
          <div className="tw-chips">
            {categories.map((c) => {
              const isPrimary = PRIMARY_TYPES.includes(c.expenseType);
              const isActive = c.id === categoryId;
              const classes = ['tw-chip'];
              if (isPrimary) classes.push('primary');
              if (isActive) classes.push('active');
              return (
                <span
                  key={c.id}
                  className={classes.join(' ')}
                  onClick={() => setCategoryId(c.id)}
                  role="button"
                  tabIndex={0}
                >
                  {translateCategory(lang, c.name)}
                </span>
              );
            })}
          </div>
        )}

        {/* تفاصيل المصروف — كارت */}
        <div className="tw-form-card">
          <h4>{lang === 'en' ? 'Expense details' : 'تفاصيل المصروف'}</h4>

          {/* المبلغ */}
          <label>{t(lang, 'expense.amount')}</label>
          <div className="tw-field">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
            />
            <span className="tw-field-suffix">{t(lang, 'sales.currency')}</span>
          </div>

          {/* طريقة الدفع */}
          <label style={{ marginTop: 10 }}>{t(lang, 'expense.payMethod')}</label>
          <div className="tw-um-pills" style={{ marginBottom: 10 }}>
            {(methods.length ? methods : [{ id: 'Cash' }, { id: 'Mada' }, { id: 'Transfer' }]).map((p) => {
              const active = payMethod === p.id;
              return (
                <span
                  key={p.id}
                  className={`tw-um-pill${active ? ' active' : ''}`}
                  onClick={() => setPayMethod(p.id)}
                  role="button"
                  tabIndex={0}
                >
                  {pmLabel(p.id)}
                </span>
              );
            })}
          </div>

          {/* الملاحظات */}
          <label style={{ marginTop: 10 }}>
            {lang === 'en' ? 'Notes (optional)' : 'الملاحظات (اختياري)'}
          </label>
          <div className="tw-field">
            <input
              type="text"
              placeholder={lang === 'en' ? 'Short description' : 'وصف مختصر'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* صورة الفاتورة */}
          <label style={{ marginTop: 10 }}>
            {lang === 'en' ? 'Invoice photo' : 'صورة الفاتورة'}
            {requiresImage && <span style={{ color: 'var(--tw-red)', marginInlineStart: 4 }}>*</span>}
          </label>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoSelected}
            style={{ display: 'none' }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onPhotoSelected}
            style={{ display: 'none' }}
          />

          {imagePreview ? (
            <div className="tw-photo-preview-wrap">
              <img src={imagePreview} alt="preview" />
              <button type="button" onClick={removePhoto} className="tw-photo-remove" aria-label="Remove photo">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <div
                className={`tw-photo-up${requiresImage ? ' required' : ''}`}
                onClick={triggerPhotoCapture}
                role="button"
                tabIndex={0}
              >
                {requiresImage ? <Camera /> : <ImageIcon />}
                <span>
                  {requiresImage
                    ? (lang === 'en' ? 'Tap to capture with camera' : 'اضغط لالتقاط الصورة بالكاميرا')
                    : (lang === 'en' ? 'Tap to attach invoice photo' : 'اضغط لإرفاق صورة الفاتورة')}
                </span>
              </div>
              {requiresImage && (
                <p className="tw-photo-note required">
                  📷 {lang === 'en'
                    ? 'Photo must be captured live with the camera for this category.'
                    : 'يجب التقاط الصورة بالكاميرا مباشرة لهذا التصنيف.'}
                </p>
              )}
            </>
          )}
        </div>

        {error && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mt-3">
            {error}
          </p>
        )}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center mt-3 flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {t(lang, 'expense.saved')}
          </p>
        )}

        {/* أزرار الإجراءات */}
        <div className="tw-btn-row" style={{ marginTop: 14 }}>
          <button
            onClick={() => setView('employeeHome')}
            className="tw-btn secondary"
            type="button"
            style={{ flex: 0.6 }}
          >
            {lang === 'en' ? 'Cancel' : 'إلغاء'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || done || uploading}
            className="tw-btn"
            type="button"
            style={{ flex: 1 }}
          >
            {(saving || uploading) && <Loader2 size={18} className="animate-spin inline-block ml-1" />}
            {uploading
              ? (lang === 'en' ? 'Uploading...' : 'جارٍ رفع الصورة...')
              : saving
              ? t(lang, 'expense.saving')
              : t(lang, 'expense.save')}
          </button>
        </div>
      </div>

      {/* Bottom sheet لاختيار الفرع — يظهر فقط للمدير */}
      {allowBranchSwitch && (
        <BranchPickerSheet
          open={sheetOpen}
          branches={branches}
          currentBranchId={branchId}
          onPick={(id) => onBranchChange?.(id)}
          onClose={() => setSheetOpen(false)}
          lang={lang}
        />
      )}
    </div>
  );
}
