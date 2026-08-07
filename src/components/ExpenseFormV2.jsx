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
  FileText, ExternalLink,
} from 'lucide-react';
import {
  addExpense, updateExpense, getCategories, getPaymentMethods, getBranches, uploadInvoiceImage,
  classifyExpense, getExpenses,
} from '../firebase';
import { addNotification } from './NotificationsCenter';
import { t, translateCategory, translatePM } from '../i18n';
import SarSymbol from './SarSymbol';
import BranchPickerSheet from './BranchPickerSheet';
import DateSheet from './DateSheet';
import BottomSheet from './BottomSheet';
import { useScreenHeader } from '../context/ScreenCtx';
import { todayLocal, dateLabelFor } from '../utils/dateHelpers';
import { compressImage } from '../utils/imageCompress';
import { toLatinDigits } from '../utils/digits';

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

  const [date, setDate] = useState(existingRecord?.date || todayLocal());
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
  // PDF: مرفق بديل عن الصورة (حقل واحد متبادل) — النوع يُحدَّد بـ attachmentType
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPreview, setPdfPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const galleryInputRef = useRef(null); // Batch 36: استديو (بدون capture)
  const pdfInputRef = useRef(null); // إرفاق ملف PDF
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

  // نوع المرفق القديم للسجل (توافق خلفي: غياب attachmentType = 'image')
  const existingAttachmentType = existingRecord?.invoiceUrl
    ? (existingRecord?.attachmentType || 'image')
    : null;

  // هل نعرض حالياً مرفق PDF؟ (ملف جديد مختار، أو سجل قديم مرفقه PDF)
  const showingPdf = pdfFile
    ? true
    : (!imageFile && !imagePreview && !!existingImageUrl && existingAttachmentType === 'pdf');
  // اسم/رابط الـ PDF المعروض
  const pdfViewUrl = pdfPreview || existingImageUrl;
  const pdfNameFromPath = (existingImagePath || existingImageUrl || '')
    .split('/').pop() || 'ملف PDF';
  const pdfName = pdfFile ? pdfFile.name : pdfNameFromPath;

  // الصورة تُعرض فقط إن لم يكن المرفق PDF
  const visibleImage = showingPdf ? '' : (imagePreview || existingImageUrl);

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

  // منطق موحّد لقبول المرفق (صورة أو PDF) — مشترك بين الصندوق الرئيسي والزر المخصّص
  // النتيجة واحدة أيًّا كان مصدر الملف: نوع المرفق يُشتق من نوع الملف (image/pdf)
  const acceptAttachment = (f) => {
    if (!f) return;
    const isPdf = f.type === 'application/pdf';
    const isImage = f.type.startsWith('image/');
    if (!isImage && !isPdf) { setError(t(lang, 'expense.err.fileType')); return; }
    if (f.size > 10 * 1024 * 1024) {
      setError(t(lang, isPdf ? 'expense.err.pdfSize' : 'expense.err.imgSize'));
      return;
    }
    setError('');
    // مرفق واحد متبادل: نمسح المدخلات الأخرى ونضبط الحالة حسب النوع
    if (isPdf) {
      setImageFile(null);
      setImagePreview('');
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPdfFile(f);
      setPdfPreview(URL.createObjectURL(f));
    } else {
      setPdfFile(null);
      setPdfPreview('');
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      setImageFile(f);
      setImagePreview(URL.createObjectURL(f));
    }
  };

  // الصندوق الرئيسي (accept=image/*,application/pdf) — يقبل الصورة والـ PDF عبر الدالة الموحّدة
  const onPhotoSelected = (e) => acceptAttachment(e.target.files?.[0]);

  // إرفاق ملف PDF فقط (بديل عن الصورة) — يمرّ بنفس الدالة الموحّدة
  const triggerPdfPick = () => { pdfInputRef.current?.click(); };
  const onPdfSelected = (e) => acceptAttachment(e.target.files?.[0]);

  const removePhoto = () => {
    setImageFile(null);
    setImagePreview('');
    setPdfFile(null);
    setPdfPreview('');
    if (isEdit) {
      setExistingImageUrl('');
      setExistingImagePath('');
    }
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
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
      // نوع المرفق: يبدأ من السجل القديم، ويُحدَّث عند رفع ملف جديد
      let attachmentType = existingImageUrl ? existingAttachmentType : null;

      // مرفق واحد متبادل: نرفع الملف الجديد (PDF أو صورة) عبر نفس آلية الرفع
      let uploadFile = pdfFile || imageFile;
      if (uploadFile) {
        setUploading(true);
        // Batch 75: الصور تُضغط في المتصفح قبل الرفع (تصغير + JPEG) —
        // PDF يمرّ كما هو بلا أي معالجة. فشل الضغط لأي سبب لا يفشل
        // الرفع أبداً: نرجع للملف الأصلي كما كان.
        if (!pdfFile && uploadFile.type && uploadFile.type.startsWith('image/')) {
          try {
            uploadFile = await compressImage(uploadFile);
          } catch { /* متصفح قديم/ملف غريب ⇒ الأصل كما هو */ }
        }
        // uploadInvoiceImage يرسل contentType من الملف؛ لملف PDF يكون
        // 'application/pdf' فيُفتح inline في المتصفح لا كتنزيل قسري
        const up = await uploadInvoiceImage(uploadFile);
        invoiceUrl = up.invoiceUrl;
        invoicePath = up.invoicePath;
        attachmentType = pdfFile ? 'pdf' : 'image';
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
        attachmentType,
      };

      if (isEdit) {
        await updateExpense(existingRecord.id, payload);
      } else {
        await addExpense(payload);
        // Batch 58: تنبيه شذوذ — لو المبلغ > ضعف متوسط مصاريف الفرع لآخر 30 يوماً
        // (فحص في الخلفية، لا يؤخر الحفظ ولا يفشل معه)
        (async () => {
          try {
            const d = new Date(date);
            d.setDate(d.getDate() - 30);
            const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const recent = (await getExpenses(from, date)).filter((e) => e.branchId === branchId);
            const amounts = recent.map((e) => Number(e.amount) || 0).filter((a) => a > 0);
            if (amounts.length >= 5) {
              const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
              const amtN = Number(amount) || 0;
              if (amtN > 2 * avg) {
                addNotification({
                  emoji: '⚠️',
                  type: 'warning',
                  title: lang === 'en' ? 'High expense alert' : 'تنبيه: مصروف مرتفع',
                  body: lang === 'en'
                    ? `An expense of ${amtN.toLocaleString('en-US')} SAR was recorded — more than 2× the 30-day average (${Math.round(avg).toLocaleString('en-US')}).`
                    : `سُجّل مصروف بمبلغ ${amtN.toLocaleString('en-US')} ﷼ — أعلى من ضعف متوسط آخر 30 يوماً (${Math.round(avg).toLocaleString('en-US')} ﷼).`,
                });
              }
            }
          } catch { /* فحص اختياري */ }
        })();
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
            <input type="number" inputMode="decimal" placeholder="0" min="0"
              value={amount} onChange={(e) => setAmount(toLatinDigits(e.target.value).replace('-', ''))} dir="ltr" />
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
            {lang === 'en' ? 'Invoice attachment' : 'مرفق الفاتورة'}
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
          <input
            ref={pdfInputRef}
            type="file" accept="application/pdf"
            onChange={onPdfSelected}
            style={{ display: 'none' }}
          />

          {showingPdf ? (
            /* معاينة PDF: أيقونة + اسم الملف + رابط «عرض PDF» + زر إزالة */
            <div className="tw-form-card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--tw-soft, #eef2ff)', color: 'var(--tw-red, #dc2626)',
                }}
              >
                <FileText size={22} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={pdfName}
                >
                  {pdfName}
                </div>
                {pdfViewUrl && (
                  <a
                    href={pdfViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-tw-blue"
                    style={{ fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2 }}
                  >
                    <ExternalLink size={13} />
                    {t(lang, 'expense.pdf.view')}
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={removePhoto}
                className="tw-photo-remove"
                aria-label={lang === 'en' ? 'Remove file' : 'إزالة الملف'}
                style={{ position: 'static', flexShrink: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          ) : visibleImage ? (
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
                    : (lang === 'en' ? 'Tap to attach an image or a PDF file' : 'اضغط لإرفاق صورة أو ملف PDF')}
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
                        ? '💡 Attach an invoice photo or a PDF file for better recordkeeping.'
                        : '💡 يُفضّل إرفاق صورة الفاتورة أو ملف PDF للأرشفة.')}
                </p>
              )}

              {/* خيار إرفاق PDF بجانب خيار التصوير — للتصنيفات غير الإجبارية للكاميرا */}
              {!requiresImage && (
                <button
                  type="button"
                  onClick={triggerPdfPick}
                  className="tw-btn secondary"
                  style={{ marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}
                >
                  <FileText size={16} />
                  {t(lang, 'expense.pdf.attach')}
                </button>
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
