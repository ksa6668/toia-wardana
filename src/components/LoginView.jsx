// src/components/LoginView.jsx
// ----------------------------------------------------------
// شاشة تسجيل الدخول (اسم المستخدم + رمز PIN + تذكّرني + تبديل اللغة).
// مُستخرَجة من App.jsx.
// ----------------------------------------------------------
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { login } from '../firebase';
import { t } from '../i18n';

export default function LoginView({ onLoginSuccess, lang, setLang }) {
  const [username, setUsername] = useState(() => {
    try { return localStorage.getItem('tw_remember_user') || ''; } catch { return ''; }
  });
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(() => {
    try { return !!localStorage.getItem('tw_remember_user'); } catch { return false; }
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!username.trim()) { setError(t(lang, 'login.err.username')); return; }
    if (!/^\d{4}$/.test(pin)) { setError(t(lang, 'login.err.pin')); return; }
    setLoading(true);
    try {
      const u = await login(username, pin);
      try {
        if (remember) localStorage.setItem('tw_remember_user', username.trim());
        else localStorage.removeItem('tw_remember_user');
      } catch { /* ignore */ }
      onLoginSuccess(u);
    } catch (err) {
      const code = err?.code || '';
      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        setError(t(lang, 'login.err.invalid'));
      } else if (code.includes('too-many-requests')) {
        setError(t(lang, 'login.err.tooMany'));
      } else if (code.includes('network')) {
        setError(t(lang, 'login.err.network'));
      } else {
        setError(err?.message || t(lang, 'login.err.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  return (
    <div
      className="relative min-h-full flex flex-col px-6 pt-8 pb-10 overflow-hidden"
      style={{
        // Batch 37: التدرج يبدأ من أعلى الشاشة ويمتد ليصل لقعر شاشة الجوال
        // عملياً status-bar (إن كان شفافاً) سيظهر فوق نفس التدرج الناعم
        background: 'radial-gradient(ellipse at top, #DCEBFF 0%, #F2F8FF 40%, #FFFFFF 100%)',
        fontFamily: '"IBM Plex Sans Arabic", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* خلفية زخرفية ناعمة */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(40,223,255,0.3), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,91,255,0.25), transparent 70%)' }}
      />

      {/* زر اللغة في الزاوية */}
      <div className={`relative z-10 flex ${lang === 'en' ? 'justify-end' : 'justify-start'} mb-3`}>
        <button
          onClick={toggleLang}
          className="bg-white/80 backdrop-blur-sm border border-tw-line text-tw-navy px-3.5 py-1.5 rounded-xl shadow-sm hover:bg-white hover:shadow-md transition-all"
          style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.5px' }}
        >
          {lang === 'ar' ? 'EN' : 'ع'}
        </button>
      </div>

      {/* Batch 37: الشعار — مساحة محدودة لا تأخذ كل الفراغ، ليرتفع النموذج للأعلى */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center mt-4 mb-6">
        <div
          className="w-40 h-40 mx-auto mb-5 flex items-center justify-center rounded-[2.5rem] shadow-xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #082765 0%, #061742 60%, #1E3A8A 100%)',
            boxShadow: '0 20px 50px -10px rgba(8, 39, 101, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset',
          }}
        >
          {/* تأثير لمعة */}
          <div
            className="absolute inset-0 opacity-40"
            style={{ background: 'radial-gradient(circle at 30% 20%, rgba(40,223,255,0.4), transparent 50%)' }}
          />
          {/* رمز الزهرة (شعار) */}
          <svg width="82" height="82" viewBox="0 0 100 100" className="relative z-10" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}>
            {/* 4 بتلات */}
            <ellipse cx="50" cy="28" rx="14" ry="22" fill="white" opacity="0.92" />
            <ellipse cx="50" cy="72" rx="14" ry="22" fill="white" opacity="0.92" />
            <ellipse cx="28" cy="50" rx="22" ry="14" fill="#28DFFF" opacity="0.85" />
            <ellipse cx="72" cy="50" rx="22" ry="14" fill="#168BFF" opacity="0.85" />
            <circle cx="50" cy="50" r="6" fill="white" />
          </svg>
        </div>
        <h1
          className="text-3xl mb-1"
          style={{
            fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif',
            fontWeight: 800,
            color: '#061742',
            letterSpacing: '-0.5px',
          }}
        >
          Toia &amp; Wardana
        </h1>
        <p className="text-sm font-medium" style={{ color: '#7E8AA3' }}>
          {t(lang, 'login.subtitle')}
        </p>
      </div>

      {/* Batch 37: النموذج - يأخذ المساحة المتبقية بـ flex-1 */}
      <div className="relative z-10 space-y-4 flex-1 flex flex-col justify-start">
        <div>
          <label
            className="block mb-2 text-xs"
            style={{ color: '#071A3D', fontWeight: 700 }}
          >
            {t(lang, 'login.username')}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t(lang, 'login.usernameHint')}
            autoCapitalize="off"
            className="w-full px-4 py-3.5 rounded-2xl outline-none transition-all"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E6ECF6',
              boxShadow: '0 1px 3px rgba(8, 39, 101, 0.04)',
              fontSize: '15px',
              color: '#071A3D',
              fontWeight: 600,
            }}
            onFocus={(e) => (e.target.style.borderColor = '#005BFF')}
            onBlur={(e) => (e.target.style.borderColor = '#E6ECF6')}
          />
        </div>

        <div>
          <label
            className="block mb-2 text-xs"
            style={{ color: '#071A3D', fontWeight: 700 }}
          >
            {t(lang, 'login.pin')}
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="••••"
            className="w-full px-4 py-3.5 rounded-2xl outline-none text-center transition-all"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E6ECF6',
              boxShadow: '0 1px 3px rgba(8, 39, 101, 0.04)',
              fontSize: '18px',
              letterSpacing: '0.5em',
              fontFamily: 'monospace',
              color: '#061742',
              fontWeight: 700,
            }}
            onFocus={(e) => (e.target.style.borderColor = '#005BFF')}
            onBlur={(e) => (e.target.style.borderColor = '#E6ECF6')}
          />
        </div>

        {/* Checkbox تذكّرني */}
        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4"
            style={{ accentColor: '#005BFF' }}
          />
          <span className="text-xs" style={{ color: '#7E8AA3', fontWeight: 600 }}>
            {t(lang, 'login.remember')}
          </span>
        </label>

        {error && (
          <div
            className="rounded-xl px-3 py-2.5 text-center"
            style={{
              background: 'rgba(240, 68, 68, 0.08)',
              border: '1px solid rgba(240, 68, 68, 0.2)',
              color: '#F04444',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {/* زر تسجيل دخول بتدرّج فاخر */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          style={{
            background: loading
              ? 'linear-gradient(135deg, #4A5568, #2D3748)'
              : 'linear-gradient(135deg, #1E3A8A 0%, #005BFF 50%, #168BFF 100%)',
            fontFamily: '"IBM Plex Sans Arabic", system-ui, sans-serif',
            fontSize: '16px',
            fontWeight: 700,
            boxShadow: '0 10px 25px -5px rgba(0, 91, 255, 0.5), 0 4px 10px -2px rgba(0, 91, 255, 0.3)',
            letterSpacing: '0.3px',
          }}
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {loading ? t(lang, 'login.loading') : t(lang, 'login.submit')}
        </button>
      </div>
    </div>
  );
}
