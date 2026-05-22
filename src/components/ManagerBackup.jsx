// src/components/ManagerBackup.jsx
// ----------------------------------------------------------
// النسخ الاحتياطي — مطابق لتصميم prototype:
//   1) ملاحظة استخدام (يفضّل سطح المكتب)
//   2) تصدير البيانات:
//      - نطاق التصدير (كل الفروع / فرع محدد)
//      - زر تصدير Excel
//      - زر تصدير JSON كامل
//   3) استيراد البيانات (طريقة + اختيار ملف)
//   4) إحصائيات البيانات (4 بطاقات)
//
// ⚠️ ملاحظات:
//   - تصدير Excel يتطلب `npm install xlsx`
//   - الاستيراد معطّل في الإنتاج (خطير على البيانات الحقيقية)
//   - JSON يحوي كل شيء بما فيها روابط الصور لكن ليس الصور نفسها
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  ChevronRight, Cloud, MapPin, FileText, AlertCircle, AlertTriangle,
  Loader2, CheckCircle2, Lightbulb,
} from 'lucide-react';
import { getBranches, getAllDataForBackup, getDataStats } from '../firebase';
import BottomSheet from './BottomSheet';

// بطاقة إحصائية واحدة
function StatCard({ value, label }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-tw-line shadow-sm flex flex-col items-center justify-center min-h-[90px]">
      <p className="text-2xl font-extrabold text-tw-blue mb-1">{value}</p>
      <p className="text-xs text-tw-muted font-bold">{label}</p>
    </div>
  );
}

