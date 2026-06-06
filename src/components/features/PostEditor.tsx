'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props { ownerId: string; postId: string; initialBody: string; initialIsPublic: boolean }

const C = { sub:'#6b7280', red:'#ef4444', border:'#e5e7eb', teal:'#0d9488', card:'#fff' };

export function PostEditor({ ownerId, postId, initialBody, initialIsPublic }: Props) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(initialBody || '');
  const [isPublic, setIsPublic] = useState(!!initialIsPublic);
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
      const r = await fetch(`/api/journal-entries?id=${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, is_public: isPublic }),
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
      const r = await fetch(`/api/journal-entries?id=${postId}`, { method: 'DELETE' });
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
      <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} style={{ width:'100%', padding:'10px 12px', borderRadius:8, border:`1px solid ${C.border}`, fontSize:14, color:'#111', boxSizing:'border-box' as const, outline:'none', resize:'vertical' as const, fontFamily:'inherit', lineHeight:1.5 }} />
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'#374151', cursor:'pointer' }}>
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          Public
        </label>
        {err && <span style={{ color:C.red, fontSize:12 }}>{err}</span>}
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={() => { setEditing(false); setBody(initialBody); setIsPublic(initialIsPublic); }} style={{ background:'#fff', color:C.sub, padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer', border:`1px solid ${C.border}`, fontFamily:'inherit' }}>Cancel</button>
          <button onClick={save} disabled={busy} style={{ background:C.teal, color:'#fff', padding:'6px 14px', borderRadius:6, fontSize:12, fontWeight:700, cursor:busy?'wait':'pointer', border:'none', fontFamily:'inherit' }}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
