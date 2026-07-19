// src/components/ManageUsers.jsx
// ----------------------------------------------------------
// شاشة إدارة المستخدمين (إضافة / تعديل / تعطيل / حذف / تغيير الرمز).
// مُستخرَجة من App.jsx.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Loader2, Users, Plus } from 'lucide-react';
import {
  getUsers, createStaffUser,
  setUserActive, adminChangeUserPin, adminDeleteUser, adminUpdateUserProfile,
} from '../firebase';
import { useScreenHeader } from '../context/ScreenCtx';
import { t, translateBranch } from '../i18n';
import EditSheet from './EditSheet';

export default function ManageUsers({ onBack, lang = 'ar' }) {
  // نفس نص label في ITEMS بشاشة الإعدادات (Batch 84)
  useScreenHeader(lang === 'en' ? 'Users & Permissions' : 'المستخدمون والصلاحيات', onBack);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Batch 6: edit modal state
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editRole, setEditRole] = useState('employee');
  const [editBranch, setEditBranch] = useState('toia');
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // حقول نموذج الإضافة
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('employee');
  const [branchId, setBranchId] = useState('toia');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(err?.message || (lang === 'en' ? 'Failed to load users' : 'تعذّر تحميل المستخدمين'));
    } finally {
      setLoading(false);
    }
  };

  // lang يُستخدم فقط لنص رسالة الخطأ — لا نعيد الجلب عند تبديل اللغة
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadUsers(); }, []);

  // فتح modal التعديل لمستخدم
  const openEdit = (u) => {
    setEditingUser(u);
    setEditName(u.displayName || u.username || '');
    setEditPin(''); // فارغ = لا تغيير
    setEditRole(u.role || 'employee');
    setEditBranch(u.branchId || 'toia');
    setEditActive(u.active !== false);
    setEditError('');
  };

  const closeEdit = () => {
    setEditingUser(null);
    setEditError('');
  };

  // حفظ تعديلات المستخدم
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditError('');
    if (!editName.trim()) {
      setEditError(lang === 'en' ? 'Enter the name' : 'أدخل اسم المستخدم');
      return;
    }
    if (editPin && !/^\d{4}$/.test(editPin)) {
      setEditError(lang === 'en'
        ? 'PIN must be 4 digits (or leave it empty to keep it unchanged)'
        : 'كلمة المرور يجب أن تكون 4 أرقام (أو اتركها فارغة لعدم التغيير)');
      return;
    }
    setEditSaving(true);
    try {
      // 1) تحديث الملف الشخصي (اسم/دور/فرع)
      await adminUpdateUserProfile(editingUser.uid, {
        displayName: editName.trim(),
        role: editRole,
        branchId: editBranch,
      });
      // 2) تحديث الحالة (نشط/معطّل) إذا تغيّرت
      const currentActive = editingUser.active !== false;
      if (currentActive !== editActive) {
        await setUserActive(editingUser.uid, editActive);
      }
      // 3) تغيير كلمة المرور إذا أُدخلت
      if (editPin) {
        await adminChangeUserPin(editingUser.uid, editPin);
      }
      await loadUsers();
      closeEdit();
    } catch (err) {
      setEditError(err?.message || (lang === 'en' ? 'Save failed' : 'تعذّر الحفظ'));
    } finally {
      setEditSaving(false);
    }
  };

  // حذف من داخل modal التعديل
  const handleDeleteFromEdit = async () => {
    if (!editingUser) return;
    const uName = editingUser.displayName || editingUser.username;
    if (!confirm(lang === 'en'
      ? `Permanently delete user "${uName}"? This cannot be undone.`
      : `حذف نهائي لمستخدم "${uName}"؟ لا يمكن التراجع.`)) return;
    setEditSaving(true);
    setEditError('');
    try {
      await adminDeleteUser(editingUser.uid);
      await loadUsers();
      closeEdit();
    } catch (err) {
      setEditError(err?.message || (lang === 'en' ? 'Delete failed' : 'تعذّر الحذف'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    if (!username.trim()) { setError(lang === 'en' ? 'Enter the username' : 'أدخل اسم المستخدم'); return; }
    if (!/^\d{4}$/.test(pin)) { setError(t(lang, 'login.err.pin')); return; }
    setSaving(true);
    try {
      await createStaffUser({ username, pin, role, branchId, displayName });
      setUsername(''); setPin(''); setDisplayName('');
      setRole('employee'); setBranchId('toia');
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('email-already-in-use')) setError(lang === 'en' ? 'Username already taken' : 'اسم المستخدم مستخدم مسبقاً');
      else setError(err?.message || (lang === 'en' ? 'Failed to create user' : 'تعذّر إنشاء المستخدم'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-full relative overflow-hidden pb-20"
      style={{
        background: 'var(--color-page-background)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >

      <div className="relative z-10 p-4 space-y-3">
        {/* form إضافة مستخدم */}
        {showForm && (
          <div className="bg-white border border-tw-blue/30 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="font-bold text-sm text-tw-navy">{lang === 'en' ? 'New user' : 'مستخدم جديد'}</h3>
            <input type="text" placeholder={lang === 'en' ? 'Username (English)' : 'اسم المستخدم (إنجليزي)'} value={username}
              onChange={(e) => setUsername(e.target.value)} autoCapitalize="off"
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue" />
            <input type="text" placeholder={lang === 'en' ? 'Display name' : 'الاسم الظاهر'} value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue" />
            <input type="password" inputMode="numeric" maxLength={4} placeholder={lang === 'en' ? 'PIN (4 digits)' : 'الرمز (4 أرقام)'} value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue text-center tracking-[0.4em] font-mono" />
            <div className="flex gap-2">
              {[
                { v: 'employee', t: lang === 'en' ? 'Employee' : 'موظف' },
                { v: 'admin', t: lang === 'en' ? 'Manager' : 'مدير' },
              ].map((r) => (
                <button key={r.v} onClick={() => setRole(r.v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border ${role === r.v ? 'bg-tw-blue text-white border-blue-600' : 'bg-tw-soft/40 text-tw-muted border-tw-line'}`}>
                  {r.t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {[
                { v: 'toia', t: translateBranch(lang, 'toia') },
                { v: 'wardana', t: translateBranch(lang, 'wardana') },
              ].map((b) => (
                <button key={b.v} onClick={() => setBranchId(b.v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border ${branchId === b.v ? 'bg-slate-800 text-white border-slate-800' : 'bg-tw-soft/40 text-tw-muted border-tw-line'}`}>
                  {b.t}
                </button>
              ))}
            </div>
            {error && <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-2 text-center">{error}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowForm(false); setError(''); }}
                className="flex-1 bg-white border border-tw-line text-tw-muted font-bold py-2.5 rounded-xl text-sm">
                {lang === 'en' ? 'Cancel' : 'إلغاء'}
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)' }}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? (lang === 'en' ? 'Saving...' : 'جارٍ...') : (lang === 'en' ? 'Save' : 'حفظ')}
              </button>
            </div>
            <p className="text-[10px] text-tw-orange bg-amber-50 rounded-lg p-2 text-center">
              {lang === 'en'
                ? 'Note: after saving you will be signed in as the new account. Sign out, then sign back in with your own account.'
                : 'ملاحظة: بعد الحفظ سيُسجَّل دخولك بالحساب الجديد. سجّل خروج ثم ادخل بحسابك من جديد.'}
            </p>
          </div>
        )}

        {!showForm && error && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-tw-muted/50" /></div>
        ) : (
          <>
            {/* قائمة المستخدمين بتصميم prototype - كل صف قابل للضغط لفتح modal التعديل */}
            <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
              {users.map((u, idx) => (
                <button
                  key={u.uid}
                  onClick={() => openEdit(u)}
                  className={`w-full p-4 flex items-center gap-3 ${lang === 'en' ? 'text-left' : 'text-right'} hover:bg-tw-soft/40 transition-colors ${idx > 0 ? 'border-t border-tw-line/60' : ''}`}
                >
                  {/* الأيقونة قبل الاسم (في RTL تظهر يمين، بجانب الاسم) */}
                  <div className="w-12 h-12 rounded-2xl bg-tw-soft text-tw-blue flex items-center justify-center flex-shrink-0">
                    <Users size={20} />
                  </div>
                  {/* النص في المنتصف */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-tw-navy truncate">
                      {u.displayName || u.username}
                    </p>
                    <p className="text-xs text-tw-muted truncate">
                      {u.role === 'admin'
                        ? (lang === 'en' ? 'Manager' : 'مدير')
                        : (lang === 'en' ? 'Employee' : 'موظف')}
                      {' — '}
                      {u.branchId === 'wardana'
                        ? (lang === 'en' ? 'Wardana branch' : 'فرع وردانة')
                        : u.branchId === 'toia'
                          ? (lang === 'en' ? 'Toia branch' : 'فرع تويا')
                          : (lang === 'en' ? 'All' : 'الكل')}
                    </p>
                  </div>
                  {/* شارة الحالة على أقصى اليسار (في RTL = آخر DOM element) */}
                  <div className={`text-xs font-bold flex-shrink-0 px-2.5 py-1 rounded-full ${
                    u.active === false
                      ? 'bg-gray-100 text-tw-muted/70'
                      : 'bg-emerald-50 text-tw-green'
                  }`}>
                    {u.active === false
                      ? (lang === 'en' ? 'Disabled' : 'معطّل')
                      : (lang === 'en' ? 'Active' : 'نشط')}
                  </div>
                </button>
              ))}
            </div>

            {/* زر إضافة مستخدم — gradient navy في الأسفل */}
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                  boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
                }}>
                <Plus size={18} /> {lang === 'en' ? '+ Add user' : '+ إضافة مستخدم'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Batch 6: Bottom Sheet لتعديل المستخدم */}
      <EditSheet open={!!editingUser} onClose={closeEdit} title={lang === 'en' ? 'Edit user' : 'تعديل المستخدم'}>
        {editingUser && (
          <div className="space-y-4">
            {/* الاسم */}
            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">{lang === 'en' ? 'Name' : 'الاسم'}</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-3.5 bg-tw-soft/40 border border-tw-line rounded-xl text-base font-bold text-tw-navy outline-none focus:border-tw-blue"
              />
            </div>

            {/* كلمة المرور */}
            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">
                {lang === 'en' ? 'PIN' : 'كلمة المرور'}{' '}
                <span className="font-normal text-tw-muted/70">
                  {lang === 'en' ? '(leave empty to keep unchanged)' : '(اتركها فارغة لعدم التغيير)'}
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={editPin}
                onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                className="w-full p-3.5 bg-tw-soft/40 border border-tw-line rounded-xl text-base font-bold text-tw-navy text-center tracking-[0.4em] font-mono outline-none focus:border-tw-blue"
              />
            </div>

            {/* الدور */}
            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">{lang === 'en' ? 'Role' : 'الدور'}</label>
              <div className="flex gap-2">
                {[
                  { v: 'admin', t: lang === 'en' ? 'Manager' : 'مدير' },
                  { v: 'employee', t: lang === 'en' ? 'Employee' : 'موظف' },
                ].map((r) => (
                  <button
                    key={r.v}
                    onClick={() => setEditRole(r.v)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${
                      editRole === r.v
                        ? 'bg-tw-blue text-white border-blue-600'
                        : 'bg-tw-soft/40 text-tw-muted border-tw-line hover:bg-tw-soft'
                    }`}
                  >
                    {r.t}
                  </button>
                ))}
              </div>
            </div>

            {/* الفرع */}
            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">{lang === 'en' ? 'Branch' : 'الفرع'}</label>
              <div className="flex gap-2">
                {[
                  { v: 'all', t: lang === 'en' ? 'All' : 'الكل' },
                  { v: 'toia', t: lang === 'en' ? 'Toia branch' : 'فرع تويا' },
                  { v: 'wardana', t: lang === 'en' ? 'Wardana branch' : 'فرع وردانة' },
                ].map((b) => (
                  <button
                    key={b.v}
                    onClick={() => setEditBranch(b.v)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${
                      editBranch === b.v
                        ? 'bg-tw-blue text-white border-blue-600'
                        : 'bg-tw-soft/40 text-tw-muted border-tw-line hover:bg-tw-soft'
                    }`}
                  >
                    {b.t}
                  </button>
                ))}
              </div>
            </div>

            {/* المستخدم نشط toggle */}
            <button
              onClick={() => setEditActive(!editActive)}
              className="w-full bg-emerald-50 rounded-xl p-3.5 flex items-center justify-between border border-emerald-100 hover:bg-emerald-100 transition-colors"
            >
              <div className={`relative w-12 h-6 rounded-full transition-colors ${editActive ? 'bg-tw-green' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${editActive ? 'right-0.5' : 'right-[26px]'}`} />
              </div>
              <span className="text-sm font-bold text-tw-navy">{lang === 'en' ? 'User is active' : 'المستخدم نشط'}</span>
            </button>

            {/* رسالة الخطأ */}
            {editError && (
              <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">
                {editError}
              </p>
            )}

            {/* أزرار الحفظ والإلغاء */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={closeEdit}
                disabled={editSaving}
                className="flex-1 bg-white border border-tw-line text-tw-navy font-bold py-3.5 rounded-xl hover:bg-tw-soft/40 disabled:opacity-60"
              >
                {lang === 'en' ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="flex-1 text-white font-bold py-3.5 rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                  boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
                }}
              >
                {editSaving && <Loader2 size={16} className="animate-spin" />}
                {lang === 'en' ? 'Save' : 'حفظ'}
              </button>
            </div>

            {/* زر حذف المستخدم */}
            <button
              onClick={handleDeleteFromEdit}
              disabled={editSaving}
              className="w-full bg-red-50 hover:bg-red-50 text-tw-red font-bold py-3.5 rounded-xl border border-red-100 transition-colors disabled:opacity-60"
            >
              {lang === 'en' ? 'Delete user' : 'حذف المستخدم'}
            </button>
          </div>
        )}
      </EditSheet>
    </div>
  );
}
