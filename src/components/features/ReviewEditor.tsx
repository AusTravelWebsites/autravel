'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { ownerId: string; reviewId: string; initialTitle: string; initialBody: string; initialRating: number }

const C = { sub:'#6b7280', red:'#ef4444', border:'#e5e7eb', teal:'var(--brand)', orange:'#f97316' };

export function ReviewEditor({ ownerId, reviewId, initialTitle, initialBody, initialRating }: Props) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [rating, setRating] = useState(initialRating);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user?.id === ownerId) setIsOwner(true);
    }).catch(() => {});
  }, [ownerId]);

  if (!isOwner) return null;

  const save = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/reviews?id=${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, rating }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Save failed'); }
      setEditing(false);
      router.refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const onDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/reviews?id=${reviewId}`, { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Delete failed'); }
      router.refresh();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };

  if (!editing) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, paddingTop:10, borderTop:`1px solid #f3f4f6` }}>
        <button onClick={() => setEditing(true)} style={{ background:'#fff', color:'#374151', padding:'6px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', border:`1px solid ${C.border}`, fontFamily:'inherit' }}>Edit</button>
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

  return (
    <div style={{ marginTop:12, padding:12, background:'#f9fafb', borderRadius:8, border:`1px solid ${C.border}` }}>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)" style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:`1px solid ${C.border}`, fontSize:14, marginBottom:8, boxSizing:'border-box' as const, outline:'none' }} />
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:`1px solid ${C.border}`, fontSize:14, marginBottom:8, boxSizing:'border-box' as const, outline:'none', resize:'vertical' as const, fontFamily:'inherit', lineHeight:1.5 }} />
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <span style={{ fontSize:13, color:'#374151', fontWeight:600, marginRight:4 }}>Rating:</span>
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color: n <= rating ? C.orange : '#d1d5db', padding:0, lineHeight:1 }}>★</button>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {err && <span style={{ color:C.red, fontSize:12 }}>{err}</span>}
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={() => { setEditing(false); setTitle(initialTitle); setBody(initialBody); setRating(initialRating); }} style={{ background:'#fff', color:C.sub, padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer', border:`1px solid ${C.border}`, fontFamily:'inherit' }}>Cancel</button>
          <button onClick={save} disabled={busy} style={{ background:C.teal, color:'#fff', padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:700, cursor:busy?'wait':'pointer', border:'none', fontFamily:'inherit' }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
