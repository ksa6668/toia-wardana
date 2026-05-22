// src/components/AdminSettingsV2.jsx
// ----------------------------------------------------------
// قائمة إعدادات المدير الرئيسية
// مطابقة لتصميم section#screen-settings في الـ prototype.
//
// يتنقل بين شاشات فرعية باستخدام state داخلي screen.
// كل شاشة فرعية تستقبل onBack للعودة لـ menu.
// ----------------------------------------------------------
import { useState } from 'react';
import {
  ChevronRight, Target, Wallet, Receipt, Cloud, Bell, Users, Store, Settings as Gear,
  Activity, Key, PieChart, FileText,
} from 'lucide-react';
import ManagerGoals from './ManagerGoals';
import ManagerBranches from './ManagerBranches';
import ManagerGeneralSettings from './ManagerGeneralSettings';
import ManagerNotifications from './ManagerNotifications';
import ManagerBackup from './ManagerBackup';
import ManagerReceipts from './ManagerReceipts';

// عناصر القائمة — كل عنصر له:
//   key: للتنقل
//   label, desc: للعرض
//   icon: من lucide
//   color: نمط الأيقونة
//   enabled: هل الميزة جاهزة؟
// عناصر القائمة بترتيب الـ prototype:
// المبيعات والمصروفات / الأهداف الشهرية / المصاريف الثابتة / الإيصالات والفواتير
// النسخ الاحتياطي / التنبيهات والإشعارات / المستخدمون والصلاحيات / إدارة الفروع
// التصنيفات / تغيير رمزي السري / الإعدادات العامة
const ITEMS = [
  {
    key: 'adminEntry',
    icon: PieChart, color: 'cyan',
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
    desc: { ar: 'تصدير واستيراد البيانات بالفرع أو الكل', en: 'Export and import data by branch or all' },
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
    key: 'categories',
    icon: FileText, color: 'blue',
    label: { ar: 'التصنيفات', en: 'Categories' },
    desc: { ar: 'تحديد التصنيفات وإلزامية الصورة', en: 'Configure categories and image requirements' },
    enabled: true,
  },
  {
    key: 'general',
    icon: Gear, color: 'blue',
    label: { ar: 'الإعدادات العامة', en: 'General Settings' },
    desc: { ar: 'اللغة، العملة، نظام التاريخ، اسم النشاط', en: 'Language, currency, date system, business name' },
    enabled: true,
  },
  {
    key: 'myPin',
    icon: Key, color: 'slate',
    label: { ar: 'تغيير رمزي السري', en: 'Change My PIN' },
    desc: { ar: 'تحديث رمزك أنت', en: 'Update your own PIN' },
    enabled: true,
  },
];

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-orange-600',
  slate: 'bg-slate-100 text-slate-600',
  gray: 'bg-gray-100 text-gray-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  indigo: 'bg-indigo-50 text-indigo-600',
};

/**
 * AdminSettingsV2: قائمة الإعدادات الرئيسية + التنقل للشاشات الفرعية.
 *
 * يستخدم الـ legacy components من App.jsx للشاشات القديمة (users, fixed, categories, myPin, adminEntry)
 * لتجنب إعادة كتابتها (تعمل ممتازة، فقط تصميم القائمة الذي يحتاج تحديث).
 *
 * يستخدم الـ V2 الجديد للشاشات الجديدة (goals, branches).
 */
export default function AdminSettingsV2({
  lang = 'ar',
  // الشاشات القديمة (تأتي كـ children من App.jsx بدل ما نعيد كتابتها)
  ManageUsersComponent,
  ManageFixedExpensesComponent,
  ManageCategoriesComponent,
  ChangeMyPinComponent,
  AdminDataEntryComponent,
}) {
  const [screen, setScreen] = useState('menu');
  const goBack = () => setScreen('menu');

  // التنقل للشاشات الفرعية
  if (screen === 'users' && ManageUsersComponent) return <ManageUsersComponent onBack={goBack} />;
  if (screen === 'fixed' && ManageFixedExpensesComponent) return <ManageFixedExpensesComponent onBack={goBack} />;
  if (screen === 'categories' && ManageCategoriesComponent) return <ManageCategoriesComponent onBack={goBack} />;
  if (screen === 'myPin' && ChangeMyPinComponent) return <ChangeMyPinComponent onBack={goBack} />;
  if (screen === 'adminEntry' && AdminDataEntryComponent) return <AdminDataEntryComponent onBack={goBack} />;
  if (screen === 'goals') return <ManagerGoals onBack={goBack} lang={lang} />;
  if (screen === 'branches') return <ManagerBranches onBack={goBack} lang={lang} />;
  if (screen === 'general') return <ManagerGeneralSettings onBack={goBack} lang={lang} />;
  if (screen === 'notif') return <ManagerNotifications onBack={goBack} lang={lang} />;
  if (screen === 'backup') return <ManagerBackup onBack={goBack} lang={lang} />;
  if (screen === 'receipts') return <ManagerReceipts onBack={goBack} />;

  return (
    <div
      className="min-h-full px-4 pt-4 pb-8 page-bg-soft"
      style={{ fontFamily: "'Almarai', 'IBM Plex Sans Arabic', sans-serif" }}
    >
      <h2 className="text-lg font-extrabold text-tw-navy mb-3 px-1">
        {lang === 'en' ? 'System Settings' : 'الإعدادات'}
      </h2>

      <div className="bg-white rounded-2xl shadow-sm border border-tw-line overflow-hidden">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.enabled;
          return (
            <button
              key={item.key}
              disabled={!isActive}
              onClick={() => isActive && setScreen(item.key)}
              className={`w-full p-4 border-b border-tw-line/60 last:border-0 flex items-center gap-3 transition-colors ${
                isActive
                  ? 'hover:bg-tw-soft cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              {/* السهم — يسار في RTL */}
              <ChevronRight size={18} className={`text-tw-muted flex-shrink-0 ${lang === 'en' ? '' : 'rotate-180'}`} />
              {/* النص في الوسط — اتجاه يميني */}
              <div className={`flex-1 ${lang === 'en' ? 'text-left' : 'text-right'} min-w-0`}>
                <p className="text-base font-extrabold text-tw-navy truncate">
                  {item.label[lang]}
                  {!isActive && <span className="text-xs text-tw-muted font-normal mr-2">
                    ({lang === 'en' ? 'soon' : 'قريباً'})
                  </span>}
                </p>
                <p className="text-xs text-tw-muted truncate mt-0.5">{item.desc[lang]}</p>
              </div>
              {/* الأيقونة — يمين في RTL */}
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${colorMap[item.color]}`}>
                <Icon size={20} strokeWidth={2} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
