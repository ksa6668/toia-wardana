// src/components/ExpenseFormV2.jsx
// نموذج تسجيل/تعديل المصروف — تصميم 1:1 مع الـ prototype (screen-addExpense)
// Batch 12.6:
//   - pill التاريخ يفتح DateSheet
//   - pill الفرع يفتح BranchPickerSheet
//   - .tw-chips للتصنيفات
//   - .tw-photo-up + الكاميرا الإجبارية
//   - وضع التعديل + الصورة القديمة
import { useState, useEffect, useRef } from 'react';
import {
  Calendar, MapPin, Camera, CheckCircle2, Loader2, ChevronDown, X, Image as ImageIcon,
} from 'lucide-react';
import {
  addExpense, updateExpense, getCategories, getPaymentMethods, getBranches, uploadInvoiceImage,
  classifyExpense,
} from '../firebase';
import { t, translateCategory, translatePM } from '../i18n';
import SarSymbol from './SarSymbol';
import BranchPickerSheet from './BranchPickerSheet';
import DateSheet from './DateSheet';
import BottomSheet from './BottomSheet';
import { useScreenHeader } from '../context/ScreenCtx';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLabelFor(dateStr, lang) {
  if (!dateStr) return '—';
  const T = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  const t2 = new Date(); t2.setDate(t2.getDate() - 2);
  const t2Str = `${t2.getFullYear()}-${String(t2.getMonth() + 1).padStart(2, '0')}-${String(t2.getDate()).padStart(2, '0')}`;
  if (dateStr === T) return lang === 'en' ? 'Today' : 'اليوم';
  if (dateStr === yStr) return lang === 'en' ? 'Yesterday' : 'أمس';
  if (dateStr === t2Str) return lang === 'en' ? '2 days ago' : 'قبل يومين';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const PRIMARY_TYPES = ['flower', 'delivery', 'customerOrders', 'supplies'];

export default function ExpenseFormV2({
  setView,
  branch,
  branchId,
  lang = 'ar',
  allowBranchSwitch = false,
  onBranchChange,
  existingRecord = null,
  isAdmin = false, // Batch 36: المدير يحصل على خيارات صور إضافية
  onBack, // Batch 38: callback للعودة لـ AppHeader الموحّد
}) {
  const isEdit = !!existingRecord;

  const [date, setDate] = useState(existingRecord?.date || todayStr());
  const [categories, setCategories] = useState([]);
  const [methods, setMethods] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [loadingCats, setLoadingCats] = useState(true);
  const [categoryId, setCategoryId] = useState(existingRecord?.categoryId || '');
  const [amount, setAmount] = useState(existingRecord?.amount != null ? String(existingRecord.amount) : '');
  const [notes, setNotes] = useState(existingRecord?.notes || '');
  const [payMethod, setPayMethod] = useState(existingRecord?.paymentMethodId || 'Cash');
  const [existingImageUrl, setExistingImageUrl] = useState(existingRecord?.invoiceUrl || '');
  const [existingImagePath, setExistingImagePath] = useState(existingRecord?.invoicePath || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null); // Batch 36: استديو (بدون capture)
  // Batch 36: bottom sheet خيارات الصور للمدير
  const [photoOptionsOpen, setPhotoOptionsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, pm] = await Promise.all([getCategories(), getPaymentMethods()]);
        if (!cancelled) {
          const orderMap = { flower: 1, delivery: 2, customerOrders: 3, supplies: 4 };
          const typeOf = (c) => {
            const t1 = c.expenseType;
            const t2 = classifyExpense(c.id);
            const t3 = classifyExpense(c.name);
            return PRIMARY_TYPES.includes(t1) ? t1
              : PRIMARY_TYPES.includes(t2) ? t2
              : t3;
          };
          const sorted = [...cats].sort((a, b) => {
            const ra = orderMap[typeOf(a)] || 99;
            const rb = orderMap[typeOf(b)] || 99;
            if (ra !== rb) return ra - rb;
            return (a.order || 0) - (b.order || 0);
          });
          setCategories(sorted);
          setMethods(pm);
          if (!existingRecord) {
            const firstPrimary = sorted.find((c) => PRIMARY_TYPES.includes(typeOf(c)));
            if (firstPrimary) setCategoryId(firstPrimary.id);
          }
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || t(lang, 'expense.loading'));
      } finally {
        if (!cancelled) setLoadingCats(false);
      }
    })();
    return () => { cancelled = true; };
  }, [lang, existingRecord]);

  useEffect(() => {
    if (!allowBranchSwitch) return;
    let cancelled = false;
    (async () => {
      try {
        const bs = await getBranches();
        if (!cancelled) setBranches(bs);
      } catch {
        if (!cancelled) setBranches([{ id: 'toia', name: 'تويا' }, { id: 'wardana', name: 'وردانة' }]);
      }
    })();
    return () => { cancelled = true; };
  }, [allowBranchSwitch]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const requiresImage = selectedCategory?.requiresImage || false;
  const visibleImage = imagePreview || existingImageUrl;

  const triggerPhotoCapture = () => {
    // Batch 36: المدير يحصل على bottom sheet بـ 3 خيارات
    // الموظف: كاميرا فقط لو requiresImage، أو ملف عادي خلاف ذلك
    if (isAdmin) {
      setPhotoOptionsOpen(true);
      return;
    }
    if (requiresImage) cameraInputRef.current?.click();
    else fileInputRef.current?.click();
  };

  // Batch 36: handlers لخيارات الصور (للمدير)
  const pickFromCamera = () => { setPhotoOptionsOpen(false); cameraInputRef.current?.click(); };
  const pickFromGallery = () => { setPhotoOptionsOpen(false); galleryInputRef.current?.click(); };
  const pickFromFiles = () => { setPhotoOptionsOpen(false); fileInputRef.current?.click(); };

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
    if (isEdit) {
      setExistingImageUrl('');
      setExistingImagePath('');
    }
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setError('');
    if (!categoryId) { setError(t(lang, 'expense.err.cat')); return; }
    if (!(Number(amount) > 0)) { setError(t(lang, 'expense.err.amount')); return; }
    if (requiresImage && !imageFile && !existingImageUrl) {
      setError(t(lang, 'expense.err.img'));
      return;
    }

    setSaving(true);
    try {
      let invoiceUrl = existingImageUrl || null;
      let invoicePath = existingImagePath || null;

      if (imageFile) {
        setUploading(true);
        const up = await uploadInvoiceImage(imageFile);
        invoiceUrl = up.invoiceUrl;
        invoicePath = up.invoicePath;
        setUploading(false);
      }

      const payload = {
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
      };

      if (isEdit) {
        await updateExpense(existingRecord.id, payload);
      } else {
        await addExpense(payload);
      }
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

  const screenTitle = isEdit
    ? (lang === 'en' ? 'Edit expense' : 'تعديل المصروف')
    : t(lang, 'expense.title');

  // Batch 38: استخدام AppHeader الموحّد
  useScreenHeader(screenTitle, onBack || (() => setView && setView('employeeHome')));

  const saveBtnLabel = isEdit
    ? (lang === 'en' ? 'Save changes' : 'حفظ التعديلات')
    : t(lang, 'expense.save');

  return (
    <div className="tw-page-bg">
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* Batch 38: تم حذف الـ inline header — العنوان وزر العودة في AppHeader الموحّد */}

      <div className="relative z-10 p-4 pb-8">
        <div className="tw-controls-row">
          <div
            className="tw-pill"
            onClick={() => setDateSheetOpen(true)}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer', flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDateSheetOpen(true); }
            }}
          >
            <Calendar size={14} />
            <span>{dateLabelFor(date, lang)}</span>
            <ChevronDown size={12} style={{ marginInlineStart: 'auto', opacity: 0.5 }} />
          </div>

          <div
            className="tw-pill"
            onClick={() => allowBranchSwitch && setBranchSheetOpen(true)}
            role={allowBranchSwitch ? 'button' : undefined}
            tabIndex={allowBranchSwitch ? 0 : undefined}
            style={{ cursor: allowBranchSwitch ? 'pointer' : 'default', flex: 1 }}
            onKeyDown={(e) => {
              if (allowBranchSwitch && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setBranchSheetOpen(true);
              }
            }}
          >
            <MapPin size={14} />
            <span>{lang === 'en' ? branch : `فرع ${branch}`}</span>
            {allowBranchSwitch && (
              <ChevronDown size={12} style={{ marginInlineStart: 'auto', opacity: 0.5 }} />
            )}
          </div>
        </div>

        <div className="tw-sec-h" style={{ margin: '14px 4px 8px' }}>
          {t(lang, 'expense.category')}
        </div>

        {loadingCats ? (
          <div className="tw-form-card" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tw-muted)' }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t(lang, 'expense.loading')}</span>
          </div>
        ) : (
          <div className="tw-chips">
            {categories.map((c) => {
              // primary check: نتحقق من expenseType، id، name — أي منها يطابق الأربعة
              const t1 = c.expenseType;
              const t2 = classifyExpense(c.id);
              const t3 = classifyExpense(c.name);
              const effectiveType = PRIMARY_TYPES.includes(t1) ? t1
                : PRIMARY_TYPES.includes(t2) ? t2
                : t3;
              const isPrimary = PRIMARY_TYPES.includes(effectiveType);
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

        <div className="tw-form-card">
          <label>{t(lang, 'expense.amount')}</label>
          <div className="tw-field">
            <input type="number" inputMode="decimal" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
            <span className="tw-field-suffix">{t(lang, 'sales.currency')}</span>
          </div>

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

          <label style={{ marginTop: 10 }}>
            {lang === 'en' ? 'Invoice photo' : 'صورة الفاتورة'}
            {requiresImage && <span style={{ color: 'var(--tw-red)', marginInlineStart: 4 }}>*</span>}
          </label>

          <input
            ref={cameraInputRef}
            type="file" accept="image/*" capture="environment"
            onChange={onPhotoSelected}
            style={{ display: 'none' }}
          />
          <input
            ref={galleryInputRef}
            type="file" accept="image/*"
            onChange={onPhotoSelected}
            style={{ display: 'none' }}
          />
          <input
            ref={fileInputRef}
            type="file" accept="image/*,application/pdf"
            onChange={onPhotoSelected}
            style={{ display: 'none' }}
          />

          {visibleImage ? (
            <div className="tw-photo-preview-wrap">
              <img src={visibleImage} alt="preview" />
              <button type="button" onClick={removePhoto} className="tw-photo-remove" aria-label="Remove photo">
                <X size={14} />
              </button>
              {isEdit && (
                <button
                  type="button"
                  onClick={triggerPhotoCapture}
                  className="tw-btn secondary"
                  style={{ marginTop: 8, width: '100%', fontSize: 12 }}
                >
                  {lang === 'en' ? 'Replace photo' : 'استبدال الصورة'}
                </button>
              )}
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
              {requiresImage ? (
                <p className="tw-photo-note required">
                  📷 {lang === 'en'
                    ? 'Photo must be captured live with the camera for this category.'
                    : 'يجب التقاط الصورة بالكاميرا مباشرة لهذا التصنيف.'}
                </p>
              ) : (
                /* Batch 37: ملاحظة عامة بنفس التظليل الأزرق للصور غير الإجبارية */
                <p className="tw-photo-note">
                  {isAdmin
                    ? (lang === 'en'
                        ? '💡 You can capture, choose from library, or pick a file (image or PDF).'
                        : '💡 يمكنك التقاط صورة، الاختيار من المكتبة، أو اختيار ملف (صورة أو PDF).')
                    : (lang === 'en'
                        ? '💡 Attach an invoice photo for better recordkeeping.'
                        : '💡 يُفضّل إرفاق صورة الفاتورة للأرشفة.')}
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
            <CheckCircle2 size={18} />
            {isEdit
              ? (lang === 'en' ? 'Updated successfully' : 'تم التعديل بنجاح')
              : t(lang, 'expense.saved')}
          </p>
        )}

        <div className="tw-btn-row" style={{ marginTop: 14 }}>
          <button onClick={handleSave} disabled={saving || done || uploading} className="tw-btn" type="button" style={{ flex: 1 }}>
            {(saving || uploading) && <Loader2 size={18} className="animate-spin inline-block ml-1" />}
            {uploading
              ? (lang === 'en' ? 'Uploading...' : 'جارٍ رفع الصورة...')
              : saving
              ? (lang === 'en' ? 'Saving...' : 'جارٍ الحفظ...')
              : saveBtnLabel}
          </button>
        </div>
      </div>

      <DateSheet
        open={dateSheetOpen}
        currentDate={date}
        onPick={(newDate) => setDate(newDate)}
        onClose={() => setDateSheetOpen(false)}
        lang={lang}
      />

      {allowBranchSwitch && (
        <BranchPickerSheet
          open={branchSheetOpen}
          branches={branches}
          currentBranchId={branchId}
          onPick={(id) => onBranchChange?.(id)}
          onClose={() => setBranchSheetOpen(false)}
          lang={lang}
        />
      )}

      {/* Batch 36: bottom sheet خيارات الصور — يُعرض للمدير فقط */}
      <BottomSheet
        open={photoOptionsOpen}
        title={lang === 'en' ? 'Choose photo source' : 'اختر مصدر الصورة'}
        options={[
          { value: 'camera', label: lang === 'en' ? '📷 Camera (live capture)' : '📷 الكاميرا (التقاط مباشر)' },
          { value: 'gallery', label: lang === 'en' ? '🖼️ Photo library' : '🖼️ مكتبة الصور' },
          { value: 'files', label: lang === 'en' ? '📁 Files (image or PDF)' : '📁 الملفات (صورة أو PDF)' },
        ]}
        onPick={(v) => {
          if (v === 'camera') pickFromCamera();
          else if (v === 'gallery') pickFromGallery();
          else if (v === 'files') pickFromFiles();
        }}
        onClose={() => setPhotoOptionsOpen(false)}
      />
    </div>
  );
}
