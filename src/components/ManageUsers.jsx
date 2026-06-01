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
import EditSheet from './EditSheet';

export default function ManageUsers({ onBack }) {
  useScreenHeader('المستخدمون والصلاحيات', onBack);
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
      setError(err?.message || 'تعذّر تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

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
      setEditError('أدخل اسم المستخدم');
      return;
    }
    if (editPin && !/^\d{4}$/.test(editPin)) {
      setEditError('كلمة المرور يجب أن تكون 4 أرقام (أو اتركها فارغة لعدم التغيير)');
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
      setEditError(err?.message || 'تعذّر الحفظ');
    } finally {
      setEditSaving(false);
    }
  };

  // حذف من داخل modal التعديل
  const handleDeleteFromEdit = async () => {
    if (!editingUser) return;
    if (!confirm(`حذف نهائي لمستخدم "${editingUser.displayName || editingUser.username}"؟ لا يمكن التراجع.`)) return;
    setEditSaving(true);
    setEditError('');
    try {
      await adminDeleteUser(editingUser.uid);
      await loadUsers();
      closeEdit();
    } catch (err) {
      setEditError(err?.message || 'تعذّر الحذف');
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    if (!username.trim()) { setError('أدخل اسم المستخدم'); return; }
    if (!/^\d{4}$/.test(pin)) { setError('الرمز يجب أن يكون 4 أرقام'); return; }
    setSaving(true);
    try {
      await createStaffUser({ username, pin, role, branchId, displayName });
      setUsername(''); setPin(''); setDisplayName('');
      setRole('employee'); setBranchId('toia');
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('email-already-in-use')) setError('اسم المستخدم مستخدم مسبقاً');
      else setError(err?.message || 'تعذّر إنشاء المستخدم');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="min-h-full relative overflow-hidden pb-20"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />

      <div className="relative z-10 p-4 space-y-3">
        {/* form إضافة مستخدم */}
        {showForm && (
          <div className="bg-white border border-tw-blue/30 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="font-bold text-sm text-tw-navy">مستخدم جديد</h3>
            <input type="text" placeholder="اسم المستخدم (إنجليزي)" value={username}
              onChange={(e) => setUsername(e.target.value)} autoCapitalize="off"
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue" />
            <input type="text" placeholder="الاسم الظاهر" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue" />
            <input type="password" inputMode="numeric" maxLength={4} placeholder="الرمز (4 أرقام)" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue text-center tracking-[0.4em] font-mono" />
            <div className="flex gap-2">
              {[{ v: 'employee', t: 'موظف' }, { v: 'admin', t: 'مدير' }].map((r) => (
                <button key={r.v} onClick={() => setRole(r.v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border ${role === r.v ? 'bg-tw-blue text-white border-blue-600' : 'bg-tw-soft/40 text-tw-muted border-tw-line'}`}>
                  {r.t}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {[{ v: 'toia', t: 'تويا' }, { v: 'wardana', t: 'وردانة' }].map((b) => (
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
                إلغاء
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)' }}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'جارٍ...' : 'حفظ'}
              </button>
            </div>
            <p className="text-[10px] text-tw-orange bg-amber-50 rounded-lg p-2 text-center">
              ملاحظة: بعد الحفظ سيُسجَّل دخولك بالحساب الجديد. سجّل خروج ثم ادخل بحسابك من جديد.
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
                  className={`w-full p-4 flex items-center gap-3 text-right hover:bg-tw-soft/40 transition-colors ${idx > 0 ? 'border-t border-tw-line/60' : ''}`}
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
                      {u.role === 'admin' ? 'مدير' : 'موظف'} — {u.branchId === 'wardana' ? 'فرع وردانة' : u.branchId === 'toia' ? 'فرع تويا' : 'الكل'}
                    </p>
                  </div>
                  {/* شارة الحالة على أقصى اليسار (في RTL = آخر DOM element) */}
                  <div className={`text-xs font-bold flex-shrink-0 px-2.5 py-1 rounded-full ${
                    u.active === false
                      ? 'bg-gray-100 text-tw-muted/70'
                      : 'bg-emerald-50 text-tw-green'
                  }`}>
                    {u.active === false ? 'معطّل' : 'نشط'}
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
                <Plus size={18} /> + إضافة مستخدم
              </button>
            )}
          </>
        )}
      </div>

      {/* Batch 6: Bottom Sheet لتعديل المستخدم */}
      <EditSheet open={!!editingUser} onClose={closeEdit} title="تعديل المستخدم">
        {editingUser && (
          <div className="space-y-4">
            {/* الاسم */}
            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">الاسم</label>
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
                كلمة المرور <span className="font-normal text-tw-muted/70">(اتركها فارغة لعدم التغيير)</span>
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
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">الدور</label>
              <div className="flex gap-2">
                {[
                  { v: 'admin', t: 'مدير' },
                  { v: 'employee', t: 'موظف' },
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
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">الفرع</label>
              <div className="flex gap-2">
                {[
                  { v: 'all', t: 'الكل' },
                  { v: 'toia', t: 'فرع تويا' },
                  { v: 'wardana', t: 'فرع وردانة' },
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
              <span className="text-sm font-bold text-tw-navy">المستخدم نشط</span>
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
                إلغاء
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
                حفظ
              </button>
            </div>

            {/* زر حذف المستخدم */}
            <button
              onClick={handleDeleteFromEdit}
              disabled={editSaving}
              className="w-full bg-red-50 hover:bg-red-50 text-tw-red font-bold py-3.5 rounded-xl border border-red-100 transition-colors disabled:opacity-60"
            >
              حذف المستخدم
            </button>
          </div>
        )}
      </EditSheet>
    </div>
  );
}
