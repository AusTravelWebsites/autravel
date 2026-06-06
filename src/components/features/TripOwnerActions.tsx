'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { tripId: string; ownerId: string }

export function TripOwnerActions({ tripId, ownerId }: Props) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/users?me=1')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user?.id === ownerId) setIsOwner(true); })
      .catch(() => {});
  }, [ownerId]);

  const onDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/trips?id=${tripId}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Delete failed');
      }
      router.push('/trips');
    } catch (e: any) { setError(e.message); setBusy(false); }
  };

  if (!isOwner) return null;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' as const }}>
      <a href={`/trips/${tripId}/edit`} style={{ background: '#fff', color: '#374151', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid #e5e7eb' }}>
        Edit trip
      </a>
      <button onClick={onDelete} disabled={busy}
        style={{ background: confirming ? '#fef2f2' : '#fff', color: '#dc2626', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', border: `1px solid ${confirming ? '#fca5a5' : '#e5e7eb'}`, fontFamily: 'inherit' }}>
        {confirming ? (busy ? 'Deleting…' : 'Click again to confirm') : 'Delete trip'}
      </button>
      {confirming && !busy && (
        <button onClick={() => setConfirming(false)} style={{ background: 'transparent', color: '#6b7280', padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}>
          Cancel
        </button>
      )}
      {error && <span style={{ color: '#dc2626', fontSize: 13 }}>{error}</span>}
    </div>
  );
}
