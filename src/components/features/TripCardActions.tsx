'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { ownerId: string; tripId: string }

const C = { sub:'#6b7280', red:'#ef4444', border:'#e5e7eb' };

export function TripCardActions({ ownerId, tripId }: Props) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user?.id === ownerId) setIsOwner(true);
    }).catch(() => {});
  }, [ownerId]);

  if (!isOwner) return null;

  const onDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/trips?id=${tripId}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Delete failed'); }
      router.refresh();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, paddingTop:10, borderTop:`1px solid #f3f4f6` }}>
      <a href={`/trips/${tripId}/edit`} style={{ background:'#fff', color:'#374151', padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600, textDecoration:'none', border:`1px solid ${C.border}` }}>Edit</a>
      <button onClick={onDelete} disabled={busy}
        style={{ background: confirming ? '#fef2f2' : '#fff', color:C.red, padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:busy?'wait':'pointer', border:`1px solid ${confirming?'#fca5a5':C.border}`, fontFamily:'inherit' }}>
        {confirming ? (busy ? 'Deleting…' : 'Click again') : 'Delete'}
      </button>
      {confirming && !busy && (
        <button onClick={() => setConfirming(false)} style={{ background:'transparent', color:C.sub, border:'none', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>Cancel</button>
      )}
      {err && <span style={{ color:C.red, fontSize:12 }}>{err}</span>}
    </div>
  );
}
