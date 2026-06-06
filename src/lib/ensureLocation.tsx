'use client';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';

export interface Coords { lat: number; lng: number; accuracy: number }

// Fresh-prompt each call. Shows an explanatory modal first so users understand
// WHY we need location and aren't surprised by the browser prompt.
export function ensureLocation(reason: string): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    const cleanup = () => { try { root.unmount(); host.remove(); } catch {} };

    const Modal = () => {
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState('');

      const cancel = () => { cleanup(); reject(new Error('User cancelled')); };

      const grant = () => {
        setBusy(true); setErr('');
        navigator.geolocation.getCurrentPosition(
          pos => {
            cleanup();
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
          },
          e => {
            setBusy(false);
            if (e.code === 1) setErr('Permission denied. Please allow location in your browser settings and try again.');
            else if (e.code === 2) setErr('Location unavailable. Move to a spot with a clearer GPS signal and retry.');
            else if (e.code === 3) setErr('Timed out waiting for a GPS fix. Please try again.');
            else setErr('Could not get your location. Please try again.');
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      };

      const teal = '#0d9488', sub = '#6b7280', border = '#e5e7eb', red = '#ef4444';
      return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} role="dialog" aria-label="Share your location">
          <div style={{ background: '#fff', borderRadius: 14, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 44, textAlign: 'center' as const, marginBottom: 8 }}>📍</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center' as const }}>Share your location</h2>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: sub, lineHeight: 1.6, textAlign: 'center' as const }}>{reason}</p>
            <p style={{ margin: '0 0 20px', fontSize: 12, color: sub, lineHeight: 1.5, textAlign: 'center' as const }}>Your browser will ask for permission next. We only use your location for this action — we don't track you.</p>
            {err && <div style={{ background: '#fef2f2', border: `1px solid #fecaca`, color: red, fontSize: 13, padding: '10px 12px', borderRadius: 8, marginBottom: 14 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={cancel} disabled={busy} style={{ flex: 1, background: '#fff', color: '#374151', border: `1px solid ${border}`, borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={grant} disabled={busy} style={{ flex: 1, background: teal, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{busy ? 'Locating…' : 'Share location'}</button>
            </div>
          </div>
        </div>
      );
    };

    root.render(<Modal />);
  });
}
