'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MeetupRatingPrompt } from './MeetupRatingPrompt';

interface Props { meetupId: string; hostId: string; hostUsername: string; meetupDate: string }

export function MeetupDetailClient({ meetupId, hostId, hostUsername, meetupDate }: Props) {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [myExtended, setMyExtended] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => {
      setMe(d?.user || null);
      if (d?.user) {
        fetch(`/api/meetups/${meetupId}`).then(r => r.ok ? r.json() : null).then(data => {
          if (data?.mine) { setMyStatus(data.mine.status || null); setMyExtended(data.mine.status_extended || null); }
        });
      }
    });
  }, [meetupId]);

  const rsvp = async (status: 'going' | 'maybe' | 'not_going') => {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/meetups/${meetupId}/attend`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || 'Failed'); return; }
      setMyStatus(d.status || status); setMyExtended(d.status_extended || null);
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true);
    await fetch(`/api/meetups/${meetupId}/attend`, { method: 'DELETE' });
    setMyStatus(null); setMyExtended(null); setBusy(false);
  };

  if (!me) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, textAlign: 'center' as const }}>
        <a href={`/login?next=/meetups/${meetupId}`} style={{ color: '#0d9488', fontWeight: 600 }}>Log in to RSVP</a>
      </div>
    );
  }
  if (me.id === hostId) {
    return (
      <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 12, padding: 16, color: '#065f46', fontSize: 14, fontWeight: 600 }}>
        You're the host of this meetup.
      </div>
    );
  }

  return (
    <div>
      {me && (
        <MeetupRatingPrompt meetupId={meetupId} meetupDate={meetupDate} hostUsername={hostUsername} hostId={hostId} viewerId={me?.id} viewerStatus={myStatus} />
      )}
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
      {myExtended === 'requested' && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          ⏳ Request sent — waiting for host approval
        </div>
      )}
      {myExtended === 'waitlist' && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          📋 You're on the waitlist. We'll let you know if a spot opens up.
        </div>
      )}
      {myExtended === 'rejected' && (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
          Request declined by host
        </div>
      )}
      {myExtended === 'invited' && (
        <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#065f46', fontWeight: 600 }}>
          ✉️ You've been invited — tap Going to accept.
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
        <button onClick={() => rsvp('going')} disabled={busy}
          style={{ background: myStatus === 'going' ? '#0d9488' : '#fff', color: myStatus === 'going' ? '#fff' : '#0d9488', border: '1.5px solid #0d9488', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', flex: '1 1 auto', minWidth: 110 }}>
          {myStatus === 'going' ? '✓ Going' : myExtended === 'requested' ? 'Requested' : myExtended === 'waitlist' ? 'On waitlist' : 'Going'}
        </button>
        <button onClick={() => rsvp('maybe')} disabled={busy}
          style={{ background: myStatus === 'maybe' ? '#fbbf24' : '#fff', color: myStatus === 'maybe' ? '#78350f' : '#92400e', border: '1.5px solid #fbbf24', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', flex: '1 1 auto', minWidth: 110 }}>
          Maybe
        </button>
        {(myStatus || myExtended) && (
          <button onClick={cancel} disabled={busy}
            style={{ background: '#fff', color: '#ef4444', border: '1.5px solid #fecaca', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            {myExtended === 'waitlist' || myExtended === 'requested' ? 'Withdraw' : 'Cancel RSVP'}
          </button>
        )}
      </div>
      {err && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {err} {err.includes('Verify') && <a href="/verify" style={{ color: '#0d9488', fontWeight: 600 }}>Verify now →</a>}
        </div>
      )}
    </div>
    </div>
  );
}