export default function ManagerBackup({ onBack, lang = 'ar' }) {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [branches, setBranches] = useState([]);
  // نطاق التصدير: 'all' أو branchId محدد
  const [exportScope, setExportScope] = useState('all');
  // إحصائيات
  const [stats, setStats] = useState({ sales: 0, expenses: 0, branches: 0, users: 0, categories: 0 });
  // طريقة الاستيراد
  const [importMode, setImportMode] = useState('replace'); // 'replace' فقط حالياً
  // قائمة منبثقة
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [brs, st] = await Promise.all([getBranches(), getDataStats()]);
        if (cancelled) return;
        setBranches(brs);
        setStats(st);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر تحميل البيانات');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showMsg = (msg) => {
    setDone(msg);
    setTimeout(() => setDone(''), 3000);
  };

  // تنزيل ملف من string
  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // تصدير JSON كامل (يشمل كل شيء)
  const handleExportJSON = async () => {
    setError('');
    setExporting(true);
    try {
      const data = await getAllDataForBackup();
      // فلترة حسب النطاق المحدد
      let filtered = data;
      if (exportScope !== 'all') {
        filtered = {
          ...data,
          sales: data.sales.filter((s) => s.branchId === exportScope),
          expenses: data.expenses.filter((e) => e.branchId === exportScope),
          branches: data.branches.filter((b) => b.id === exportScope),
        };
      }
      const json = JSON.stringify(filtered, null, 2);
      const date = new Date().toISOString().slice(0, 10);
      const scopeStr = exportScope === 'all' ? 'all' : exportScope;
      downloadFile(
        json,
        `toia-wardana-backup-${scopeStr}-${date}.json`,
        'application/json'
      );
      showMsg(lang === 'en' ? 'JSON backup downloaded' : 'تم تنزيل نسخة JSON');
    } catch (err) {
      setError(err?.message || 'تعذّر التصدير');
    } finally {
      setExporting(false);
    }
  };

  // تصدير Excel — يحتاج xlsx package
  const handleExportExcel = async () => {
    setError('');
    setExporting(true);
    try {
      // dynamic import — لو ما فيه xlsx، نعرض رسالة
      let XLSX;
      try {
        XLSX = await import('xlsx');
      } catch {
        setError(
          lang === 'en'
            ? 'Excel export requires xlsx package. Run: npm install xlsx'
            : 'تصدير Excel يحتاج تثبيت حزمة xlsx. شغّل: npm install xlsx'
        );
        setExporting(false);
        return;
      }
      const data = await getAllDataForBackup();
      // فلترة حسب النطاق
      const sales = exportScope === 'all'
        ? data.sales
        : data.sales.filter((s) => s.branchId === exportScope);
      const expenses = exportScope === 'all'
        ? data.expenses
        : data.expenses.filter((e) => e.branchId === exportScope);

      // إعداد الـ workbook
      const wb = XLSX.utils.book_new();
      // sheet المبيعات
      const salesSheet = XLSX.utils.json_to_sheet(
        sales.map((s) => ({
          date: s.date,
          branchId: s.branchId,
          cash: s.cash,
          mada: s.mada,
          transfer: s.transfer,
          total: s.total,
        }))
      );
      XLSX.utils.book_append_sheet(wb, salesSheet, 'Sales');
      // sheet المصاريف
      const expSheet = XLSX.utils.json_to_sheet(
        expenses.map((e) => ({
          date: e.date,
          branchId: e.branchId,
          category: e.categoryName || e.category,
          expenseType: e.expenseType,
          amount: e.amount,
          notes: e.notes,
          paymentMethod: e.paymentMethodId,
          invoiceUrl: e.invoiceUrl,
        }))
      );
      XLSX.utils.book_append_sheet(wb, expSheet, 'Expenses');
      // sheet الفروع والفئات (مرجعي)
      const branchesSheet = XLSX.utils.json_to_sheet(data.branches);
      XLSX.utils.book_append_sheet(wb, branchesSheet, 'Branches');
      const catsSheet = XLSX.utils.json_to_sheet(data.categories);
      XLSX.utils.book_append_sheet(wb, catsSheet, 'Categories');

      const date = new Date().toISOString().slice(0, 10);
      const scopeStr = exportScope === 'all' ? 'all' : exportScope;
      XLSX.writeFile(wb, `toia-wardana-${scopeStr}-${date}.xlsx`);
      showMsg(lang === 'en' ? 'Excel file downloaded' : 'تم تنزيل ملف Excel');
    } catch (err) {
      setError(err?.message || 'تعذّر تصدير Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    setError(
      lang === 'en'
        ? 'Import is disabled in production. Use Firestore Console to restore.'
        : 'الاستيراد معطّل في الإنتاج. استخدم Firestore Console للاستعادة.'
    );
    setTimeout(() => setError(''), 4000);
  };

  const openScopePicker = () => setSheet({
    title: lang === 'en' ? 'Export scope' : 'نطاق التصدير',
    options: [
      { value: 'all', label: lang === 'en' ? 'All branches' : 'كل الفروع' },
      ...branches.map((b) => ({
        value: b.id,
        label: lang === 'en' ? (b.nameEn || b.name) : (b.name.startsWith('فرع') ? b.name : `فرع ${b.name}`),
      })),
    ],
    current: exportScope,
    onPick: (v) => { setExportScope(v); setSheet(null); },
  });

  const scopeLabel = exportScope === 'all'
    ? (lang === 'en' ? 'All branches' : 'كل الفروع')
    : (() => {
        const b = branches.find((x) => x.id === exportScope);
        if (!b) return exportScope;
        return lang === 'en' ? (b.nameEn || b.name) : (b.name.startsWith('فرع') ? b.name : `فرع ${b.name}`);
      })();

  return (
    <div
      className="min-h-full relative overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      {/* شريط العنوان */}
      <div className="relative z-10 flex items-center p-4 border-b border-tw-line bg-white/60 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="p-2 text-tw-muted bg-tw-soft rounded-full hover:bg-slate-200 transition-colors"
        >
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-tw-navy px-8">
          {lang === 'en' ? 'Backup' : 'النسخ الاحتياطي'}
        </h2>
      </div>

      {/* وصف */}
      <div className="relative z-10 px-4 pt-4 pb-2">
        <p className="text-xs text-tw-muted text-center">
          {lang === 'en'
            ? 'Export and import data by branch or all'
            : 'تصدير واستيراد البيانات بالفرع أو الكل'}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-tw-muted/70">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {!loading && (
        <div className="relative z-10 px-4 pb-8 space-y-5">
          {/* ملاحظة الاستخدام */}
          <div className="bg-tw-soft border border-tw-line rounded-2xl p-3 flex items-start gap-2">
            <Lightbulb size={18} className="text-tw-orange flex-shrink-0 mt-0.5" />
            <p className="text-xs text-tw-navy leading-relaxed">
              {lang === 'en'
                ? 'For best experience, use backup from desktop or directly from the browser (Chrome / Safari).'
                : 'للحصول على أفضل تجربة، استخدم النسخ الاحتياطي من سطح المكتب أو من المتصفح مباشرة (Chrome / Safari).'}
            </p>
          </div>

          {/* ============ تصدير البيانات ============ */}
          <div>
            <h4 className="text-sm font-bold text-tw-navy mb-1">
              {lang === 'en' ? 'Export Data' : 'تصدير البيانات'}
            </h4>
            <p className="text-xs text-tw-muted mb-3">
              {lang === 'en'
                ? 'Save a backup of all data on your device.'
                : 'حفظ نسخة احتياطية من جميع البيانات على جهازك.'}
            </p>

            {/* منتقي نطاق التصدير */}
            <div className="mb-3">
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">
                {lang === 'en' ? 'Export scope' : 'نطاق التصدير'}
              </label>
              <button
                onClick={openScopePicker}
                className="w-full flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <MapPin size={14} className="text-tw-blue" />
                <span className="font-bold text-sm text-tw-navy">{scopeLabel}</span>
              </button>
            </div>

            {/* زر تصدير Excel - أزرق فاتح gradient */}
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mb-3"
              style={{
                background: 'linear-gradient(135deg, #168BFF 0%, #005BFF 100%)',
                boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
              }}
            >
              <Cloud size={16} />
              {exporting && <Loader2 size={16} className="animate-spin" />}
              {lang === 'en' ? 'Export Excel file' : 'تصدير ملف Excel'}
            </button>

            {/* زر تصدير JSON - navy gradient */}
            <button
              onClick={handleExportJSON}
              disabled={exporting}
              className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #061742 0%, #082765 100%)',
                boxShadow: '0 6px 16px rgba(8, 39, 101, 0.25)',
              }}
            >
              <Cloud size={16} />
              {exporting && <Loader2 size={16} className="animate-spin" />}
              {lang === 'en' ? 'Export full backup (JSON)' : 'تصدير نسخة كاملة (JSON)'}
            </button>

            {/* تنبيه عن Excel vs JSON */}
            <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
              <AlertTriangle size={14} className="text-tw-orange flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-tw-navy leading-relaxed">
                {lang === 'en'
                  ? 'Excel file does not save invoice photos. For full backup use JSON.'
                  : 'ملف Excel لا يحفظ صور الفواتير. للنسخة الكاملة استخدم JSON.'}
              </p>
            </div>
          </div>

          {/* الرسائل */}
          {done && (
            <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
              <CheckCircle2 size={18} /> {done}
            </p>
          )}
          {error && (
            <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
              {error}
            </p>
          )}

          {/* ============ استيراد البيانات ============ */}
          <div className="border-t border-tw-line pt-5">
            <h4 className="text-sm font-bold text-tw-navy mb-1">
              {lang === 'en' ? 'Import Data' : 'استيراد البيانات'}
            </h4>
            <p className="text-xs text-tw-muted mb-3">
              {lang === 'en'
                ? 'Restore data from a backup file. Current data will be replaced.'
                : 'استعادة البيانات من ملف نسخة احتياطية. سيتم استبدال البيانات الحالية.'}
            </p>

            <div className="mb-3">
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">
                {lang === 'en' ? 'Import method' : 'طريقة الاستيراد'}
              </label>
              <div className="w-full flex items-center justify-center gap-2 bg-white border border-tw-line rounded-xl py-3 px-4 shadow-sm">
                <Cloud size={14} className="text-tw-blue" />
                <span className="font-bold text-sm text-tw-navy">
                  {lang === 'en' ? 'Replace current data' : 'استبدال البيانات الحالية'}
                </span>
              </div>
            </div>

            <button
              onClick={handleImportClick}
              className="w-full text-white font-bold py-3.5 rounded-xl bg-tw-red hover:bg-tw-red transition-colors flex items-center justify-center gap-2"
            >
              <FileText size={16} />
              {lang === 'en' ? 'Choose file' : 'اختيار ملف'}
            </button>

            <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2">
              <AlertTriangle size={14} className="text-tw-red flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-tw-navy leading-relaxed">
                {lang === 'en'
                  ? 'Warning: Import will completely replace current data.'
                  : 'تنبيه: الاستيراد سيستبدل البيانات الحالية بالكامل.'}
              </p>
            </div>
          </div>

          {/* ============ إحصائيات البيانات ============ */}
          <div className="border-t border-tw-line pt-5">
            <h4 className="text-sm font-bold text-tw-navy mb-3">
              {lang === 'en' ? 'Data Statistics' : 'إحصائيات البيانات'}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                value={stats.sales}
                label={lang === 'en' ? 'Sales' : 'مبيعات'}
              />
              <StatCard
                value={stats.expenses}
                label={lang === 'en' ? 'Expenses' : 'مصاريف'}
              />
              <StatCard
                value={stats.users}
                label={lang === 'en' ? 'Users' : 'مستخدمون'}
              />
              <StatCard
                value={stats.branches}
                label={lang === 'en' ? 'Branches' : 'فروع'}
              />
              <StatCard
                value={stats.categories}
                label={lang === 'en' ? 'Categories' : 'تصنيفات'}
              />
            </div>
          </div>
        </div>
      )}

      <BottomSheet
        open={!!sheet}
        title={sheet?.title}
        options={sheet?.options || []}
        current={sheet?.current}
        onPick={sheet?.onPick || (() => {})}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}
