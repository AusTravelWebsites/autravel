'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  ownerId: string;
  itemId: string;
  endpoint: string;       // e.g. '/api/journal-entries' or '/api/reviews'
  itemKind: string;       // 'post' | 'review' | 'trip' (for confirm wording)
  editHref?: string;      // optional: if set, Edit becomes a link, else opens onEdit callback
  onEdit?: () => void;    // for inline modal-driven edits
  onDeleted?: () => void;
}

const C = { sub:'#6b7280', red:'#ef4444', border:'#e5e7eb' };

export function UserItemActions({ ownerId, itemId, endpoint, itemKind, editHref, onEdit, onDeleted }: Props) {
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

  const onDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch(`${endpoint}?id=${itemId}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Delete failed');
      }
      onDeleted?.();
      router.refresh();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  if (!isOwner) return null;

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, paddingTop:10, borderTop:`1px solid #f3f4f6` }}>
      {editHref ? (
        <a href={editHref} style={{ background:'#fff', color:'#374151', padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600, textDecoration:'none', border:`1px solid ${C.border}` }}>Edit</a>
      ) : onEdit ? (
        <button onClick={onEdit} style={{ background:'#fff', color:'#374151', padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', border:`1px solid ${C.border}`, fontFamily:'inherit' }}>Edit</button>
      ) : null}
      <button onClick={onDelete} disabled={busy}
        style={{ background: confirming ? '#fef2f2' : '#fff', color:C.red, padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:busy?'wait':'pointer', border:`1px solid ${confirming?'#fca5a5':C.border}`, fontFamily:'inherit' }}>
        {confirming ? (busy ? 'Deleting…' : 'Click again') : 'Delete'}
      </button>
      {confirming && !busy && (
        <button onClick={() => setConfirming(false)} style={{ background:'transparent', color:C.sub, border:'none', cursor:'pointer', fontSize:12, fontFamily:'inherit', padding:0 }}>Cancel</button>
      )}
      {err && <span style={{ color:C.red, fontSize:12 }}>{err}</span>}
    </div>
  );
}
