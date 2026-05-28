// src/components/DayRecordsSheet.jsx
// ----------------------------------------------------------
// Batch 51: Bottom Sheet لعرض سجلات يوم معيّن من شاشة الكشف الشامل
// المدير يضغط على التاريخ في الجدول → يرى السجلات + يقدر يضغط تعديل
// ----------------------------------------------------------
import { useEffect } from 'react';
import { Pencil, TrendingUp, Receipt, X } from 'lucide-react';
import SarSymbol from './SarSymbol';
import SheetPortal from './SheetPortal';
import { formatDayShort } from '../utils/periodHelpers';
import { translateBranch, translateCategory } from '../i18n';

export default function DayRecordsSheet({
  date,
  sales = [],
  expenses = [],
  branches = [],
  lang = 'ar',
  onClose,
  onEditRecord,
}) {
  // إغلاق بزر Esc
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const branchName = (id) => {
    const found = branches.find((b) => b.id === id);
    if (found) return lang === 'en' ? (found.nameEn || found.name) : found.name;
    return translateBranch(lang, id) || id;
  };

  const dateLabel = formatDayShort(date, lang, true); // مع السنة دائماً للوضوح

  return (
    <SheetPortal>
      <div className="tw-sheet-overlay show" onClick={onClose} />
      <div className="tw-sheet-panel show" role="dialog" aria-modal="true" style={{ maxHeight: '85vh' }}>
        <div className="tw-sheet-grab" />

        {/* رأس الشيت */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-tw-navy">
            {lang === 'en' ? 'Day records' : 'سجلات اليوم'} - {dateLabel}
          </h3>
          <button onClick={onClose} className="tw-circle-btn" type="button">
            <X size={16} />
          </button>
        </div>

        <div style={{ maxHeight: 'calc(85vh - 90px)', overflowY: 'auto' }}>
          {/* قسم المبيعات */}
          {sales.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-tw-blue" />
                <h4 className="text-xs font-bold text-tw-navy">
                  {lang === 'en' ? 'Sales' : 'المبيعات'} ({sales.length})
                </h4>
              </div>
              {sales.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-tw-soft/40 rounded-xl p-3 mb-2 border border-tw-line"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-tw-navy mb-1">
                      {branchName(s.branchId)}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-tw-muted">
                      <span>{lang === 'en' ? 'Cash' : 'كاش'}: {Math.round(s.cash || 0).toLocaleString()}</span>
                      <span>{lang === 'en' ? 'Mada' : 'مدى'}: {Math.round(s.mada || 0).toLocaleString()}</span>
                      <span>{lang === 'en' ? 'Transfer' : 'تحويل'}: {Math.round(s.transfer || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onEditRecord({ ...s, kind: 'sale' })}
                    className="tw-circle-btn"
                    aria-label={lang === 'en' ? 'Edit' : 'تعديل'}
                    type="button"
                  >
                    <Pencil size={14} className="text-tw-blue" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* قسم المصاريف */}
          {expenses.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt size={14} className="text-tw-red" />
                <h4 className="text-xs font-bold text-tw-navy">
                  {lang === 'en' ? 'Expenses' : 'المصاريف'} ({expenses.length})
                </h4>
              </div>
              {expenses.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between bg-tw-soft/40 rounded-xl p-3 mb-2 border border-tw-line"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-tw-navy mb-0.5">
                      {translateCategory(lang, e.categoryId, e.categoryName) || (lang === 'en' ? 'Expense' : 'مصروف')}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-tw-muted">
                      <span>{branchName(e.branchId)}</span>
                      <span className="font-bold text-tw-red flex items-center gap-1">
                        {Math.round(e.amount || 0).toLocaleString()}
                        <SarSymbol className="text-[9px]" />
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => onEditRecord({ ...e, kind: 'expense' })}
                    className="tw-circle-btn"
                    aria-label={lang === 'en' ? 'Edit' : 'تعديل'}
                    type="button"
                  >
                    <Pencil size={14} className="text-tw-blue" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {sales.length === 0 && expenses.length === 0 && (
            <p className="text-center text-tw-muted text-xs py-6">
              {lang === 'en' ? 'No records for this day' : 'لا توجد سجلات لهذا اليوم'}
            </p>
          )}
        </div>
      </div>
    </SheetPortal>
  );
}
