'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', amber: '#f59e0b' };

interface Traveller {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  verification_status: string | null;
  bb_rating: number | null;
  distance_km: number;
  created_at: string;
}

function formatDist(km: number) {
  const miles = km * 0.621371;
  if (miles < 1) return `${Math.round(miles * 10) / 10} mi away`;
  return `${Math.round(miles)} mi away`;
}
function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AutoMeetupsPage() {
  const [travellers, setTravellers] = useState<Traveller[] | null>(null);
  const [reason, setReason] = useState('');
  const [optedIn, setOptedIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingOpt, setSavingOpt] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/auto-meetups/nearby');
      if (r.status === 401) { window.location.href = '/login?next=/auto-meetups'; return; }
      const d = await r.json();
      setTravellers(d.travellers || []);
      setOptedIn(d.opted_in !== false);
      setReason(d.reason || '');
    } finally { setLoading(false); }
  };

  const toggleOptIn = async () => {
    setSavingOpt(true);
    const next = !optedIn;
    await fetch('/api/users/me', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto_meetup_opt_in: next }),
    });
    setOptedIn(next); setSavingOpt(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link href="/feed" style={{ color: C.sub, fontSize: 13, textDecoration: 'none' }}>← Back to feed</Link>
        <div style={{ marginTop: 12, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 10 }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 800, color: C.text, margin: 0 }}>Travellers near you</h1>
          <button onClick={toggleOptIn} disabled={savingOpt}
            style={{ background: optedIn ? '#fff' : C.teal, color: optedIn ? C.sub : '#fff', border: `1px solid ${optedIn ? C.border : C.teal}`, borderRadius: 999, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {savingOpt ? '…' : (optedIn ? '✓ Auto-meetups on' : 'Auto-meetups off')}
          </button>
        </div>
        <p style={{ color: C.sub, fontSize: 14, margin: '0 0 22px' }}>
          When 5+ travellers check in within 10 miles of each other, we let you know so you can meet up. Tweak this in <Link href="/settings" style={{ color: C.teal }}>Settings</Link>.
        </p>

        {!optedIn && (
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', marginBottom: 14, color: '#92400e', fontSize: 13 }}>
            Auto-meetups are currently <strong>off</strong>. Toggle them on above to get notified when travellers are nearby.
          </div>
        )}
        {loading ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, textAlign: 'center' as const, color: C.sub }}>Loading…</div>
        ) : travellers && travellers.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, textAlign: 'center' as const, color: C.sub }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🌏</div>
            <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginBottom: 6 }}>No travellers nearby right now</div>
            <div style={{ fontSize: 13 }}>{reason || "Once a few people check in within 10 miles, they'll show up here."}</div>
            <Link href="/check-in" style={{ display: 'inline-block', marginTop: 14, background: C.teal, color: '#fff', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Check in to share your location</Link>
          </div>
        ) : (
          <>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px', marginBottom: 16, color: '#92400e', fontSize: 14, fontWeight: 600 }}>
              {travellers!.length} traveller{travellers!.length === 1 ? '' : 's'} within 10 miles. Say hi!
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {travellers!.map(t => (
                <Link key={t.user_id} href={`/${t.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14, display: 'flex', gap: 12 }}>
                    {t.avatar_url
                      ? <img loading="lazy" decoding="async" src={t.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' as const, flexShrink: 0 }} />
                      : <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontWeight: 700, fontSize: 20, flexShrink: 0 }}>{(t.display_name || t.username || '?')[0].toUpperCase()}</div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.text, display: 'flex', gap: 4, alignItems: 'center' }}>
                        {t.display_name || t.username}
                        {t.verification_status === 'verified' && <span title="Verified" style={{ color: C.teal, fontSize: 11 }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 12, color: C.sub }}>@{t.username}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' as const, fontSize: 11, color: C.sub }}>
                        <span>📍 {formatDist(t.distance_km)}</span>
                        <span>· checked in {timeAgo(t.created_at)}</span>
                        {t.bb_rating != null && <span style={{ color: '#92400e' }}>· ★ {Number(t.bb_rating).toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ marginTop: 18, color: C.sub, fontSize: 13, textAlign: 'center' as const }}>
              Want to organise something? <Link href="/meetups/new" style={{ color: C.teal, fontWeight: 600 }}>Start a meetup</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
