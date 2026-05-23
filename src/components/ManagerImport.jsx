// src/components/ManagerImport.jsx
// ----------------------------------------------------------
// Batch 30: شاشة استيراد البيانات التاريخية من Excel/JSON
// 
// الـ flow:
//  1) المستخدم يختار الفرع (تويا / وردانة)
//  2) يرفع ملف JSON المُولّد من سكريبت convert_xlsx_to_json.py
//  3) معاينة شاملة (مجاميع شهرية + بالتصنيفات)
//  4) فحص البيانات الموجودة (هل يوجد استيراد سابق؟)
//  5) زر "تأكيد الاستيراد" مع progress bar
//  6) رسالة نجاح + خيار حذف الاستيراد لو حدث خطأ
// ----------------------------------------------------------
import { useState, useRef, useEffect } from 'react';
import {
  Upload, AlertTriangle, CheckCircle2, Loader2, FileJson, X,
  Trash2, Info, ChevronDown,
} from 'lucide-react';
import {
  checkExistingImports, importHistoricalData, deleteImportedData,
} from '../firebase';
import { useScreenHeader } from '../App';
import SarSymbol from './SarSymbol';
import BottomSheet from './BottomSheet';
import DeleteConfirmSheet from './DeleteConfirmSheet';

export default function ManagerImport({ onBack, lang = 'ar' }) {
  useScreenHeader(lang === 'en' ? 'Import Historical Data' : 'استيراد البيانات التاريخية', onBack);
  
  // ===== State =====
  const [branchId, setBranchId] = useState('toia');
  const [fileData, setFileData] = useState(null); // الـ JSON المُحمّل
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [existingData, setExistingData] = useState(null); // بيانات سابقة مستوردة
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, phase: '' });
  const [done, setDone] = useState(null); // نتيجة الاستيراد النهائية
  const [error, setError] = useState('');
  const [showBranchSheet, setShowBranchSheet] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef(null);

  // فحص بيانات سابقة لما يتغير الفرع
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const r = await checkExistingImports(branchId);
        if (!cancelled) setExistingData(r);
      } catch {
        if (!cancelled) setExistingData(null);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [branchId, done]); // إعادة الفحص بعد كل استيراد

  // ===== رفع الملف =====
  const handleFileChange = async (e) => {
    setParseError('');
    setFileData(null);
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      
      // تحقق من البنية
      if (!parsed.sales || !Array.isArray(parsed.sales)) {
        throw new Error('الملف لا يحتوي على بيانات مبيعات');
      }
      if (!parsed.expenses || !Array.isArray(parsed.expenses)) {
        throw new Error('الملف لا يحتوي على بيانات مصاريف');
      }
      
      // تحقق من تطابق الفرع
      if (parsed.branchId && parsed.branchId !== branchId) {
        throw new Error(
          `الملف لفرع ${parsed.branchId === 'toia' ? 'تويا' : 'وردانة'} ` +
          `لكن المختار ${branchId === 'toia' ? 'تويا' : 'وردانة'}. ` +
          `غيّر الفرع المختار أو ارفع الملف الصحيح.`
        );
      }
      
      setFileData(parsed);
    } catch (err) {
      setParseError(err?.message || 'تعذّر قراءة الملف');
      setFileName('');
    }
    // امسح الـ input ليقدر يعيد رفع نفس الملف
    e.target.value = '';
  };

  // ===== الاستيراد الفعلي =====
  const handleImport = async () => {
    if (!fileData) return;
    setImporting(true);
    setError('');
    setProgress({ done: 0, total: fileData.sales.length + fileData.expenses.length, phase: 'starting' });
    
    try {
      const result = await importHistoricalData({
        sales: fileData.sales,
        expenses: fileData.expenses,
        onProgress: (p) => setProgress(p),
      });
      setDone(result);
    } catch (err) {
      setError(err?.message || 'تعذّر الاستيراد');
    } finally {
      setImporting(false);
    }
  };

  // ===== حذف الاستيراد السابق =====
  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setDeleting(true);
    setError('');
    try {
      const r = await deleteImportedData(branchId);
      setDone(null);
      setFileData(null);
      setFileName('');
      alert(`تم حذف ${r.salesDeleted} مبيعات + ${r.expensesDeleted} مصاريف`);
    } catch (err) {
      setError(err?.message || 'تعذّر الحذف');
    } finally {
      setDeleting(false);
    }
  };

  // ===== معاينة المجاميع =====
  const summary = fileData ? computeSummary(fileData) : null;

  return (
    <div
      className="min-h-full relative pb-20"
      style={{
        background: 'transparent',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="p-4 space-y-4">
        {/* تنبيه أولي */}
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
          <AlertTriangle size={16} className="text-tw-orange flex-shrink-0 mt-0.5" />
          <div className="text-[12px] text-tw-navy leading-relaxed">
            <p className="font-bold mb-1">قبل البدء</p>
            <p>هذه الشاشة تستورد بيانات تاريخية من ملف JSON مُولّد من ملفات Excel. كل سجل مستورد يُحفظ بعلامة <code className="bg-amber-100 px-1 rounded">imported: true</code> ليمكن تمييزه أو حذفه لاحقاً.</p>
          </div>
        </div>

        {/* اختيار الفرع */}
        <div>
          <label className="text-xs font-bold text-tw-muted mb-1.5 block">الفرع</label>
          <button
            onClick={() => setShowBranchSheet(true)}
            className="w-full bg-white border border-tw-line rounded-xl p-3.5 flex items-center justify-between"
          >
            <span className="text-sm font-bold text-tw-navy">
              {branchId === 'toia' ? 'فرع تويا' : 'فرع وردانة'}
            </span>
            <ChevronDown size={16} className="text-tw-muted" />
          </button>
        </div>

        {/* عرض البيانات السابقة (إن وجدت) */}
        {existingData && (existingData.sales > 0 || existingData.expenses > 0) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-2 mb-2">
              <Info size={16} className="text-tw-red flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-tw-navy mb-1">يوجد استيراد سابق لهذا الفرع</p>
                <p className="text-xs text-tw-muted leading-relaxed">
                  {existingData.sales} سجل مبيعات + {existingData.expenses} سجل مصاريف
                  {existingData.oldestDate && ` (من ${existingData.oldestDate} إلى ${existingData.newestDate})`}
                </p>
                <p className="text-[11px] text-tw-red mt-2 font-bold">
                  ⚠️ إعادة الاستيراد ستُكرّر البيانات. احذف القديم أولاً.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="w-full bg-tw-red text-white font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {deleting ? 'جارٍ الحذف...' : 'حذف الاستيراد السابق'}
            </button>
          </div>
        )}

        {/* اختيار الملف */}
        {!done && (
          <div>
            <label className="text-xs font-bold text-tw-muted mb-1.5 block">ملف الاستيراد (JSON)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="w-full bg-white border-2 border-dashed border-tw-line rounded-xl p-4 flex flex-col items-center gap-2 hover:border-tw-blue/50 transition-colors disabled:opacity-50"
            >
              {fileData ? (
                <>
                  <FileJson size={32} className="text-tw-blue" />
                  <p className="text-sm font-bold text-tw-navy">{fileName}</p>
                  <p className="text-xs text-tw-muted">
                    {fileData.sales.length} مبيعات + {fileData.expenses.length} مصاريف
                  </p>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-tw-muted/50" />
                  <p className="text-sm font-bold text-tw-navy">اضغط لاختيار ملف JSON</p>
                  <p className="text-xs text-tw-muted">المُولّد من سكريبت تحويل Excel</p>
                </>
              )}
            </button>

            {parseError && (
              <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
                <X size={14} className="text-tw-red flex-shrink-0 mt-0.5" />
                <p className="text-xs text-tw-red font-bold">{parseError}</p>
              </div>
            )}
          </div>
        )}

        {/* معاينة البيانات */}
        {fileData && summary && !done && (
          <div className="bg-white rounded-2xl shadow-sm border border-tw-line p-4 space-y-3">
            <h3 className="text-base font-extrabold text-tw-navy">معاينة الاستيراد</h3>
            
            {/* الإجماليات */}
            <div className="grid grid-cols-2 gap-2">
              <StatBox label="مبيعات إجمالي" value={summary.totalGross} suffix="ريال" />
              <StatBox label="بعد رسوم مدى" value={summary.totalNet} suffix="ريال" color="green" />
              <StatBox label="مصاريف" value={summary.totalExp} suffix="ريال" color="red" />
              <StatBox
                label="الربح/الخسارة"
                value={summary.profit}
                suffix="ريال"
                color={summary.profit >= 0 ? 'green' : 'red'}
              />
            </div>

            {/* عدد السجلات */}
            <div className="text-xs text-tw-muted text-center font-bold border-t border-tw-line/60 pt-3">
              {fileData.sales.length} سجل مبيعات + {fileData.expenses.length} سجل مصاريف
              {' = '}
              <span className="text-tw-navy">{fileData.sales.length + fileData.expenses.length} إجمالي</span>
            </div>

            {/* المصاريف بالتصنيف */}
            <div className="border-t border-tw-line/60 pt-3 space-y-1.5">
              <p className="text-xs font-bold text-tw-muted">المصاريف بالتصنيف:</p>
              {Object.entries(summary.expByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between text-xs">
                    <span className="text-tw-navy font-bold">{cat}</span>
                    <span className="text-tw-muted">{amt.toLocaleString('en-US', { maximumFractionDigits: 2 })} ريال</span>
                  </div>
                ))
              }
            </div>

            {/* الفترة الزمنية */}
            <div className="border-t border-tw-line/60 pt-3 text-xs text-tw-muted text-center">
              <span className="font-bold text-tw-navy">{summary.monthsCount}</span> شهر
              {' • '}من <span className="font-bold text-tw-navy">{summary.firstMonth}</span>
              {' '}إلى <span className="font-bold text-tw-navy">{summary.lastMonth}</span>
            </div>
          </div>
        )}

        {/* زر التأكيد */}
        {fileData && !done && !importing && (
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: 'linear-gradient(145deg, #082765 0%, #005BFF 100%)',
              boxShadow: '0 4px 10px rgba(0,91,255,0.18)',
            }}
          >
            <Upload size={16} />
            تأكيد الاستيراد ({(fileData.sales.length + fileData.expenses.length).toLocaleString()} سجل)
          </button>
        )}

        {/* Progress bar */}
        {importing && (
          <div className="bg-white rounded-2xl shadow-sm border border-tw-line p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-tw-blue" />
              <div className="flex-1">
                <p className="text-sm font-bold text-tw-navy">
                  جارٍ الاستيراد...
                </p>
                <p className="text-[11px] text-tw-muted">
                  {progress.phase === 'sales' ? 'يكتب المبيعات' :
                   progress.phase === 'expenses' ? 'يكتب المصاريف' : 'يبدأ...'}
                </p>
              </div>
              <span className="text-sm font-bold text-tw-blue">
                {progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 bg-tw-soft rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #28DFFF 0%, #22D08A 100%)',
                }}
              />
            </div>
            <p className="text-[11px] text-tw-muted text-center">
              {progress.done} من {progress.total} سجل
            </p>
          </div>
        )}

        {/* رسالة النجاح */}
        {done && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} className="text-tw-green flex-shrink-0" />
              <div className="flex-1">
                <p className="text-base font-extrabold text-tw-green">تم الاستيراد بنجاح</p>
                <p className="text-xs text-tw-muted mt-1">
                  {done.salesImported} مبيعات + {done.expensesImported} مصاريف
                </p>
              </div>
            </div>
            {done.errors && done.errors.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                <p className="text-xs font-bold text-tw-orange mb-1">
                  ⚠️ {done.errors.length} خطأ أثناء الاستيراد
                </p>
                {done.errors.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-[11px] text-tw-muted">
                    {e.type === 'sales' ? 'مبيعات' : 'مصاريف'} (دفعة {e.batchStart}): {e.message}
                  </p>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                setDone(null);
                setFileData(null);
                setFileName('');
              }}
              className="w-full bg-white border border-tw-line text-tw-navy font-bold py-2.5 rounded-lg text-sm"
            >
              استيراد ملف آخر
            </button>
          </div>
        )}

        {/* رسالة الخطأ */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
            <X size={14} className="text-tw-red flex-shrink-0 mt-0.5" />
            <p className="text-xs text-tw-red font-bold">{error}</p>
          </div>
        )}
      </div>

      {/* Sheet اختيار الفرع */}
      <BottomSheet
        open={showBranchSheet}
        title="اختر الفرع"
        options={[
          { value: 'toia', label: 'فرع تويا' },
          { value: 'wardana', label: 'فرع وردانة' },
        ]}
        current={branchId}
        onPick={(v) => { setBranchId(v); setShowBranchSheet(false); }}
        onClose={() => setShowBranchSheet(false)}
      />

      {/* Sheet تأكيد الحذف */}
      <DeleteConfirmSheet
        open={showDeleteConfirm}
        title="حذف الاستيراد السابق؟"
        message={`سيتم حذف ${existingData?.sales || 0} مبيعات و ${existingData?.expenses || 0} مصاريف مستوردة من قبل لفرع ${branchId === 'toia' ? 'تويا' : 'وردانة'}. لن تتأثر السجلات المُدخلة يدوياً.`}
        confirmLabel="نعم، احذف"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

