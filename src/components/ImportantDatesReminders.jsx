// src/components/ImportantDatesReminders.jsx
// ----------------------------------------------------------
// كروت تذكير "تواريخ مهمة" في الصفحة الرئيسية — أسفل الكروت الرئيسية.
// تظهر المهام التي اقترب موعدها (≤ 7 أيام) أو فات موعدها ولم تُنجز، حسب الفرع.
//   - branchId مُحدّد → مهام ذلك الفرع فقط (الموظف).
//   - branchId = null → كل الفروع (المدير).
// الكرت لا يختفي إلا بالضغط على "تم الإنجاز" (ينقل الموعد للدورة القادمة).
// ----------------------------------------------------------
import { useState, useEffect, useCallback } from 'react';
import { CalendarClock, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import {
  getBranches, getImportantDates, completeImportantDate, RECURRENCE_LABELS,
} from '../firebase';
import { importantDateStatus, shouldRemind } from '../utils/importantDateStatus';
import EditSheet from './EditSheet';

function fmtDate(dateStr, lang) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function branchLabel(b, lang) {
  if (!b) return '';
  if (lang === 'en') return b.nameEn || b.name;
  return b.name?.startsWith('فرع') ? b.name : `فرع ${b.name}`;
}

export default function ImportantDatesReminders({ branchId = null, lang = 'ar', userName = null }) {
  const [tasks, setTasks] = useState([]);
  const [branchMap, setBranchMap] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(null); // المهمة المفتوحة في نافذة التفاصيل
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [brs, list] = await Promise.all([getBranches(), getImportantDates(branchId)]);
      const map = {};
      brs.forEach((b) => { map[b.id] = b; });
      setBranchMap(map);
      // نعرض فقط ما اقترب موعده أو فات (≤ 7 أيام)
      setTasks(list.filter((t) => shouldRemind(t.dueDate)));
    } catch (err) {
      // فشل صامت — لا نُعطّل الصفحة الرئيسية
      console.error('ImportantDatesReminders error:', err);
      setTasks([]);
    } finally {
      setLoaded(true);
    }
  }, [branchId]);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async () => {
    if (!selected) return;
    setCompleting(true);
    try {
      await completeImportantDate(selected.id, { userName });
      setSelected(null);
      await load(); // الكرت يختفي تلقائياً (انتقل الموعد للدورة القادمة)
    } catch (err) {
      console.error('completeImportantDate error:', err);
    } finally {
      setCompleting(false);
    }
  };

  // لا نعرض شيئاً إذا لا توجد تذكيرات (حتى لا نغيّر شكل الصفحة)
  if (!loaded || tasks.length === 0) return null;

  return (
    <div className="relative z-10 mt-1">
      <h3 className="text-sm font-extrabold text-tw-navy mb-2 flex items-center gap-1.5">
        <CalendarClock size={16} className="text-tw-blue" />
        {lang === 'en' ? 'Reminders' : 'تذكيرات مهمة'}
      </h3>

      <div className="space-y-2.5">
        {tasks.map((task) => {
          const st = importantDateStatus(task.dueDate);
          const isOverdue = st.key === 'overdue';
          return (
            <button
              key={task.id}
              onClick={() => setSelected(task)}
              className={`w-full rounded-2xl p-3.5 border shadow-sm flex items-center gap-3 active:scale-[0.99] transition-transform text-right ${st.card}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-tw-navy truncate">{task.name}</p>
                <p className="text-[11px] text-tw-muted truncate mt-0.5">
                  {branchLabel(branchMap[task.branchId], lang)} · {fmtDate(task.dueDate, lang)}
                </p>
              </div>
              <span className={`text-[10px] font-bold flex-shrink-0 px-2 py-1 rounded-full flex items-center gap-1 ${st.badge}`}>
                {isOverdue && <AlertTriangle size={11} />}
                {st.label[lang] || st.label.ar}
              </span>
            </button>
          );
        })}
      </div>

      {/* نافذة تفاصيل المهمة + زر تم الإنجاز */}
      <EditSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={lang === 'en' ? 'Task details' : 'تفاصيل المهمة'}
      >
        {selected && (() => {
          const st = importantDateStatus(selected.dueDate);
          const rows = [
            { label: lang === 'en' ? 'Task' : 'اسم المهمة', value: selected.name },
            { label: lang === 'en' ? 'Date' : 'تاريخ المهمة', value: fmtDate(selected.dueDate, lang) },
            { label: lang === 'en' ? 'Branch' : 'الفرع', value: branchLabel(branchMap[selected.branchId], lang) },
            {
              label: lang === 'en' ? 'Recurrence' : 'نوع التكرار',
              value: RECURRENCE_LABELS[selected.recurrence]?.[lang] || RECURRENCE_LABELS[selected.recurrence]?.ar || '',
            },
          ];
          return (
            <div className="space-y-4">
              <div className="bg-tw-soft/40 border border-tw-line rounded-2xl divide-y divide-tw-line/60">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="text-xs font-bold text-tw-muted flex-shrink-0">{r.label}</span>
                    <span className="text-sm font-bold text-tw-navy text-left">{r.value}</span>
                  </div>
                ))}
                {selected.notes && (
                  <div className="px-4 py-3">
                    <span className="text-xs font-bold text-tw-muted block mb-1">
                      {lang === 'en' ? 'Notes' : 'الملاحظات'}
                    </span>
                    <span className="text-sm text-tw-navy leading-relaxed">{selected.notes}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-xs font-bold text-tw-muted flex-shrink-0">
                    {lang === 'en' ? 'Status' : 'حالة المهمة'}
                  </span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.badge}`}>
                    {st.label[lang] || st.label.ar}
                  </span>
                </div>
              </div>

              <button
                onClick={handleComplete}
                disabled={completing}
                className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #0E8F57 0%, #22D08A 100%)',
                  boxShadow: '0 6px 16px rgba(34,208,138,0.25)',
                }}
              >
                {completing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                {lang === 'en' ? 'Mark as done' : 'تم الإنجاز'}
              </button>
            </div>
          );
        })()}
      </EditSheet>
    </div>
  );
}
