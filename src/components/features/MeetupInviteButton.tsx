'use client';
import { useEffect, useState } from 'react';

const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', red: '#ef4444' };

interface Candidate { id: string; username: string; display_name: string; avatar_url: string | null; already: boolean }

export function MeetupInviteButton({ meetupId, hostId }: { meetupId: string; hostId: string }) {
  const [me, setMe] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => setMe(d?.user || null));
  }, []);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true); setLoading(true);
    const r = await fetch(`/api/meetups/${meetupId}/invite`);
    const d = await r.json();
    setCandidates(d.candidates || []); setLoading(false);
  };

  const send = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setSending(true);
    const r = await fetch(`/api/meetups/${meetupId}/invite`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_ids: ids }),
    });
    const d = await r.json();
    setSending(false);
    if (r.ok) { setDone(d.sent || 0); setSelected(new Set()); setTimeout(() => { setOpen(false); setDone(0); }, 1500); }
  };

  if (!me || me.id !== hostId) return null;

  const filtered = candidates.filter(c => !q || (c.display_name || '').toLowerCase().includes(q.toLowerCase()) || (c.username || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <button onClick={toggle} style={{ background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        Invite friends
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, zIndex: 1000, padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.card, borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' as const }}>
            <div style={{ padding: 16, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Invite friends to this meetup</div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.sub }}>×</button>
            </div>
            <div style={{ padding: 12, borderBottom: `1px solid ${C.border}` }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search followers…"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' as const, padding: 8 }}>
              {loading ? <div style={{ color: C.sub, padding: 20, textAlign: 'center' as const }}>Loading…</div>
                : filtered.length === 0 ? <div style={{ color: C.sub, padding: 20, textAlign: 'center' as const, fontSize: 13 }}>{candidates.length === 0 ? 'No followers yet. Grow your follower list to invite people.' : 'No matches.'}</div>
                : filtered.map(c => {
                    const picked = selected.has(c.id);
                    return (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: c.already ? 'default' : 'pointer', background: picked ? 'var(--brand-light)' : 'transparent', opacity: c.already ? 0.5 : 1 }}>
                        <input type="checkbox" disabled={c.already} checked={picked || c.already}
                          onChange={e => {
                            const s = new Set(selected);
                            if (e.target.checked) s.add(c.id); else s.delete(c.id);
                            setSelected(s);
                          }} />
                        {c.avatar_url
                          ? <img loading="lazy" decoding="async" src={c.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' as const }} />
                          : <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontWeight: 700 }}>{(c.display_name || c.username || '?')[0].toUpperCase()}</div>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.display_name || c.username}</div>
                          <div style={{ fontSize: 11, color: C.sub }}>@{c.username}{c.already ? ' · already invited/attending' : ''}</div>
                        </div>
                      </label>
                    );
                  })}
            </div>
            <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {done > 0 ? <div style={{ color: C.teal, fontSize: 13, fontWeight: 600 }}>✓ Sent {done} invite{done === 1 ? '' : 's'}</div>
                : <div style={{ fontSize: 12, color: C.sub }}>{selected.size} selected</div>}
              <button onClick={send} disabled={selected.size === 0 || sending}
                style={{ background: selected.size > 0 ? C.teal : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: selected.size > 0 && !sending ? 'pointer' : 'default' }}>
                {sending ? 'Sending…' : 'Send invites'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
