'use client';
import { useEffect, useState } from 'react';

interface Props { placeId: string }

export function FavouriteButton({ placeId }: Props) {
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch('/api/favourites?ids=1')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ids) { setAuthed(true); setFav(d.ids.includes(placeId)); } })
      .catch(() => {});
  }, [placeId]);

  const toggle = async () => {
    if (busy) return;
    if (!authed) { window.location.href = '/login'; return; }
    const next = !fav;
    setFav(next); setBusy(true);
    try {
      const r = await fetch('/api/favourites', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id: placeId }),
      });
      if (!r.ok) {
        setFav(!next);
        if (r.status === 401) window.location.href = '/login';
      }
    } catch { setFav(!next); }
    finally { setBusy(false); }
  };

  return (
    <button onClick={toggle} disabled={busy}
      style={{
        background: fav ? '#fff' : '#fff',
        color: fav ? '#ef4444' : '#374151',
        border: `1px solid ${fav ? '#fca5a5' : '#e5e7eb'}`,
        padding: '12px 24px', borderRadius: 20, fontSize: 14, fontWeight: 600,
        cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
        fontFamily: 'inherit',
      }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{fav ? '\u2665' : '\u2661'}</span>
      {fav ? 'Saved' : 'Save'}
    </button>
  );
}
