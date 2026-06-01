// src/components/ManageCategories.jsx
// ----------------------------------------------------------
// شاشة إدارة التصنيفات + إلزامية صورة الفاتورة + إعادة الترتيب بالسحب.
// مُستخرَجة من App.jsx.
// ----------------------------------------------------------
import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  getCategories, setCategoryRequiresImage, addCategory, deleteCategory, reorderCategories,
} from '../firebase';
import { translateCategory } from '../i18n';
import { useDragSort } from '../hooks/useDragSort';
import { useScreenHeader } from '../context/ScreenCtx';

export default function ManageCategories({ onBack }) {
  useScreenHeader('التصنيفات', onBack);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newReq, setNewReq] = useState(false);
  const [newType, setNewType] = useState('general');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setCats(await getCategories()); }
    catch (err) { setError(err?.message || 'تعذّر التحميل'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getCategories();
        if (!cancelled) setCats(data);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'تعذّر التحميل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleRequires = async (cat) => {
    setBusyId(cat.id);
    setError('');
    try {
      await setCategoryRequiresImage(cat.id, !cat.requiresImage);
      setCats((prev) => prev.map((c) => c.id === cat.id ? { ...c, requiresImage: !c.requiresImage } : c));
    } catch (err) {
      setError(err?.message || 'تعذّر التحديث');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (cat) => {
    if (!confirm(`حذف تصنيف "${cat.name}"؟ السجلات القديمة لن تتأثر.`)) return;
    setBusyId(cat.id);
    try {
      await deleteCategory(cat.id);
      setCats((prev) => prev.filter((c) => c.id !== cat.id));
    } catch (err) {
      setError(err?.message || 'تعذّر الحذف');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    setError('');
    if (!newName.trim()) { setError('أدخل اسم التصنيف'); return; }
    setSaving(true);
    try {
      await addCategory({ name: newName, requiresImage: newReq, expenseType: newType });
      setNewName(''); setNewReq(false); setNewType('general');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err?.message || 'تعذّر الإضافة');
    } finally {
      setSaving(false);
    }
  };

  // Batch 22: ترتيب بالسحب — يدعم desktop (mouse) و mobile (touch long-press)
  const catDrag = useDragSort(cats, setCats, async (finalCats) => {
    try {
      await reorderCategories(finalCats.map((c) => c.id));
    } catch (err) {
      setError(err?.message || 'تعذّر تحديث الترتيب');
      await load();
    }
  });

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
        {/* زر إضافة تصنيف — gradient navy */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full text-white font-bold py-3.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)',
              boxShadow: '0 6px 16px rgba(0,91,255,0.25)',
            }}
          >
            <Plus size={18} /> + إضافة تصنيف
          </button>
        )}

        {/* form إضافة تصنيف جديد */}
        {showForm && (
          <div className="bg-white border border-tw-blue/30 rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="font-bold text-sm text-tw-navy">تصنيف جديد</h3>
            <input
              type="text"
              placeholder="اسم التصنيف (مثل: كهرباء)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue"
            />

            <div>
              <label className="text-xs font-bold text-tw-muted mb-1.5 block">نوع المصروف (لتقارير المدير)</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full p-3 bg-tw-soft/40 border border-tw-line rounded-xl text-sm font-bold outline-none focus:border-tw-blue"
              >
                <option value="general">عام</option>
                <option value="flower">ورد</option>
                <option value="delivery">توصيل</option>
                <option value="customerOrders">طلبات عملاء</option>
                <option value="supplies">مستلزمات وبضائع</option>
                <option value="marketing">تسويق</option>
              </select>
            </div>

            <label className="flex items-center justify-between bg-tw-soft/40 border border-tw-line rounded-xl p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={newReq}
                onChange={(e) => setNewReq(e.target.checked)}
                className="w-5 h-5 accent-blue-600"
              />
              <span className="text-sm font-bold text-tw-navy">صورة الفاتورة إجبارية</span>
            </label>

            {error && (
              <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-2 text-center">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setError(''); }}
                className="flex-1 bg-white border border-tw-line text-tw-navy font-bold py-2.5 rounded-xl text-sm hover:bg-tw-soft/40"
              >
                إلغاء
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #082765 0%, #005BFF 100%)' }}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'جارٍ...' : 'حفظ'}
              </button>
            </div>
          </div>
        )}

        {!showForm && error && (
          <p className="text-tw-red text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3 text-center">{error}</p>
        )}

        {/* قائمة التصنيفات — تصميم prototype مع toggles خضراء */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-tw-muted/50" />
          </div>
        ) : (
          <div className="space-y-3">
            {cats.map((cat, idx) => (
              <div
                key={cat.id}
                {...catDrag.itemProps(idx)}
                className={`bg-white border border-tw-line rounded-2xl p-4 flex items-center gap-3 shadow-sm transition-all ${
                  catDrag.isDragging(idx) ? 'opacity-50 scale-[0.98]' : ''
                }`}
              >
                {/* Toggle موحّد بنفس تصميم التنبيهات والإشعارات */}
                <button
                  onClick={() => toggleRequires(cat)}
                  disabled={busyId === cat.id}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    cat.requiresImage ? 'bg-tw-green' : 'bg-gray-300'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      cat.requiresImage ? 'right-0.5' : 'right-[26px]'
                    }`}
                  />
                </button>

                {/* النص + نقطة ملوّنة */}
                <div className="flex-1 text-right">
                  <p className="font-bold text-base text-tw-navy mb-1">{translateCategory('ar', cat.name)}</p>
                  <p className="text-xs text-tw-muted flex items-center gap-1.5 justify-end">
                    <span>{cat.requiresImage ? 'صورة إجبارية' : 'صورة اختيارية'}</span>
                    <span className={`w-2 h-2 rounded-full ${cat.requiresImage ? 'bg-tw-red' : 'bg-gray-300'}`}></span>
                  </p>
                </div>

                {/* Batch 22: مقبض السحب — يدعم touch (long-press) + mouse drag */}
                <div
                  {...catDrag.handleProps(idx)}
                  className="p-2 text-tw-muted/60 cursor-grab active:cursor-grabbing flex-shrink-0"
                  title="اسحب لإعادة الترتيب"
                  aria-label="drag handle"
                >
                  <GripVertical size={18} strokeWidth={2} />
                </div>

                {/* زر الحذف صغير */}
                <button
                  onClick={() => handleDelete(cat)}
                  disabled={busyId === cat.id}
                  className="p-2 text-tw-red hover:bg-red-50 rounded-lg disabled:opacity-50 flex-shrink-0"
                  title="حذف"
                >
                  {busyId === cat.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
