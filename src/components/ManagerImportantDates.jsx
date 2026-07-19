// src/components/ManagerImportantDates.jsx
// ----------------------------------------------------------
// شاشة إدارة "تواريخ مهمة" للمدير — داخل الإعدادات.
// إضافة/تعديل/حذف مهام متكررة مرتبطة بفرع، يظهر لها تذكير في الرئيسية
// قبل موعدها بـ 7 أيام. (Batch 85: ثنائية اللغة عربي/إنجليزي.)
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import {
  Plus, CalendarClock, Loader2, CheckCircle2, CalendarDays,
} from 'lucide-react';
import {
  getBranches,
  getImportantDates,
  addImportantDate,
  updateImportantDate,
  deleteImportantDate,
  RECURRENCE_LABELS,
} from '../firebase';
import { importantDateStatus } from '../utils/importantDateStatus';
import EditSheet from './EditSheet';
import { useScreenHeader } from '../context/ScreenCtx';

const RECURRENCE_KEYS = ['monthly', 'quarterly', 'semiannual', 'yearly'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// أسماء الأشهر الميلادية — نبني التاريخ يدوياً لضمان التقويم الميلادي
// (toLocaleDateString('ar-SA') يستخدم التقويم الهجري افتراضياً).
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtDate(dateStr, lang = 'ar') {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = lang === 'en' ? MONTHS_EN : MONTHS_AR;
  return `${d} ${months[m - 1]} ${y}`;
}

// نفس نمط ManagerHome (Batch 78): بالإنجليزية nameEn إن وُجد، وبالعربية «فرع …»
function branchName(b, lang = 'ar') {
  if (!b) return '';
  if (lang === 'en') return b.nameEn || b.name || '';
  return b.name?.startsWith('فرع') ? b.name : `فرع ${b.name}`;
}

const inputCls =
  'w-full p-3.5 bg-tw-soft/40 border border-tw-line rounded-xl text-base font-bold text-tw-navy outline-none focus:border-tw-blue';

// زر اختيار (pill) — لاختيار الفرع/التكرار داخل النموذج (بدل BottomSheet لتجنّب تعارض z-index)
function PillButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
        active
          ? 'bg-tw-soft border-tw-blue text-tw-blue'
          : 'bg-white border-tw-line text-tw-navy hover:bg-tw-soft/40'
      }`}
    >
      {children}
    </button>
  );
}

// نموذج موحّد للإضافة والتعديل
function TaskForm({ value, onChange, branches, lang = 'ar' }) {
  return (
    <div className="space-y-4">
      {/* اسم المهمة */}
      <div>
        <label className="text-xs font-bold text-tw-muted mb-1.5 block">{lang === 'en' ? 'Task name' : 'اسم المهمة'}</label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={lang === 'en' ? 'e.g. Renew commercial registration' : 'مثلاً: تجديد السجل التجاري'}
          className={inputCls}
        />
      </div>

      {/* الفرع */}
      <div>
        <label className="text-xs font-bold text-tw-muted mb-1.5 block">{lang === 'en' ? 'Branch' : 'الفرع'}</label>
        <div className="flex flex-wrap gap-2">
          {branches.map((b) => (
            <PillButton
              key={b.id}
              active={value.branchId === b.id}
              onClick={() => onChange({ ...value, branchId: b.id })}
            >
              {branchName(b, lang)}
            </PillButton>
          ))}
        </div>
      </div>

      {/* تاريخ المهمة */}
      <div>
        <label className="text-xs font-bold text-tw-muted mb-1.5 block">{lang === 'en' ? 'Due date' : 'تاريخ المهمة'}</label>
        <input
          type="date"
          value={value.dueDate}
          onChange={(e) => onChange({ ...value, dueDate: e.target.value })}
          className={inputCls}
        />
      </div>

      {/* نوع التكرار */}
      <div>
        <label className="text-xs font-bold text-tw-muted mb-1.5 block">{lang === 'en' ? 'Recurrence' : 'نوع التكرار'}</label>
        <div className="grid grid-cols-2 gap-2">
          {RECURRENCE_KEYS.map((k) => (
            <PillButton
              key={k}
              active={value.recurrence === k}
              onClick={() => onChange({ ...value, recurrence: k })}
            >
              {RECURRENCE_LABELS[k][lang] || RECURRENCE_LABELS[k].ar}
            </PillButton>
          ))}
        </div>
      </div>

      {/* ملاحظات */}
      <div>
        <label className="text-xs font-bold text-tw-muted mb-1.5 block">{lang === 'en' ? 'Notes (optional)' : 'ملاحظات (اختياري)'}</label>
        <textarea
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={2}
          placeholder={lang === 'en' ? 'Any extra details' : 'أي تفاصيل إضافية'}
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  );
}

const EMPTY_FORM = { name: '', branchId: '', dueDate: todayStr(), recurrence: 'monthly', notes: '' };

export default function ManagerImportantDates({ onBack, lang = 'ar' }) {
  // نفس نص label في ITEMS بشاشة الإعدادات (Batch 85)
  useScreenHeader(lang === 'en' ? 'Important Dates' : 'تواريخ مهمة', onBack);
  const [tasks, setTasks] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  // إضافة
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // تعديل
  const [editing, setEditing] = useState(null); // المهمة قيد التعديل
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const [brs, list] = await Promise.all([getBranches(), getImportantDates()]);
      setBranches(brs);
      setTasks(list);
    } catch (err) {
      setError(err?.message || (lang === 'en' ? 'Failed to load data' : 'تعذّر تحميل البيانات'));
    } finally {
      setLoading(false);
    }
  };

  // lang يُستخدم فقط لنص رسالة الخطأ — لا نعيد الجلب عند تبديل اللغة
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, []);

  const showDoneMsg = (msg) => {
    setDone(msg);
    setTimeout(() => setDone(''), 2500);
  };

  // ----- إضافة -----
  const handleAdd = async () => {
    setAddError('');
    if (!addForm.name.trim()) { setAddError(lang === 'en' ? 'Task name is required' : 'اسم المهمة مطلوب'); return; }
    if (!addForm.branchId) { setAddError(lang === 'en' ? 'Pick a branch' : 'اختر الفرع'); return; }
    if (!addForm.dueDate) { setAddError(lang === 'en' ? 'Due date is required' : 'تاريخ المهمة مطلوب'); return; }
    setAdding(true);
    try {
      await addImportantDate(addForm);
      setShowAdd(false);
      setAddForm(EMPTY_FORM);
      await reload();
      showDoneMsg(lang === 'en' ? 'Task added' : 'تم إضافة المهمة');
    } catch (err) {
      setAddError(err?.message || (lang === 'en' ? 'Failed to add task' : 'تعذّر إضافة المهمة'));
    } finally {
      setAdding(false);
    }
  };

  // ----- تعديل -----
  const openEdit = (task) => {
    setEditing(task);
    setEditForm({
      name: task.name || '',
      branchId: task.branchId || '',
      dueDate: task.dueDate || todayStr(),
      recurrence: task.recurrence || 'monthly',
      notes: task.notes || '',
    });
    setEditError('');
  };
  const closeEdit = () => { setEditing(null); setEditError(''); };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setEditError('');
    if (!editForm.name.trim()) { setEditError(lang === 'en' ? 'Task name is required' : 'اسم المهمة مطلوب'); return; }
    if (!editForm.branchId) { setEditError(lang === 'en' ? 'Pick a branch' : 'اختر الفرع'); return; }
    if (!editForm.dueDate) { setEditError(lang === 'en' ? 'Due date is required' : 'تاريخ المهمة مطلوب'); return; }
    setSavingEdit(true);
    try {
      await updateImportantDate(editing.id, editForm);
      await reload();
      closeEdit();
      showDoneMsg(lang === 'en' ? 'Task updated' : 'تم تحديث المهمة');
    } catch (err) {
      setEditError(err?.message || (lang === 'en' ? 'Failed to update task' : 'تعذّر تحديث المهمة'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!window.confirm(lang === 'en' ? `Delete task "${editing.name}"?` : `هل تريد حذف مهمة "${editing.name}"؟`)) return;
    setSavingEdit(true);
    setEditError('');
    try {
      await deleteImportantDate(editing.id);
      await reload();
      closeEdit();
      showDoneMsg(lang === 'en' ? 'Task deleted' : 'تم حذف المهمة');
    } catch (err) {
      setEditError(err?.message || (lang === 'en' ? 'Failed to delete task' : 'تعذّر حذف المهمة'));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div
      className="min-h-full relative overflow-hidden pb-24"
      style={{
        background: 'var(--color-page-background)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      <div className="relative z-10 p-4 space-y-4">
        <p className="text-xs text-tw-muted text-center">
          {lang === 'en'
            ? 'Recurring tasks and dates per branch — a reminder shows on the home screen 7 days before the due date'
            : 'مهام وتواريخ متكررة لكل فرع — يظهر تذكيرها في الرئيسية قبل الموعد بـ 7 أيام'}
        </p>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-tw-muted/50" />
          </div>
        )}

        {error && (
          <p className="text-tw-red text-xs text-center bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>
        )}
        {done && (
          <p className="text-tw-green text-sm font-bold bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> {done}
          </p>
        )}

        {!loading && (
          <>
            {/* قائمة المهام */}
            {tasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-tw-line shadow-sm">
                <CalendarClock size={32} className="text-tw-muted/50 mx-auto mb-3" />
                <p className="text-sm font-bold text-tw-muted">{lang === 'en' ? 'No tasks yet' : 'لا توجد مهام بعد'}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tasks.map((task) => {
                  const st = importantDateStatus(task.dueDate);
                  const b = branches.find((x) => x.id === task.branchId);
                  return (
                    <button
                      key={task.id}
                      onClick={() => openEdit(task)}
                      className={`w-full bg-white rounded-2xl p-4 border border-tw-line shadow-sm flex items-center gap-3 hover:bg-tw-soft/40 transition-colors ${lang === 'en' ? 'text-left' : 'text-right'}`}
                    >
                      <div className="w-11 h-11 rounded-2xl bg-tw-soft text-tw-blue flex items-center justify-center flex-shrink-0">
                        <CalendarClock size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-tw-navy truncate">{task.name}</p>
                        <p className="text-xs text-tw-muted truncate mt-0.5">
                          {branchName(b, lang)} · {RECURRENCE_LABELS[task.recurrence]?.[lang] || RECURRENCE_LABELS[task.recurrence]?.ar || ''} · {fmtDate(task.dueDate, lang)}
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold flex-shrink-0 px-2.5 py-1 rounded-full ${st.badge}`}>
                        {st.label[lang] || st.label.ar}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* زر إضافة مهمة */}
            <button
              onClick={() => { setShowAdd(true); setAddForm({ ...EMPTY_FORM, branchId: branches[0]?.id || '' }); setAddError(''); }}
              className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
                boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
              }}
            >
              <Plus size={18} />
              {lang === 'en' ? 'Add new task' : 'إضافة مهمة جديدة'}
            </button>
          </>
        )}
      </div>

      {/* Bottom Sheet — إضافة مهمة */}
      <EditSheet open={showAdd} onClose={() => setShowAdd(false)} title={lang === 'en' ? 'Add new task' : 'إضافة مهمة جديدة'}>
        <div className="space-y-4">
          <TaskForm value={addForm} onChange={setAddForm} branches={branches} lang={lang} />
          {addError && (
            <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{addError}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowAdd(false)}
              disabled={adding}
              className="flex-1 bg-white border border-tw-line text-tw-navy font-bold py-3.5 rounded-xl hover:bg-tw-soft/40 disabled:opacity-60"
            >
              {lang === 'en' ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              onClick={handleAdd}
              disabled={adding}
              className="flex-1 text-white font-bold py-3.5 rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)', boxShadow: '0 6px 16px rgba(0,91,255,0.25)' }}
            >
              {adding && <Loader2 size={16} className="animate-spin" />}
              {lang === 'en' ? 'Save' : 'حفظ'}
            </button>
          </div>
        </div>
      </EditSheet>

      {/* Bottom Sheet — تعديل مهمة */}
      <EditSheet open={!!editing} onClose={closeEdit} title={lang === 'en' ? 'Edit task' : 'تعديل المهمة'}>
        {editing && (
          <div className="space-y-4">
            <TaskForm value={editForm} onChange={setEditForm} branches={branches} lang={lang} />

            {/* معلومات الحالة وآخر إنجاز (للقراءة فقط) */}
            <div className="bg-tw-soft/40 border border-tw-line rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-tw-muted font-bold">{lang === 'en' ? 'Task status' : 'حالة المهمة'}</span>
                <span className={`font-bold px-2 py-0.5 rounded-full ${importantDateStatus(editForm.dueDate).badge}`}>
                  {importantDateStatus(editForm.dueDate).label[lang] || importantDateStatus(editForm.dueDate).label.ar}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-tw-muted font-bold">{lang === 'en' ? 'Last completed' : 'آخر تاريخ إنجاز'}</span>
                <span className="text-tw-navy font-bold flex items-center gap-1">
                  <CalendarDays size={13} className="text-tw-muted" />
                  {editing.lastCompletedDate
                    ? fmtDate(editing.lastCompletedDate, lang)
                    : (lang === 'en' ? 'Not completed yet' : 'لم يُنجز بعد')}
                </span>
              </div>
            </div>

            {editError && (
              <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{editError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={closeEdit}
                disabled={savingEdit}
                className="flex-1 bg-white border border-tw-line text-tw-navy font-bold py-3.5 rounded-xl hover:bg-tw-soft/40 disabled:opacity-60"
              >
                {lang === 'en' ? 'Cancel' : 'إلغاء'}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex-1 text-white font-bold py-3.5 rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)', boxShadow: '0 6px 16px rgba(0,91,255,0.25)' }}
              >
                {savingEdit && <Loader2 size={16} className="animate-spin" />}
                {lang === 'en' ? 'Save changes' : 'حفظ التغييرات'}
              </button>
            </div>

            <button
              onClick={handleDelete}
              disabled={savingEdit}
              className="w-full bg-red-50 hover:bg-red-50 text-tw-red font-bold py-3.5 rounded-xl border border-red-100 transition-colors disabled:opacity-60"
            >
              {lang === 'en' ? 'Delete task' : 'حذف المهمة'}
            </button>
          </div>
        )}
      </EditSheet>
    </div>
  );
}
