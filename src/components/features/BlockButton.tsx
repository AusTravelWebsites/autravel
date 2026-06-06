'use client';
import { useEffect, useState } from 'react';

interface Props { username: string; userId: string }

export function BlockButton({ username, userId }: Props) {
  const [me, setMe] = useState<any>(null);
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => {
      setMe(d?.user || null);
      if (d?.user && d.user.username !== username) {
        fetch('/api/blocks').then(r => r.ok ? r.json() : null).then(b => {
          setBlocked(!!(b?.blocks || []).find((x: any) => x.id === userId));
        });
      }
    });
  }, [username, userId]);

  if (!me || me.username === username) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (blocked) {
        await fetch(`/api/blocks?user_id=${userId}`, { method: 'DELETE' });
        setBlocked(false);
      } else {
        if (!confirm(`Block @${username}? They won't see your content, and you won't see theirs. You'll also unfollow each other.`)) {
          setBusy(false); return;
        }
        await fetch('/api/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId }) });
        setBlocked(true);
      }
    } finally { setBusy(false); setOpen(false); }
  };

  return (
    <div style={{ position: 'relative' as const, display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} aria-label="More actions"
        style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#6b7280', borderRadius: 8, width: 36, height: 36, fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>
        ⋯
      </button>
      {open && (
        <div style={{ position: 'absolute' as const, right: 0, top: '100%', marginTop: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 180, padding: 4 }}>
          <button onClick={toggle} disabled={busy}
            style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: blocked ? '#0d9488' : '#ef4444', fontSize: 13, fontWeight: 600, padding: '10px 14px', textAlign: 'left' as const, cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit' }}>
            {busy ? '…' : (blocked ? `Unblock @${username}` : `Block @${username}`)}
          </button>
        </div>
      )}
    </div>
  );
}
