// src/components/AdminSettingsV2.jsx
// ----------------------------------------------------------
// قائمة إعدادات المدير الرئيسية
// Batch 13:
//   - "تغيير الرمز السري" انتقل لقائمة الحساب من زر الـ profile
//   - "المبيعات والمصروفات" صار بنفس لون باقي الإعدادات (blue)
// ----------------------------------------------------------
import { useState } from 'react';
import {
  ChevronRight, Target, Wallet, Receipt, Cloud, Bell, Users, Store, Settings as Gear,
  PieChart, GripVertical, Upload, MessageCircle,
} from 'lucide-react';
import { useDragSort } from '../hooks/useDragSort';
import ManagerGoals from './ManagerGoals';
import ManagerBranches from './ManagerBranches';
import ManagerGeneralSettings from './ManagerGeneralSettings';
import ManagerNotifications from './ManagerNotifications';
import ManagerBackup from './ManagerBackup';
import ManagerReceipts from './ManagerReceipts';
import ManagerImport from './ManagerImport';
import ManageWhatsappBaseline from './ManageWhatsappBaseline';

const ITEMS = [
  {
    key: 'adminEntry',
    icon: PieChart, color: 'blue',
    label: { ar: 'المبيعات والمصروفات', en: 'Sales & Expenses' },
    desc: { ar: 'تسجيل وتعديل وحذف عمليات آخر 7 أيام', en: 'Record, edit and delete operations from last 7 days' },
    enabled: true,
  },
  {
    key: 'goals',
    icon: Target, color: 'blue',
    label: { ar: 'الأهداف الشهرية', en: 'Monthly Goals' },
    desc: { ar: 'تحديد أهداف المبيعات والتقييمات شهرياً', en: 'Set monthly sales and reviews targets' },
    enabled: true,
  },
  {
    key: 'fixed',
    icon: Wallet, color: 'blue',
    label: { ar: 'المصاريف الثابتة', en: 'Fixed Expenses' },
    desc: { ar: 'إيجار ورواتب وتأمين لكل فرع شهرياً', en: 'Rent, salaries, insurance per branch monthly' },
    enabled: true,
  },
  {
    key: 'whatsappBaseline',
    icon: MessageCircle, color: 'blue',
    label: { ar: 'عملاء واتساب', en: 'WhatsApp Customers' },
    desc: { ar: 'إجمالي عملاء واتساب التاريخي لكل فرع', en: 'Total historical WhatsApp customers per branch' },
    enabled: true,
  },
  {
    key: 'receipts',
    icon: Receipt, color: 'blue',
    label: { ar: 'الإيصالات والفواتير', en: 'Receipts & Invoices' },
    desc: { ar: 'سجل المصاريف مع الصور وكامل التفاصيل', en: 'Expense log with photos and full details' },
    enabled: true,
  },
  {
    key: 'backup',
    icon: Cloud, color: 'blue',
    label: { ar: 'النسخ الاحتياطي', en: 'Backup' },
    desc: { ar: 'نسخ البيانات احتياطياً وحفظها', en: 'Backup and save data' },
    enabled: true,
  },
  {
    key: 'import',
    icon: Upload, color: 'blue',
    label: { ar: 'استيراد بيانات تاريخية', en: 'Import Historical Data' },
    desc: { ar: 'استيراد المبيعات والمصاريف القديمة من Excel', en: 'Import old sales and expenses from Excel' },
    enabled: true,
  },
  {
    key: 'notif',
    icon: Bell, color: 'blue',
    label: { ar: 'التنبيهات والإشعارات', en: 'Notifications' },
    desc: { ar: 'تفعيل وإدارة تنبيهات النظام والأهداف', en: 'Enable and manage system notifications' },
    enabled: true,
  },
  {
    key: 'users',
    icon: Users, color: 'blue',
    label: { ar: 'المستخدمون والصلاحيات', en: 'Users & Permissions' },
    desc: { ar: 'إضافة وتعديل المستخدمين والصلاحيات', en: 'Add and edit users and permissions' },
    enabled: true,
  },
  {
    key: 'branches',
    icon: Store, color: 'blue',
    label: { ar: 'إدارة الفروع', en: 'Manage Branches' },
    desc: { ar: 'إضافة الفروع وتسميتها بالعربية والإنجليزية', en: 'Add branches and label them' },
    enabled: true,
  },
  {
    key: 'general',
    icon: Gear, color: 'blue',
    label: { ar: 'الإعدادات العامة', en: 'General Settings' },
    desc: { ar: 'اللغة، العملة، نظام التاريخ، اسم النشاط', en: 'Language, currency, date system, business name' },
    enabled: true,
  },
];

