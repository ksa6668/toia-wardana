// src/components/ManagerBranches.jsx
// ----------------------------------------------------------
// شاشة إدارة الفروع للمدير
// Batch 6: التعديل أصبح Bottom Sheet مع رسالة للفرع الأساسي
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  ChevronRight, Plus, Store, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  getBranches, addBranch, updateBranch, deleteBranch,
} from '../firebase';
import EditSheet from './EditSheet';

// الفروع الأساسية لا يمكن حذفها
const PRIMARY_BRANCH_IDS = ['toia', 'wardana'];

export default function ManagerBranches({ onBack, lang = 'ar' }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  // form الإضافة
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [adding, setAdding] = useState(false);
  // وضع التحرير - في bottom sheet
  const [editingBranch, setEditingBranch] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getBranches();
      setBranches(data);
    } catch (err) {
      setError(err?.message || 'تعذّر تحميل الفروع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const showDoneMsg = (msg) => {
    setDone(msg);
    setTimeout(() => setDone(''), 2500);
  };

  const handleAdd = async () => {
    setError('');
    if (!newName.trim()) {
      setError(lang === 'en' ? 'Branch name required' : 'اسم الفرع مطلوب');
      return;
    }
    setAdding(true);
    try {
      await addBranch({
        name: newName.trim(),
        nameEn: newNameEn.trim(),
        order: branches.length + 1,
      });
      setNewName('');
      setNewNameEn('');
      setShowAdd(false);
      await reload();
      showDoneMsg(lang === 'en' ? 'Branch added' : 'تم إضافة الفرع');
    } catch (err) {
      setError(err?.message || 'تعذّر إضافة الفرع');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (branch) => {
    setEditingBranch(branch);
    setEditName(branch.name || '');
    setEditNameEn(branch.nameEn || '');
    setEditActive(branch.active !== false);
    setEditError('');
  };

  const closeEdit = () => {
    setEditingBranch(null);
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editingBranch) return;
    setEditError('');
    if (!editName.trim()) {
      setEditError(lang === 'en' ? 'Branch name required' : 'اسم الفرع مطلوب');
      return;
    }
    setSavingEdit(true);
    try {
      await updateBranch(editingBranch.id, {
        name: editName.trim(),
        nameEn: editNameEn.trim() || null,
        active: editActive,
      });
      await reload();
      closeEdit();
      showDoneMsg(lang === 'en' ? 'Branch updated' : 'تم تحديث الفرع');
    } catch (err) {
      setEditError(err?.message || 'تعذّر تحديث الفرع');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteFromEdit = async () => {
    if (!editingBranch) return;
    if (PRIMARY_BRANCH_IDS.includes(editingBranch.id)) {
      setEditError(lang === 'en'
        ? 'Primary branches cannot be deleted'
        : 'لا يمكن حذف الفروع الأساسية');
      return;
    }
    const confirmMsg = lang === 'en'
      ? `Disable branch "${editingBranch.name}"? Historical data will be preserved.`
      : `هل تريد تعطيل فرع "${editingBranch.name}"؟ ستُحفظ البيانات التاريخية.`;
    if (!window.confirm(confirmMsg)) return;
    setSavingEdit(true);
    setEditError('');
    try {
      await deleteBranch(editingBranch.id);
      await reload();
      closeEdit();
      showDoneMsg(lang === 'en' ? 'Branch disabled' : 'تم تعطيل الفرع');
    } catch (err) {
      setEditError(err?.message || 'تعذّر تعطيل الفرع');
    } finally {
      setSavingEdit(false);
    }
  };

  const isPrimaryEditing = editingBranch && PRIMARY_BRANCH_IDS.includes(editingBranch.id);

  return (
    <div
      className="min-h-full relative overflow-hidden pb-20"
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
      <div className="relative z-10 flex items-center p-4 border-b border-gray-100 bg-white/60 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="p-2 text-slate-600 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
        >
          <ChevronRight size={20} className={lang === 'en' ? '' : 'rotate-180'} />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-slate-800 px-8">
          {lang === 'en' ? 'Manage Branches' : 'إدارة الفروع'}
        </h2>
      </div>

      <div className="relative z-10 p-4 space-y-4">
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-slate-300" />
          </div>
        )}

        {error && (
          <p className="text-red-600 text-xs text-center bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </p>
        )}
        {done && (
          <p className="text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {done}
          </p>
        )}

        {!loading && (
          <>
            {/* قائمة الفروع */}
            {branches.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                <Store size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-500">
                  {lang === 'en' ? 'No branches yet' : 'لا توجد فروع بعد'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {branches.map((b, idx) => {
                  const isPrimary = PRIMARY_BRANCH_IDS.includes(b.id);
                  const isActive = b.active !== false;
                  return (
                    <button
                      key={b.id}
                      onClick={() => openEdit(b)}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors text-right ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                    >
                      {/* شارة الحالة */}
                      <div className={`text-xs font-bold ${isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {isActive
                          ? (lang === 'en' ? 'Active' : 'نشط')
                          : (lang === 'en' ? 'Disabled' : 'معطّل')}
                      </div>
                      {/* النص */}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-slate-800">{b.name}</p>
                        <p className="text-xs text-slate-500">
                          {isPrimary
                            ? (lang === 'en' ? 'Primary branch' : 'فرع أساسي')
                            : (b.nameEn || (lang === 'en' ? 'Custom branch' : 'فرع إضافي'))}
                        </p>
                      </div>
                      {/* أيقونة */}
                      <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <Store size={18} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* زر إضافة فرع جديد */}
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                  boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
                }}
              >
                <Plus size={18} />
                {lang === 'en' ? '+ Add New Branch' : '+ إضافة فرع'}
              </button>
            ) : (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-200 space-y-3">
                <h4 className="text-sm font-bold text-slate-800">
                  {lang === 'en' ? 'Add new branch' : 'إضافة فرع جديد'}
                </h4>
                <div>
                  <label className="text-xs text-gray-500 font-bold mb-1 block">
                    {lang === 'en' ? 'Name (Arabic)' : 'الاسم بالعربي'}
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={lang === 'en' ? 'e.g. Riyadh Branch' : 'مثلاً: فرع الرياض'}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold mb-1 block">
                    {lang === 'en' ? 'Name (English) - optional' : 'الاسم بالإنجليزي (اختياري)'}
                  </label>
                  <input
                    type="text"
                    value={newNameEn}
                    onChange={(e) => setNewNameEn(e.target.value)}
                    placeholder="e.g. Riyadh Branch"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
                    dir="ltr"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowAdd(false); setNewName(''); setNewNameEn(''); setError(''); }}
                    className="flex-1 bg-white border border-gray-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm"
                  >
                    {lang === 'en' ? 'Cancel' : 'إلغاء'}
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="flex-1 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)' }}
                  >
                    {adding && <Loader2 size={16} className="animate-spin" />}
                    {adding
                      ? (lang === 'en' ? 'Adding...' : 'جارٍ الإضافة...')
                      : (lang === 'en' ? 'Save' : 'حفظ')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Sheet لتعديل الفرع */}
      <EditSheet
        open={!!editingBranch}
        onClose={closeEdit}
        title={lang === 'en' ? 'Edit Branch' : 'تعديل الفرع'}
      >
        {editingBranch && (
          <div className="space-y-4">
            {/* رسالة الفرع الأساسي */}
            {isPrimaryEditing && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  هذا فرع أساسي — يمكن تعديل اسمه أو تعطيله، لكن لا يمكن حذفه.
                </p>
              </div>
            )}

            {/* اسم الفرع */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">
                {lang === 'en' ? 'Branch Name' : 'اسم الفرع'}
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            {/* الاسم بالإنجليزي */}
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">
                {lang === 'en' ? 'Name (English)' : 'الاسم بالإنجليزية (اختياري)'}
              </label>
              <input
                type="text"
                value={editNameEn}
                onChange={(e) => setEditNameEn(e.target.value)}
                placeholder="Toia Branch"
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-bold text-slate-800 outline-none focus:border-blue-500"
                dir="ltr"
              />
            </div>

            {/* الفرع نشط */}
            <button
              onClick={() => setEditActive(!editActive)}
              className="w-full bg-emerald-50 rounded-xl p-3.5 flex items-center justify-between border border-emerald-100 hover:bg-emerald-100 transition-colors"
            >
              <div className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${editActive ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${editActive ? 'translate-x-1' : 'translate-x-6'}`} />
              </div>
              <span className="text-sm font-bold text-slate-800">
                {lang === 'en' ? 'Branch Active' : 'الفرع نشط'}
              </span>
            </button>

            {editError && (
              <p className="text-red-600 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                {editError}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={closeEdit}
                disabled={savingEdit}
                className="flex-1 bg-white border border-gray-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 disabled:opacity-60"
              >
                {lang === 'en' ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 text-white font-bold py-3.5 rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                  boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
                }}
              >
                {savingEdit && <Loader2 size={16} className="animate-spin" />}
                {lang === 'en' ? 'Save' : 'حفظ'}
              </button>
            </div>

            {/* زر الحذف - فقط للفروع غير الأساسية */}
            {!isPrimaryEditing && (
              <button
                onClick={handleDeleteFromEdit}
                disabled={savingEdit}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3.5 rounded-xl border border-red-100 transition-colors disabled:opacity-60"
              >
                {lang === 'en' ? 'Delete Branch' : 'حذف الفرع'}
              </button>
            )}
          </div>
        )}
      </EditSheet>
    </div>
  );
}
