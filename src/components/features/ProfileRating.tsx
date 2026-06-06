'use client';
import { useEffect, useState } from 'react';

interface Props {
  username: string;
  initialRating: number | null;
  initialCount: number;
}

export function ProfileRating({ username, initialRating, initialCount }: Props) {
  const [rating, setRating] = useState(initialRating);
  const [count, setCount] = useState(initialCount);
  const [myStars, setMyStars] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [hasViewer, setHasViewer] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => {
      setHasViewer(!!d?.user);
      const self = !!d?.user && d.user.username === username;
      setIsSelf(self);
      setViewerLoaded(true);
      if (d?.user && !self) {
        fetch(`/api/users/${username}/rate`).then(r => r.ok ? r.json() : null).then(data => {
          if (data?.my) { setMyStars(data.my.stars); setComment(data.my.comment || ''); }
        });
      }
    });
  }, [username]);

  const submit = async (stars: number) => {
    setSaving(true); setErr('');
    try {
      const res = await fetch(`/api/users/${username}/rate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stars, comment: comment.trim() || null }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || 'Failed'); return; }
      setRating(d.rating); setCount(d.count); setMyStars(stars); setOpen(false);
    } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    const res = await fetch(`/api/users/${username}/rate`, { method: 'DELETE' });
    const d = await res.json();
    setSaving(false);
    if (res.ok) {
      setMyStars(null); setComment('');
      const r2 = await fetch(`/api/users/${username}/rate`).then(x => x.json());
      setRating(r2.rating); setCount(r2.count);
    }
  };

  const Stars = ({ value, onClick }: { value: number; onClick?: (s: number) => void }) => (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s}
          onClick={onClick ? () => onClick(s) : undefined}
          style={{ color: s <= value ? '#f97316' : '#d1d5db', fontSize: 18, cursor: onClick ? 'pointer' : 'default', lineHeight: 1 }}>★</span>
      ))}
    </span>
  );

  if (rating == null && count === 0 && (isSelf || !hasViewer)) {
    return (
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
        {isSelf ? 'No ratings yet' : ''}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
        {rating != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: '#f59e0b' }}>★</span>
            {Number(rating).toFixed(1)}
            <span style={{ fontWeight: 500, color: '#78350f' }}>({count})</span>
          </span>
        )}
        {!isSelf && viewerLoaded && hasViewer && (
          <button onClick={() => setOpen(o => !o)}
            style={{ background: myStars ? '#0d9488' : 'transparent', color: myStars ? '#fff' : '#0d9488', border: '1px solid #0d9488', borderRadius: 999, padding: '3px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {myStars ? `Your rating: ${myStars}★` : 'Rate this traveller'}
          </button>
        )}
      </div>

      {open && !isSelf && hasViewer && (
        <div style={{ marginTop: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, maxWidth: 360 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            {myStars ? 'Update your rating' : 'Rate this traveller'}
          </div>
          <Stars value={myStars || 0} onClick={submit} />
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Optional — what was meeting them like?"
            rows={2} maxLength={500}
            style={{ width: '100%', marginTop: 8, padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const }}
          />
          {err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {myStars && <button onClick={remove} disabled={saving} style={{ background: 'none', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>Remove</button>}
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: '1px solid #e5e7eb', color: '#6b7280', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
