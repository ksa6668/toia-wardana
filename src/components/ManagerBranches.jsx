// src/components/ManagerBranches.jsx
// ----------------------------------------------------------
// شاشة إدارة الفروع للمدير
// مطابقة لتصميم section#screen-branches في الـ prototype.
//
// تعرض:
//   1) قائمة بالفروع الحالية مع زر تعطيل
//   2) form لإضافة فرع جديد (اسم بالعربي + اسم بالإنجليزي)
//
// ⚠️ ملاحظة: حذف الفرع = تعطيله (active=false) للحفاظ على البيانات التاريخية
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  ChevronRight, Plus, Store, Loader2, CheckCircle2, Trash2, Edit3, X,
} from 'lucide-react';
import {
  getBranches, addBranch, updateBranch, deleteBranch,
} from '../firebase';

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
  // وضع التحرير
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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

  const handleStartEdit = (branch) => {
    setEditingId(branch.id);
    setEditName(branch.name || '');
    setEditNameEn(branch.nameEn || '');
    setError('');
  };

  const handleSaveEdit = async () => {
    setError('');
    if (!editName.trim()) {
      setError(lang === 'en' ? 'Branch name required' : 'اسم الفرع مطلوب');
      return;
    }
    setSavingEdit(true);
    try {
      await updateBranch(editingId, {
        name: editName.trim(),
        nameEn: editNameEn.trim() || null,
      });
      setEditingId(null);
      await reload();
      showDoneMsg(lang === 'en' ? 'Branch updated' : 'تم تحديث الفرع');
    } catch (err) {
      setError(err?.message || 'تعذّر تحديث الفرع');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (branch) => {
    const confirmMsg = lang === 'en'
      ? `Disable branch "${branch.name}"? Historical data will be preserved.`
      : `هل تريد تعطيل فرع "${branch.name}"؟ ستُحفظ البيانات التاريخية.`;
    if (!window.confirm(confirmMsg)) return;
    setError('');
    try {
      await deleteBranch(branch.id);
      await reload();
      showDoneMsg(lang === 'en' ? 'Branch disabled' : 'تم تعطيل الفرع');
    } catch (err) {
      setError(err?.message || 'تعذّر تعطيل الفرع');
    }
  };

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

      <div className="relative z-10 p-4 space-y-3 pb-8">
        {loading && (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="animate-spin" size={24} />
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
                {branches.map((b) => (
                  <div key={b.id} className="border-b border-gray-50 last:border-0">
                    {editingId === b.id ? (
                      /* وضع التحرير */
                      <div className="p-4 bg-blue-50/30 space-y-3">
                        <div>
                          <label className="text-xs text-gray-500 font-bold mb-1 block">
                            {lang === 'en' ? 'Name (Arabic)' : 'الاسم بالعربي'}
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-bold mb-1 block">
                            {lang === 'en' ? 'Name (English)' : 'الاسم بالإنجليزي'}
                          </label>
                          <input
                            type="text"
                            value={editNameEn}
                            onChange={(e) => setEditNameEn(e.target.value)}
                            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500"
                            dir="ltr"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 bg-white border border-gray-200 text-slate-700 font-bold py-2.5 rounded-lg text-xs hover:bg-gray-50"
                          >
                            {lang === 'en' ? 'Cancel' : 'إلغاء'}
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={savingEdit}
                            className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-lg text-xs hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-1"
                          >
                            {savingEdit && <Loader2 size={14} className="animate-spin" />}
                            {lang === 'en' ? 'Save' : 'حفظ'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* وضع العرض */
                      <div className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <Store size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">{b.name}</p>
                          {b.nameEn && (
                            <p className="text-xs text-gray-500" dir="ltr">{b.nameEn}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleStartEdit(b)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title={lang === 'en' ? 'Edit' : 'تعديل'}
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          title={lang === 'en' ? 'Disable' : 'تعطيل'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* form إضافة فرع جديد */}
            {showAdd ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800">
                    {lang === 'en' ? 'Add new branch' : 'إضافة فرع جديد'}
                  </h4>
                  <button
                    onClick={() => { setShowAdd(false); setNewName(''); setNewNameEn(''); setError(''); }}
                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
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
                <button
                  onClick={handleAdd}
                  disabled={adding}
                  className="w-full text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                  }}
                >
                  {adding && <Loader2 size={16} className="animate-spin" />}
                  {adding
                    ? (lang === 'en' ? 'Adding...' : 'جارٍ الإضافة...')
                    : (lang === 'en' ? 'Add Branch' : 'إضافة الفرع')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 text-blue-700 font-bold text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                {lang === 'en' ? 'Add New Branch' : 'إضافة فرع جديد'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
