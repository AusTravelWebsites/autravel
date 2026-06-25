'use client';
import { useEffect, useState } from 'react';

type Prefs = { necessary: true; analytics: boolean; marketing: boolean };
const KEY = 'bb-consent';
const VERSION = 1;

function loadPrefs(): Prefs | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (obj?.version !== VERSION) return null;
    return obj.prefs;
  } catch { return null; }
}

function savePrefs(prefs: Prefs) {
  const payload = { version: VERSION, prefs, updated: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(payload)); } catch {}
  // Also set a 1st-party cookie so the server (or admin snippets) can gate scripts.
  const cookieVal = encodeURIComponent(JSON.stringify(prefs));
  const maxAge = 60 * 60 * 24 * 365; // 12 months
  document.cookie = `bb-consent=${cookieVal}; Max-Age=${maxAge}; Path=/; SameSite=Lax; Secure`;
  // Notify listeners (analytics bootstrap code can listen)
  window.dispatchEvent(new CustomEvent('bb-consent-change', { detail: prefs }));
  (window as any).bbConsent = prefs;
  // Google Consent Mode v2 update
  try {
    const g = (window as any).gtag;
    if (typeof g === 'function') {
      g('consent', 'update', {
        ad_storage: prefs.marketing ? 'granted' : 'denied',
        ad_user_data: prefs.marketing ? 'granted' : 'denied',
        ad_personalization: prefs.marketing ? 'granted' : 'denied',
        analytics_storage: prefs.analytics ? 'granted' : 'denied',
      });
    }
  } catch {}
}

// Expose global `openCookieSettings()` so footer / other places can re-open
declare global { interface Window { bbConsent?: Prefs; openCookieSettings?: () => void } }

export function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setMounted(true);
    const existing = loadPrefs();
    if (existing) {
      (window as any).bbConsent = existing;
      setAnalytics(existing.analytics);
      setMarketing(existing.marketing);
    } else {
      setOpen(true);
    }
    window.openCookieSettings = () => { setShowPanel(true); setOpen(true); };
  }, []);

  if (!mounted || !open) return null;

  const acceptAll = () => { savePrefs({ necessary: true, analytics: true, marketing: true }); setOpen(false); setShowPanel(false); };
  const rejectAll = () => { savePrefs({ necessary: true, analytics: false, marketing: false }); setOpen(false); setShowPanel(false); };
  const savePanel = () => { savePrefs({ necessary: true, analytics, marketing }); setOpen(false); setShowPanel(false); };

  const sub = '#6b7280', teal = 'var(--brand)', border = '#e5e7eb';

  // Preferences panel
  if (showPanel) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div role="dialog" aria-label="Cookie preferences" style={{ background: '#fff', borderRadius: 14, maxWidth: 520, width: '100%', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' }}>Cookie preferences</h2>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: sub, lineHeight: 1.55 }}>
            BugBitten uses cookies to make the site work and to improve it. You can accept all, reject non-essential, or choose which categories to allow. You can change your choice any time via "Cookie settings" in the footer. See our <a href="/cookies" style={{ color: teal }}>Cookie Policy</a> and <a href="/privacy" style={{ color: teal }}>Privacy Policy</a>.
          </p>

          {[
            { title: 'Strictly necessary', desc: 'Required for login, session handling, security and basic site functionality. Cannot be disabled.', value: true, locked: true, set: () => {} },
            { title: 'Analytics', desc: 'Helps us understand how BugBitten is used (page views, errors) so we can improve it. Anonymous and aggregated.', value: analytics, locked: false, set: setAnalytics },
            { title: 'Marketing', desc: 'Used for personalised advertising on other sites. Off by default.', value: marketing, locked: false, set: setMarketing },
          ].map(row => (
            <div key={row.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderTop: `1px solid ${border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{row.title}</div>
                <div style={{ fontSize: 13, color: sub, marginTop: 2, lineHeight: 1.5 }}>{row.desc}</div>
              </div>
              <label style={{ position: 'relative', width: 44, height: 24, flexShrink: 0, cursor: row.locked ? 'not-allowed' : 'pointer' }}>
                <input type="checkbox" checked={row.value} disabled={row.locked} onChange={e => row.set(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: 999,
                  background: row.value ? teal : '#d1d5db',
                  opacity: row.locked ? 0.6 : 1,
                  transition: 'background 150ms',
                }} />
                <span style={{
                  position: 'absolute', top: 2, left: row.value ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left 150ms',
                }} />
              </label>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            <button onClick={rejectAll} style={{ flex: '1 1 auto', background: '#fff', color: '#374151', border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reject non-essential</button>
            <button onClick={savePanel} style={{ flex: '1 1 auto', background: '#fff', color: '#374151', border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Save preferences</button>
            <button onClick={acceptAll} style={{ flex: '1 1 auto', background: teal, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Accept all</button>
          </div>
        </div>
      </div>
    );
  }

  // Bottom banner
  return (
    <div role="dialog" aria-label="Cookies" aria-live="polite" style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9990,
      maxWidth: 960, margin: '0 auto',
      background: '#fff', borderRadius: 14, padding: 18,
      boxShadow: '0 16px 40px rgba(0,0,0,0.18)', border: `1px solid ${border}`,
      display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap',
    }}>
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 4 }}>We use cookies</div>
        <div style={{ fontSize: 13, color: sub, lineHeight: 1.55 }}>
          We use strictly necessary cookies to make BugBitten work. With your consent, we also use analytics and marketing cookies to improve the site. See our <a href="/cookies" style={{ color: teal }}>Cookie Policy</a> and <a href="/privacy" style={{ color: teal }}>Privacy Policy</a>.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={() => setShowPanel(true)} style={{ background: '#fff', color: '#374151', border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Preferences</button>
        <button onClick={rejectAll} style={{ background: '#fff', color: '#374151', border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reject non-essential</button>
        <button onClick={acceptAll} style={{ background: teal, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Accept all</button>
      </div>
    </div>
  );
}
