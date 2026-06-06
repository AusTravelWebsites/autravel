'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MeetupInviteButton } from './MeetupInviteButton';

const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', red: '#ef4444', amber: '#f59e0b' };

interface Props { meetupId: string; hostId: string; status: string }

export function MeetupHostControls({ meetupId, hostId, status }: Props) {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => setMe(d?.user || null));
  }, []);

  if (!me || me.id !== hostId) return null;

  const cancel = async () => {
    if (!confirm('Cancel this meetup? All going attendees will be notified.')) return;
    setBusy(true);
    await fetch('/api/meetups', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: meetupId, status: 'cancelled' }),
    });
    setBusy(false);
    router.refresh();
  };

  const reopen = async () => {
    setBusy(true);
    await fetch('/api/meetups', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: meetupId, status: 'open' }),
    });
    setBusy(false);
    router.refresh();
  };

  const remove = async () => {
    if (!confirm('Delete this meetup permanently? This cannot be undone.')) return;
    setBusy(true);
    const r = await fetch(`/api/meetups?id=${meetupId}`, { method: 'DELETE' });
    setBusy(false);
    if (r.ok) router.push('/meetups');
  };

  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 10, marginTop: 14, display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginRight: 4 }}>Host tools:</span>
      <Link href={`/meetups/${meetupId}/edit`}
        style={{ background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
        Edit
      </Link>
      <MeetupInviteButton meetupId={meetupId} hostId={hostId} />
      {status !== 'cancelled' ? (
        <button onClick={cancel} disabled={busy}
          style={{ background: '#fff', color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Cancel meetup
        </button>
      ) : (
        <button onClick={reopen} disabled={busy}
          style={{ background: '#fff', color: C.teal, border: `1px solid ${C.teal}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Reopen meetup
        </button>
      )}
      <button onClick={remove} disabled={busy}
        style={{ background: '#fff', color: C.sub, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        Delete
      </button>
    </div>
  );
}