// ====================================================================
// مكوّن صغير: بطاقة إحصائية
// ====================================================================
function StatBox({ label, value, suffix, color = 'navy' }) {
  const colorClass = {
    green: 'text-tw-green',
    red: 'text-tw-red',
    navy: 'text-tw-navy',
  }[color] || 'text-tw-navy';
  
  return (
    <div className="bg-tw-soft/40 border border-tw-line/50 rounded-xl p-3 text-center">
      <p className="text-[10px] text-tw-muted font-bold mb-1">{label}</p>
      <p className={`text-base font-extrabold ${colorClass}`}>
        {Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}
        <span className="text-[9px] mr-1">{suffix}</span>
      </p>
    </div>
  );
}

// ====================================================================
// helper: حساب المجاميع من بيانات JSON
// ====================================================================
function computeSummary(data) {
  let totalGross = 0;
  let totalNet = 0;
  let totalExp = 0;
  const expByCategory = {};
  const monthsSet = new Set();
  
  for (const s of data.sales) {
    totalGross += Number(s.total) || 0;
    totalNet += Number(s.netTotal) || 0;
    if (s.date) monthsSet.add(s.date.substring(0, 7));
  }
  for (const e of data.expenses) {
    const amt = Number(e.amount) || 0;
    totalExp += amt;
    const cat = e.categoryName || 'غير محدد';
    expByCategory[cat] = (expByCategory[cat] || 0) + amt;
    if (e.date) monthsSet.add(e.date.substring(0, 7));
  }
  
  const months = [...monthsSet].sort();
  
  return {
    totalGross,
    totalNet,
    totalExp,
    profit: totalNet - totalExp,
    expByCategory,
    monthsCount: months.length,
    firstMonth: months[0] || '—',
    lastMonth: months[months.length - 1] || '—',
  };
}
