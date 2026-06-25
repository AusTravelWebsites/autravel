'use client';
import { useEffect, useState } from 'react';

interface Props { username: string; targetUserId: string }

export function ProfileFollowButton({ username, targetUserId }: Props) {
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/users?me=1')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.user) { setLoaded(true); return; }
        setMe({ id: d.user.id });
        fetch('/api/follows?me=1')
          .then(r => r.ok ? r.json() : null)
          .then(fd => {
            if (fd?.following) setFollowing(fd.following.some((f: any) => f.id === targetUserId));
            setLoaded(true);
          })
          .catch(() => setLoaded(true));
      })
      .catch(() => setLoaded(true));
  }, [targetUserId]);

  const onClick = async () => {
    if (!me) { window.location.href = '/login'; return; }
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const r = await fetch('/api/follows', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!r.ok) {
        setFollowing(!next);
        if (r.status === 401) window.location.href = '/login';
      }
    } catch {
      setFollowing(!next);
    } finally { setBusy(false); }
  };

  const isSelf = me && me.id === targetUserId;
  if (isSelf) {
    return (
      <a href="/settings" style={{ padding: '9px 24px', borderRadius: 8, background: '#f3f4f6', color: '#374151', textDecoration: 'none', fontWeight: 600, fontSize: 14, flexShrink: 0, border: '1px solid #e5e7eb' }}>
        Edit profile
      </a>
    );
  }

  const baseStyle: React.CSSProperties = {
    padding: '9px 24px', borderRadius: 8, fontWeight: 700, fontSize: 14, flexShrink: 0,
    border: 'none', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
    opacity: !loaded ? 0.6 : 1,
  };

  return (
    <button onClick={onClick} disabled={busy || !loaded}
      style={{ ...baseStyle,
        background: following ? '#fff' : 'var(--brand)',
        color: following ? 'var(--brand)' : '#fff',
        border: following ? '1px solid var(--brand)' : 'none',
      }}>
      {!loaded ? '…' : following ? 'Following' : 'Follow'}
    </button>
  );
}
