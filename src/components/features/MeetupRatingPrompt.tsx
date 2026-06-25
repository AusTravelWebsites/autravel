'use client';
import { useEffect, useState } from 'react';

const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', amber: '#f59e0b' };

interface Props {
  meetupId: string;
  meetupDate: string;
  hostUsername: string;
  hostId: string;
  viewerId?: string;
  viewerStatus?: string | null; // from meetup_attendees (status/status_extended)
}

export function MeetupRatingPrompt({ meetupId, meetupDate, hostUsername, hostId, viewerId, viewerStatus }: Props) {
  const [existingStars, setExistingStars] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [comment, setComment] = useState('');
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const hoursSinceEnd = (Date.now() - new Date(meetupDate).getTime()) / 3600000;
  const eligible = !!viewerId && viewerId !== hostId && viewerStatus === 'going' && hoursSinceEnd >= 24 && hoursSinceEnd < 24 * 14; // 24h–14d window

  useEffect(() => {
    if (!eligible) return;
    fetch(`/api/users/${hostUsername}/rate`).then(r => r.ok ? r.json() : null).then(d => {
      // Is there a general rating already? We tag meetup rating via context below.
      fetch(`/api/meetup-ratings/${meetupId}/mine`).then(r => r.ok ? r.json() : null).then(m => {
        if (m?.stars) setExistingStars(m.stars);
        setShow(true);
      }).catch(() => setShow(true));
    });
  }, [eligible, hostUsername, meetupId]);

  if (!eligible || done) return null;
  if (!show) return null;

  const submit = async (stars: number) => {
    setPending(true); setErr('');
    try {
      const r = await fetch(`/api/meetup-ratings/${meetupId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stars, comment: comment.trim() || null }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Failed'); return; }
      setExistingStars(stars);
      setDone(true);
    } finally { setPending(false); }
  };

  return (
    <div style={{ background: '#fffbeb', border: `1px solid #fde68a`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>How was this meetup?</div>
      <div style={{ fontSize: 13, color: '#78350f', marginBottom: 10 }}>
        Your rating is private and helps other travellers pick trustworthy hosts.
      </div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
        {[1,2,3,4,5].map(n => (
          <span key={n} onClick={() => !pending && submit(n)}
            style={{ color: (existingStars && n <= existingStars) ? C.amber : '#d1d5db', fontSize: 26, cursor: pending ? 'default' : 'pointer', lineHeight: 1 }}>★</span>
        ))}
      </div>
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Optional — what did you think of the host?"
        rows={2} maxLength={500}
        style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
      {err && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
