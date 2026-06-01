// src/components/AdminDataEntry.jsx
// ----------------------------------------------------------
// شاشة "المبيعات والمصروفات" للمدير (Batch 12).
// - بدون شاشة اختيار فرع منفصلة
// - يفتح مباشرة على شاشة الزرّين + قائمة آخر 7 أيام
// - فرع تويا افتراضياً (للمدير)
// - الفرع يُغيَّر من داخل النماذج عبر pill قابل للنقر → bottom sheet
// - كل سطر في القائمة فيه ✎ تعديل + 🗑 حذف (للمدير فقط)
// مُستخرَجة من App.jsx.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { TrendingUp, Receipt, MapPin, ChevronDown } from 'lucide-react';
import { getBranches, deleteDailySales, deleteExpense } from '../firebase';
import { useScreenHeader } from '../context/ScreenCtx';
import SalesFormV2 from './SalesFormV2';
import ExpenseFormV2 from './ExpenseFormV2';
import RecHistorySection from './RecHistorySection';
import DeleteConfirmSheet from './DeleteConfirmSheet';
import BottomSheet from './BottomSheet';

export default function AdminDataEntry({ onBack, pendingEditRecord = null, onPendingConsumed }) {
  const [step, setStep] = useState('home');
  // Batch 41: نُجبر إعادة تسجيل الـ header عند تغيّر step
  // (عند العودة لـ home بعد فتح salesForm، الـ ctx يكون null)
  const headerTitle = step === 'home' ? 'المبيعات والمصاريف' : null;
  useScreenHeader(headerTitle, onBack);

  const [chosenBranch, setChosenBranch] = useState('all');
  // Batch 41: branchSheetOpen لـ شاشة home (اختيار فرع للسجل)
  const [homeBranchSheetOpen, setHomeBranchSheetOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deletingRecord, setDeletingRecord] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
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
  }, []);

  const branchName = branches.find((b) => b.id === chosenBranch)?.name
    || (chosenBranch === 'wardana' ? 'وردانة' : 'تويا');

  const setView = (v) => {
    if (v === 'salesForm' || v === 'expenseForm') {
      // Batch 41: لو 'all' (افتراضي للمدير)، نختار توياً عند فتح النموذج
      // المستخدم يقدر يغيّره من البـ pill داخل النموذج
      if (chosenBranch === 'all') setChosenBranch('toia');
      setStep(v);
    }
    else if (v === 'employeeHome' || v === 'home') {
      setStep('home');
      setEditingRecord(null);
      setRefreshKey((k) => k + 1);
    }
  };

  const handleBranchChange = (newBranchId) => {
    setChosenBranch(newBranchId);
  };

  const handleEdit = (entry) => {
    setEditingRecord(entry);
    // Batch 41: لو السجل من فرع مختلف عن المختار حالياً، نُحدّث chosenBranch
    // ليتطابق مع السجل الذي يُعدَّل (مهم عند "كل الفروع")
    if (entry.branchId && entry.branchId !== chosenBranch) {
      setChosenBranch(entry.branchId);
    }
    if (entry.kind === 'sale') setStep('editSalesForm');
    else setStep('editExpenseForm');
  };

  // Batch 51: عند تمرير سجل معلّق للتعديل من خارج (شاشة الكشف)، نفتحه فوراً
  useEffect(() => {
    if (pendingEditRecord) {
      handleEdit(pendingEditRecord);
      onPendingConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditRecord]);

  const handleDeleteRequest = (entry) => {
    setDeleteError('');
    setDeletingRecord(entry);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRecord) return;
    setDeleteError('');
    try {
      if (deletingRecord.kind === 'sale') {
        await deleteDailySales(deletingRecord.id);
      } else {
        await deleteExpense(deletingRecord.id);
      }
      setDeletingRecord(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setDeleteError(err?.message || 'تعذّر الحذف');
      throw err;
    }
  };

  if (step === 'home') {
    return (
      <>
        <div className="flex flex-col h-full tw-page-bg">
          <div
            className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
          />

          <div className="relative z-10 flex-1 overflow-y-auto p-4 pb-24">
            {/* Batch 41: pill اختيار الفرع لتصفية سجل آخر 7 أيام */}
            <button
              type="button"
              onClick={() => setHomeBranchSheetOpen(true)}
              className="tw-pill"
              style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}
            >
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-tw-blue" />
                <span style={{ fontWeight: 800, fontSize: 13 }}>
                  {chosenBranch === 'all' ? 'كل الفروع' : `فرع ${branchName}`}
                </span>
              </span>
              <ChevronDown size={14} className="text-tw-muted/70" />
            </button>

            <div
              className="tw-card tw-action"
              onClick={() => setView('salesForm')}
              role="button"
              tabIndex={0}
              style={{ marginBottom: 10 }}
            >
              <div className="tw-action-icon">
                <TrendingUp />
              </div>
              <div>
                <h4>تسجيل المبيعات</h4>
                <p>إجمالي المبيعات اليومية</p>
              </div>
              <div className="arrow">‹</div>
            </div>

            <div
              className="tw-card tw-action"
              onClick={() => setView('expenseForm')}
              role="button"
              tabIndex={0}
              style={{ marginBottom: 10 }}
            >
              <div className="tw-action-icon">
                <Receipt />
              </div>
              <div>
                <h4>تسجيل المصروفات</h4>
                <p>فواتير ومصروفات أخرى</p>
              </div>
              <div className="arrow">‹</div>
            </div>

            <RecHistorySection
              branchId={chosenBranch}
              lang="ar"
              refreshKey={refreshKey}
              editable={true}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
            />

            {deleteError && (
              <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center mt-3">
                {deleteError}
              </p>
            )}
          </div>
        </div>

        <DeleteConfirmSheet
          open={!!deletingRecord}
          title={deletingRecord?.kind === 'sale' ? 'حذف هذه المبيعة؟' : 'حذف هذا المصروف؟'}
          message="لا يمكن التراجع عن هذا الإجراء."
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeletingRecord(null)}
          lang="ar"
        />

        {/* Batch 41: bottom sheet اختيار الفرع لتصفية سجل آخر 7 أيام */}
        <BottomSheet
          open={homeBranchSheetOpen}
          title="اختر الفرع"
          options={[
            { value: 'all', label: 'كل الفروع' },
            ...branches.map((b) => ({ value: b.id, label: b.name })),
          ]}
          current={chosenBranch}
          onPick={(v) => {
            setChosenBranch(v);
            setHomeBranchSheetOpen(false);
          }}
          onClose={() => setHomeBranchSheetOpen(false)}
        />
      </>
    );
  }

  if (step === 'salesForm' || step === 'editSalesForm') {
    return (
      <SalesFormV2
        setView={setView}
        branch={branchName}
        branchId={chosenBranch}
        lang="ar"
        allowBranchSwitch={true}
        onBranchChange={handleBranchChange}
        existingRecord={step === 'editSalesForm' ? editingRecord : null}
        onBack={() => setStep('home')}
      />
    );
  }

  if (step === 'expenseForm' || step === 'editExpenseForm') {
    return (
      <ExpenseFormV2
        setView={setView}
        branch={branchName}
        branchId={chosenBranch}
        lang="ar"
        allowBranchSwitch={true}
        onBranchChange={handleBranchChange}
        existingRecord={step === 'editExpenseForm' ? editingRecord : null}
        isAdmin={true}
        onBack={() => setStep('home')}
      />
    );
  }

  return null;
}
