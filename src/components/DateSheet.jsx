// src/components/DateSheet.jsx
// Bottom sheet لاختيار التاريخ — مطابق لـ openSheet('date') في الـ prototype.
// خيارات البروتوتايب: اليوم / أمس / قبل يومين / تاريخ مخصص…
import { useState, useEffect, useRef } from 'react';
import SheetPortal from './SheetPortal';

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() { return isoDay(new Date()); }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return isoDay(d); }
function twoDaysAgoStr() { const d = new Date(); d.setDate(d.getDate() - 2); return isoDay(d); }

export default function DateSheet({ open, currentDate, onPick, onClose, lang = 'ar' }) {
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState(currentDate || todayStr());
  const customInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setCustomMode(false);
    setCustomValue(currentDate || todayStr());
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, currentDate, onClose]);

  if (!open) return null;

  const T = todayStr();
  const Y = yesterdayStr();
  const TD = twoDaysAgoStr();

  const opts = [
    { label: lang === 'en' ? 'Today' : 'اليوم', value: T },
    { label: lang === 'en' ? 'Yesterday' : 'أمس', value: Y },
    { label: lang === 'en' ? '2 days ago' : 'قبل يومين', value: TD },
  ];

  const title = lang === 'en' ? 'Select date' : 'اختر التاريخ';
  const customLabel = lang === 'en' ? 'Custom date…' : 'تاريخ مخصص…';

  const handleCustomConfirm = () => {
    if (customValue) {
      onPick?.(customValue);
      onClose?.();
    }
  };

  return (
    <SheetPortal>
      <div className="tw-sheet-overlay show" onClick={onClose} />
      <div className="tw-sheet-panel show" role="dialog" aria-modal="true">
        <div className="tw-sheet-grab" />
        <h3>{title}</h3>

        {!customMode && opts.map((o) => {
          const isActive = o.value === currentDate;
          return (
            <div
              key={o.value}
              className={`tw-sheet-opt${isActive ? ' active' : ''}`}
              onClick={() => { onPick?.(o.value); onClose?.(); }}
              role="button"
              tabIndex={0}
            >
              <span>{o.label}</span>
              <span style={{ color: 'var(--tw-muted)' }}>{isActive ? '✓' : '›'}</span>
            </div>
          );
        })}

        {!customMode && (
          <div
            className="tw-sheet-opt"
            onClick={() => {
              setCustomMode(true);
              setTimeout(() => customInputRef.current?.showPicker?.() || customInputRef.current?.focus(), 50);
            }}
            role="button"
            tabIndex={0}
          >
            <span>{customLabel}</span>
            <span style={{ color: 'var(--tw-muted)' }}>›</span>
          </div>
        )}

        {customMode && (
          <div style={{ padding: 4 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tw-muted)', marginBottom: 6 }}>
              {lang === 'en' ? 'Pick a date' : 'اختر تاريخاً'}
            </label>
            <input
              ref={customInputRef}
              type="date"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              max={T}
              style={{
                width: '100%',
                height: 46,
                border: '1.5px solid var(--tw-line)',
                borderRadius: 11,
                padding: '0 12px',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--tw-navy)',
                background: '#FAFCFF',
                outline: 'none',
                fontFamily: 'inherit',
                marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setCustomMode(false)}
                style={{
                  flex: 0.6, padding: 12, borderRadius: 12,
                  fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  background: '#fff', border: '1.5px solid var(--tw-line)',
                  color: 'var(--tw-navy)', fontFamily: 'inherit',
                }}
              >
                {lang === 'en' ? 'Back' : 'رجوع'}
              </button>
              <button
                type="button"
                onClick={handleCustomConfirm}
                style={{
                  flex: 1, padding: 12, borderRadius: 12,
                  fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  background: 'linear-gradient(145deg, var(--tw-blue), var(--tw-navy2))',
                  color: '#fff', border: 'none', fontFamily: 'inherit',
                }}
              >
                {lang === 'en' ? 'Confirm' : 'تأكيد'}
              </button>
            </div>
          </div>
        )}
      </div>
    </SheetPortal>
  );
}
