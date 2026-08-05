// src/components/ManagerLoyalty.jsx
// ----------------------------------------------------------
// تبويب المدير — برنامج الولاء (المرحلة 1).
// قائمة العملاء لكل متجر مع بحث وفلترة، وفتح ملف العضو،
// وزر إعدادات الولاء لكل متجر.
// ----------------------------------------------------------
import { useState } from 'react';
import { Loader2, Search, Settings2, Users, ChevronLeft } from 'lucide-react';
import { getLoyaltyMembers } from '../firebase';
import { useCachedQuery } from '../hooks/useCachedQuery';
import { toEnglishDigits } from '../loyaltyMath';
import { translateBranch } from '../i18n';
import LoyaltyMemberProfile from './LoyaltyMemberProfile';
import LoyaltySettings from './LoyaltySettings';

const STORES = ['toia', 'wardana'];

export default function ManagerLoyalty({ lang, user }) {
  const en = lang === 'en';
  const [store, setStore] = useState('toia');
  const [search, setSearch] = useState('');
  // sub: 'list' | 'profile' | 'settings'
  const [sub, setSub] = useState('list');
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  const { data: members, loading, refresh } = useCachedQuery(
    ['loyalty', 'members', store],
    () => getLoyaltyMembers(store),
    { ttl: 30 * 1000, defaultData: [] }
  );

  // فلترة عند العميل: اسم / جوال / رقم عضوية (مع توحيد الأرقام العربية)
  const term = toEnglishDigits(search).trim().toLowerCase();
  const filtered = (members || []).filter((m) => {
    if (!term) return true;
    const phoneDigits = String(m.phone || '').replace(/\D/g, '');
    const termDigits = term.replace(/\D/g, '');
    return (
      String(m.name || '').toLowerCase().includes(term) ||
      String(m.memberNo || '').toLowerCase().includes(term) ||
      (termDigits && phoneDigits.includes(termDigits))
    );
  });

  if (sub === 'profile' && selectedMemberId) {
    return (
      <LoyaltyMemberProfile
        memberId={selectedMemberId}
        store={store}
        lang={lang}
        user={user}
        onBack={() => { setSub('list'); refresh(); }}
      />
    );
  }

  if (sub === 'settings') {
    return (
      <LoyaltySettings
        store={store}
        lang={lang}
        onBack={() => setSub('list')}
      />
    );
  }

  return (
    <div
      className="min-h-full px-4 pt-3 pb-8 space-y-3"
      style={{ fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif' }}
    >
      {/* اختيار المتجر + الإعدادات */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 bg-white border border-tw-line rounded-xl p-1 gap-1">
          {STORES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStore(s)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
                store === s ? 'bg-tw-blue text-white shadow-sm' : 'text-tw-navy hover:bg-tw-soft'
              }`}
            >
              {translateBranch(lang, s, s)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSub('settings')}
          title={en ? 'Loyalty settings' : 'إعدادات الولاء'}
          className="p-2.5 bg-white border border-tw-line rounded-xl text-tw-navy hover:bg-tw-soft"
        >
          <Settings2 size={20} />
        </button>
      </div>

      {/* البحث */}
      <div className="relative">
        <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-tw-muted" style={{ insetInlineStart: 12 }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={en ? 'Search: name / phone / member no.' : 'بحث: اسم / جوال / رقم عضوية'}
          className="w-full p-3 bg-white border border-tw-line rounded-xl text-sm outline-none focus:border-tw-blue"
          style={{ paddingInlineStart: 36 }}
        />
      </div>

      {/* القائمة */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-tw-muted">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm font-bold">{en ? 'Loading…' : 'جارٍ التحميل…'}</span>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white border border-tw-line rounded-2xl p-8 text-center text-tw-muted">
          <Users size={28} className="mx-auto mb-2 opacity-60" />
          <p className="text-sm font-bold">
            {term
              ? (en ? 'No results for this search' : 'لا نتائج لهذا البحث')
              : (en ? 'No members in this store yet' : 'لا يوجد أعضاء في هذا المتجر بعد')}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-white border border-tw-line rounded-2xl divide-y divide-tw-line/70 overflow-hidden">
          {filtered.map((m) => {
            const balance = Number(m.pointsBalance) || 0;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { setSelectedMemberId(m.id); setSub('profile'); }}
                className="w-full flex items-center gap-3 p-3 hover:bg-tw-soft/40 transition-colors text-start"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-tw-navy truncate">
                    {m.name}
                    {m.status === 'disabled' && (
                      <span className="text-[10px] font-extrabold text-tw-red mx-1.5">
                        ({en ? 'disabled' : 'معطّلة'})
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-tw-muted font-mono" dir="ltr" style={{ textAlign: en ? 'left' : 'right' }}>
                    {m.memberNo} · {m.phone}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex-shrink-0 ${
                  balance < 0 ? 'bg-red-50 text-tw-red' : 'bg-tw-soft text-tw-navy'
                }`}>
                  {balance.toLocaleString('en-US')} {en ? 'pts' : 'نقطة'}
                </span>
                <ChevronLeft size={16} className={`text-tw-muted flex-shrink-0 ${en ? 'rotate-180' : ''}`} />
              </button>
            );
          })}
        </div>
      )}

      {!loading && (
        <p className="text-[11px] text-tw-muted font-semibold text-center">
          {filtered.length.toLocaleString('en-US')} {en ? 'member(s)' : 'عضو'} — {translateBranch(lang, store, store)}
        </p>
      )}
    </div>
  );
}
