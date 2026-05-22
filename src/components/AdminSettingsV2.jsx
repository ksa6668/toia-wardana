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
  Activity, Key, PieChart,
} from 'lucide-react';
import ManagerGoals from './ManagerGoals';
import ManagerBranches from './ManagerBranches';
import ManagerGeneralSettings from './ManagerGeneralSettings';
import ManagerNotifications from './ManagerNotifications';
import ManagerBackup from './ManagerBackup';

// عناصر القائمة — كل عنصر له:
//   key: للتنقل
//   label, desc: للعرض
//   icon: من lucide
//   color: نمط الأيقونة
//   enabled: هل الميزة جاهزة؟
const ITEMS = [
  {
    key: 'adminEntry',
    icon: Activity, color: 'cyan',
    label: { ar: 'تسجيل مبيعات/مصاريف', en: 'Record sales/expenses' },
    desc: { ar: 'إدخال لأي فرع كمدير', en: 'Enter data for any branch as admin' },
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
    icon: Wallet, color: 'emerald',
    label: { ar: 'المصاريف الثابتة', en: 'Fixed Expenses' },
    desc: { ar: 'إيجار ورواتب وتأمين لكل فرع شهرياً', en: 'Rent, salaries, insurance per branch monthly' },
    enabled: true,
  },
  {
    key: 'categories',
    icon: Receipt, color: 'amber',
    label: { ar: 'التصنيفات والفواتير', en: 'Categories & Invoices' },
    desc: { ar: 'تحديد التصنيفات وإلزامية الصورة', en: 'Configure categories and image requirements' },
    enabled: true,
  },
  {
    key: 'backup',
    icon: Cloud, color: 'sky',
    label: { ar: 'النسخ الاحتياطي', en: 'Backup' },
    desc: { ar: 'تصدير واستيراد البيانات بالفرع أو الكل', en: 'Export and import data by branch or all' },
    enabled: true,
  },
  {
    key: 'notif',
    icon: Bell, color: 'rose',
    label: { ar: 'التنبيهات والإشعارات', en: 'Notifications' },
    desc: { ar: 'تفعيل وإدارة تنبيهات النظام والأهداف', en: 'Enable and manage system notifications' },
    enabled: true,
  },
  {
    key: 'users',
    icon: Users, color: 'violet',
    label: { ar: 'المستخدمون والصلاحيات', en: 'Users & Permissions' },
    desc: { ar: 'إضافة وتعديل المستخدمين والصلاحيات', en: 'Add and edit users and permissions' },
    enabled: true,
  },
  {
    key: 'branches',
    icon: Store, color: 'orange',
    label: { ar: 'إدارة الفروع', en: 'Manage Branches' },
    desc: { ar: 'إضافة الفروع وتسميتها بالعربية والإنجليزية', en: 'Add branches and label them' },
    enabled: true,
  },
  {
    key: 'myPin',
    icon: Key, color: 'slate',
    label: { ar: 'تغيير رمزي السري', en: 'Change My PIN' },
    desc: { ar: 'تحديث رمزك أنت', en: 'Update your own PIN' },
    enabled: true,
  },
  {
    key: 'general',
    icon: Gear, color: 'gray',
    label: { ar: 'الإعدادات العامة', en: 'General Settings' },
    desc: { ar: 'اللغة، العملة، نظام التاريخ', en: 'Language, currency, date system' },
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

  return (
    <div
      className="min-h-full px-4 pt-4 pb-8"
      style={{
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      <h2 className="text-lg font-bold text-slate-800 mb-3 px-1">
        {lang === 'en' ? 'System Settings' : 'إعدادات النظام'}
      </h2>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.enabled;
          return (
            <button
              key={item.key}
              disabled={!isActive}
              onClick={() => isActive && setScreen(item.key)}
              className={`w-full p-3.5 border-b border-gray-50 last:border-0 flex items-center gap-3 transition-colors ${
                isActive
                  ? 'hover:bg-gray-50 cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[item.color]}`}>
                <Icon size={18} />
              </div>
              <div className={`flex-1 ${lang === 'en' ? 'text-left' : 'text-right'} min-w-0`}>
                <p className="text-sm font-bold text-slate-800 truncate">
                  {item.label[lang]}
                  {!isActive && <span className="text-xs text-gray-400 font-normal mr-2">
                    ({lang === 'en' ? 'soon' : 'قريباً'})
                  </span>}
                </p>
                <p className="text-[11px] text-gray-500 truncate">{item.desc[lang]}</p>
              </div>
              <ChevronRight size={16} className={`text-gray-300 flex-shrink-0 ${lang === 'en' ? '' : 'rotate-180'}`} />
            </button>
          );
        })}
      </div>

      {/* رسالة معلوماتية للميزات قيد التطوير */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-[11px] text-blue-700 leading-relaxed">
          <span className="font-bold">ℹ️ {lang === 'en' ? 'Note:' : 'ملاحظة:'}</span>{' '}
          {lang === 'en'
            ? 'Features marked "soon" are under development and will be enabled in upcoming updates.'
            : 'الميزات المعلّمة "قريباً" قيد التطوير وسيتم تفعيلها في التحديثات القادمة.'}
        </p>
      </div>
    </div>
  );
}