const colorMap = {
  blue: 'bg-tw-soft text-tw-blue',
  emerald: 'bg-emerald-50 text-tw-green',
  amber: 'bg-amber-50 text-tw-orange',
  slate: 'bg-tw-soft text-tw-muted',
};

export default function AdminSettingsV2({
  lang = 'ar',
  ManageUsersComponent,
  ManageFixedExpensesComponent,
  ManageCategoriesComponent,
  AdminDataEntryComponent,
}) {
  const [screen, setScreen] = useState('menu');
  const [showCategoriesFromReceipts, setShowCategoriesFromReceipts] = useState(false);
  const goBack = () => setScreen('menu');

  // Batch 19+22: ترتيب مخصّص بالسحب (يدعم touch على الموبايل)
  const STORAGE_KEY = 'tw-settings-order-v1';
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedKeys = JSON.parse(saved);
        const map = new Map(ITEMS.map((it) => [it.key, it]));
        const ordered = [];
        for (const k of savedKeys) if (map.has(k)) { ordered.push(map.get(k)); map.delete(k); }
        for (const it of map.values()) ordered.push(it);
        return ordered;
      }
    } catch { /* ignore */ }
    return ITEMS;
  });
  const drag = useDragSort(items, setItems, async (finalItems) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(finalItems.map((it) => it.key)));
    } catch { /* ignore */ }
  });

  if (screen === 'users' && ManageUsersComponent) return <ManageUsersComponent onBack={goBack} />;
  if (screen === 'fixed' && ManageFixedExpensesComponent) return <ManageFixedExpensesComponent onBack={goBack} />;
  if (screen === 'whatsappBaseline') return <ManageWhatsappBaseline onBack={goBack} lang={lang} />;
  if (screen === 'categories' && ManageCategoriesComponent) return <ManageCategoriesComponent onBack={goBack} />;
  if (screen === 'adminEntry' && AdminDataEntryComponent) return <AdminDataEntryComponent onBack={goBack} />;
  if (screen === 'goals') return <ManagerGoals onBack={goBack} lang={lang} />;
  if (screen === 'branches') return <ManagerBranches onBack={goBack} lang={lang} />;
  if (screen === 'general') return <ManagerGeneralSettings onBack={goBack} lang={lang} />;
  if (screen === 'notif') return <ManagerNotifications onBack={goBack} lang={lang} />;
  if (screen === 'backup') return <ManagerBackup onBack={goBack} lang={lang} />;
  if (screen === 'import') return <ManagerImport onBack={goBack} lang={lang} />;
  if (screen === 'receipts') {
    if (showCategoriesFromReceipts && ManageCategoriesComponent) {
      return <ManageCategoriesComponent onBack={() => setShowCategoriesFromReceipts(false)} />;
    }
    return (
      <ManagerReceipts
        onBack={goBack}
        onOpenCategories={
          ManageCategoriesComponent
            ? () => setShowCategoriesFromReceipts(true)
            : undefined
        }
      />
    );
  }

  return (
    <div
      className="min-h-full px-4 pt-4 pb-8 page-bg-soft"
      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const isActive = item.enabled;
          const isDraggingThis = drag.isDragging(idx);
          return (
            <div
              key={item.key}
              {...drag.itemProps(idx)}
              onClick={() => isActive && drag.dragIdx === null && setScreen(item.key)}
              className={`w-full p-4 border-b border-tw-line/60 last:border-0 flex items-center gap-3 transition-all ${
                isActive
                  ? 'hover:bg-tw-soft cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              } ${isDraggingThis ? 'opacity-50 scale-[0.98] bg-tw-soft' : ''}`}
            >
              {/* الأيقونة قبل الاسم — في RTL تظهر يمين */}
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${colorMap[item.color]}`}>
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className={`flex-1 ${lang === 'en' ? 'text-left' : 'text-right'} min-w-0`}>
                <p className="text-sm font-extrabold text-tw-navy truncate">
                  {item.label[lang]}
                </p>
                <p className="text-[11px] text-tw-muted truncate mt-0.5">{item.desc[lang]}</p>
              </div>
              {/* مقبض السحب — يدعم touch (long-press) + mouse drag */}
              <div
                {...drag.handleProps(idx)}
                className="p-2 text-tw-muted/40 flex-shrink-0 cursor-grab active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
                title="اسحب لإعادة الترتيب"
              >
                <GripVertical size={16} />
              </div>
              {/* سهم صغير على أقصى اليسار في RTL */}
              <ChevronRight
                size={14}
                className={`text-tw-muted flex-shrink-0 ${lang === 'en' ? 'rotate-180' : ''}`}
                strokeWidth={2.2}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
