'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', amber: '#f59e0b', red: '#ef4444' };

interface Pending {
  user_id: string;
  created_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verification_status: string | null;
  bb_rating: number | null;
  bb_rating_count: number | null;
}

export function MeetupHostPanel({ meetupId, hostId }: { meetupId: string; hostId: string }) {
  const [me, setMe] = useState<any>(null);
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => setMe(d?.user || null));
  }, []);

  useEffect(() => {
    if (!me || me.id !== hostId) return;
    load();
  }, [me, hostId, meetupId]);

  const load = async () => {
    const r = await fetch(`/api/meetups/${meetupId}/approve`);
    const d = await r.json();
    if (r.ok) setPending(d.pending || []);
  };

  const act = async (userId: string, action: 'approve' | 'reject') => {
    setBusy(userId);
    try {
      const r = await fetch(`/api/meetups/${meetupId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action }),
      });
      if (r.ok) setPending(p => (p || []).filter(x => x.user_id !== userId));
    } finally { setBusy(null); }
  };

  if (!me || me.id !== hostId) return null;
  if (!pending || pending.length === 0) return null;

  return (
    <div style={{ background: '#f0fdfa', border: `1px solid #99f6e4`, borderRadius: 12, padding: 14, marginTop: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 8 }}>Requests to join ({pending.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
        {pending.map(p => (
          <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.card, borderRadius: 8, padding: 8 }}>
            <Link href={`/${p.username}`} style={{ flexShrink: 0 }}>
              {p.avatar_url
                ? <img loading="lazy" decoding="async" src={p.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' as const }} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontWeight: 700 }}>{(p.display_name || p.username || '?')[0].toUpperCase()}</div>}
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link href={`/${p.username}`} style={{ fontSize: 13, fontWeight: 700, color: C.text, textDecoration: 'none' }}>
                {p.display_name || p.username}
              </Link>
              {p.verification_status === 'verified' && <span title="Verified" style={{ color: C.teal, fontSize: 11, marginLeft: 4 }}>✓</span>}
              <div style={{ fontSize: 11, color: C.sub }}>
                @{p.username}
                {p.bb_rating != null && <span style={{ marginLeft: 6, color: '#92400e' }}>★ {Number(p.bb_rating).toFixed(1)}</span>}
              </div>
            </div>
            <button onClick={() => act(p.user_id, 'approve')} disabled={busy === p.user_id}
              style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Approve
            </button>
            <button onClick={() => act(p.user_id, 'reject')} disabled={busy === p.user_id}
              style={{ background: '#fff', color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Reject
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
