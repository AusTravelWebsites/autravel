'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete';

interface Channel {
  id: string;
  slug: string;
  city_name: string;
  country: string | null;
  member_count: number;
  message_count: number;
  last_activity_at: string | null;
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa' };

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ChannelsPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newQuery, setNewQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const load = (search = '') => {
    setLoading(true);
    fetch('/api/channels' + (search ? '?q=' + encodeURIComponent(search) : ''))
      .then(r => r.ok ? r.json() : null)
      .then(d => { setChannels(d?.channels || []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openOrCreate = async () => {
    if (!newQuery.trim() || submitting) return;
    setSubmitting(true); setErr('');
    try {
      const r = await fetch('/api/channels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: newQuery.trim() }),
      });
      const d = await r.json();
      if (!r.ok || !d?.channel) { setErr(d?.error || 'Could not create'); return; }
      router.push(`/channels/${d.channel.slug}`);
    } catch { setErr('Network error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 800, color: C.text, margin: '0 0 6px' }}>City Channels</h1>
        <p style={{ color: C.sub, fontSize: 14, margin: '0 0 24px' }}>
          Every city has a live chat. Drop in to swap tips, find travel buddies, ask what's on tonight, or plan your next adventure with fellow travellers on the ground.
        </p>

        {/* Create a city channel */}
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 18, marginBottom: 22 }}>
          {!creating ? (
            <button onClick={() => setCreating(true)}
              style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              + Start a channel for your city
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Find or create a city channel</div>
              <PlaceAutocomplete value={newQuery} onChange={setNewQuery} placeholder="Search a city…"
                inputStyle={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }} />
              <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>We'll look it up on Google Maps. If a channel exists you'll be taken there; otherwise we'll create it.</div>
              {err && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={openOrCreate} disabled={!newQuery.trim() || submitting}
                  style={{ background: newQuery.trim() ? C.teal : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: newQuery.trim() && !submitting ? 'pointer' : 'default' }}>
                  {submitting ? 'Loading…' : 'Go'}
                </button>
                <button onClick={() => { setCreating(false); setErr(''); setNewQuery(''); }}
                  style={{ background: '#fff', color: C.sub, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Search / list */}
        <div style={{ marginBottom: 14 }}>
          <input value={q} onChange={e => { setQ(e.target.value); load(e.target.value); }}
            placeholder="Search channels by city or country…"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }} />
        </div>

        {loading ? (
          <div style={{ color: C.sub, textAlign: 'center' as const, padding: 40 }}>Loading…</div>
        ) : channels.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center' as const, color: C.sub }}>
            No channels yet{q ? ` for "${q}"` : ''}. Be the first to start one.
          </div>
        ) : (
          <>
            {!q && channels.filter(c => c.message_count >= 3).length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 8 }}>🔥 Most active</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                  {[...channels].sort((a, b) => b.message_count - a.message_count).slice(0, 3).map(c => (
                    <Link key={c.id} href={`/channels/${c.slug}`} style={{ textDecoration: 'none' }}>
                      <div style={{ background: C.card, border: `1px solid #fde68a`, borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>#{c.city_name}</div>
                        <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, marginTop: 2 }}>💬 {c.message_count} · 👥 {c.member_count}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {channels.map(c => (
              <Link key={c.id} href={`/channels/${c.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: C.text }}>#{c.city_name}</span>
                    {c.country && <span style={{ color: C.sub, fontSize: 12 }}>· {c.country}</span>}
                  </div>
                  <div style={{ color: C.sub, fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                    <span>💬 {c.message_count}</span>
                    <span>👥 {c.member_count}</span>
                    {c.last_activity_at && <span>Active {timeAgo(c.last_activity_at)}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
