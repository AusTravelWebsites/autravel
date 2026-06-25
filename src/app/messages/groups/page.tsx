'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'var(--brand)', tealLight:'var(--brand-light)' };

type Conv = { id:string; name:string; description?:string; avatar_url?:string; created_by:string; my_role:string; member_count:number; last_body?:string; last_message_at?:string; unread_count:number };
type Friend = { id:string; username:string; display_name:string; avatar_url?:string };

function timeAgo(iso?: string) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}

export default function GroupsPage() {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const router = useRouter();

  const load = () => fetch('/api/conversations').then(r => r.ok ? r.json() : {}).then(d => { setConvs(d.conversations || []); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'24px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' as const }}>
          <Link href="/messages" style={{ color:C.sub, fontSize:14, textDecoration:'none' }}>← Messages</Link>
          <h1 style={{ fontSize:22, fontWeight:700, color:C.text, margin:0, flex:1 }}>Group chats</h1>
          <button onClick={() => setShowNew(true)} style={{ background:C.teal, color:'#fff', border:'none', borderRadius:99, padding:'9px 18px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+ New group</button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center' as const, padding:40, color:C.sub }}>Loading…</div>
        ) : convs.length === 0 ? (
          <div style={{ textAlign:'center' as const, padding:48, background:C.card, borderRadius:16, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
            <div style={{ fontWeight:600, fontSize:16, color:C.text, marginBottom:8 }}>No groups yet</div>
            <div style={{ color:C.sub, fontSize:14 }}>Create a group to plan activities with fellow travellers.</div>
            <button onClick={() => setShowNew(true)} style={{ marginTop:16, background:C.teal, color:'#fff', border:'none', borderRadius:99, padding:'10px 24px', fontWeight:700, cursor:'pointer', fontSize:14 }}>Create your first group</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
            {convs.map(c => (
              <Link key={c.id} href={`/messages/groups/${c.id}`} style={{ textDecoration:'none' }}>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ width:50, height:50, borderRadius:'50%', background:C.tealLight, color:C.teal, border:`1px solid #99f6e4`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0, overflow:'hidden' as const }}>
                    {c.avatar_url ? <img loading="lazy" decoding="async" src={c.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' as const }} /> : '👥'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ color:C.text, fontWeight:700, fontSize:15 }}>{c.name}</div>
                      {c.my_role === 'owner' && <span style={{ background:'#fef3c7', color:'#92400e', fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99 }}>Owner</span>}
                      {c.my_role === 'admin' && <span style={{ background:C.tealLight, color:C.teal, fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:99 }}>Admin</span>}
                    </div>
                    <div style={{ color:C.sub, fontSize:12, marginTop:2, overflow:'hidden' as const, textOverflow:'ellipsis' as const, whiteSpace:'nowrap' as const }}>
                      {c.member_count} {c.member_count === 1 ? 'member' : 'members'}{c.last_body ? ' · ' + c.last_body.slice(0, 80) : ''}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' as const, flexShrink:0 }}>
                    {c.unread_count > 0 && <div style={{ background:C.teal, color:'#fff', borderRadius:99, padding:'1px 9px', fontSize:11, fontWeight:700, display:'inline-block' }}>{c.unread_count}</div>}
                    <div style={{ color:C.sub, fontSize:11, marginTop:4 }}>{timeAgo(c.last_message_at)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showNew && <NewGroupModal onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); router.push(`/messages/groups/${id}`); }} />}
    </div>
  );
}

function NewGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/follows?mutual=1').then(r => r.ok ? r.json() : {}).then(d => setFriends(d.users || [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(f => (f.display_name||'').toLowerCase().includes(q) || (f.username||'').toLowerCase().includes(q));
  }, [friends, search]);

  const toggle = (id: string) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const create = async () => {
    if (!name.trim()) { setErr('Please give the group a name.'); return; }
    setCreating(true); setErr('');
    try {
      const r = await fetch('/api/conversations', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, member_ids: [...picked] }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to create');
      onCreated(d.conversation.id);
    } catch (e: any) { setCreating(false); setErr(e.message); }
  };

  const inp: React.CSSProperties = { width:'100%', padding:'10px 14px', borderRadius:10, border:`1px solid ${C.border}`, fontSize:14, color:C.text, background:'#fff', boxSizing:'border-box' as const, outline:'none', fontFamily:'inherit' };

  return (
    <div style={{ position:'fixed' as const, inset:0, background:'rgba(15,23,42,0.55)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} role="dialog" aria-label="New group">
      <div style={{ background:'#fff', borderRadius:16, maxWidth:520, width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column' as const, boxShadow:'0 20px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'18px 22px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:C.text }}>New group chat</h2>
          <button onClick={onClose} aria-label="Close" style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:C.sub, lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:22, overflowY:'auto' as const, flex:1, display:'flex', flexDirection:'column' as const, gap:12 }}>
          <div>
            <label style={{ fontSize:13, color:'#374151', fontWeight:600, display:'block', marginBottom:6 }}>Group name *</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Bali surf trip Feb 2026" maxLength={80} />
          </div>
          <div>
            <label style={{ fontSize:13, color:'#374151', fontWeight:600, display:'block', marginBottom:6 }}>Description (optional)</label>
            <textarea style={{ ...inp, minHeight:60, resize:'vertical' as const, lineHeight:1.5 }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Planning our Bali trip — flights, villas, surf spots." maxLength={300} />
          </div>
          <div>
            <label style={{ fontSize:13, color:'#374151', fontWeight:600, display:'block', marginBottom:6 }}>Add members ({picked.size})</label>
            <input style={inp} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friends…" />
            <div style={{ marginTop:10, maxHeight:260, overflowY:'auto' as const, border:`1px solid ${C.border}`, borderRadius:10, background:'#fff' }}>
              {filtered.length === 0 ? (
                <div style={{ padding:16, color:C.sub, fontSize:13, textAlign:'center' as const }}>
                  {friends.length === 0 ? 'No friends yet — follow mutually to add people to groups.' : 'No matches'}
                </div>
              ) : filtered.map(f => {
                const on = picked.has(f.id);
                return (
                  <div key={f.id} onClick={() => toggle(f.id)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', borderBottom:`1px solid ${C.bg}`, background: on ? C.tealLight : 'transparent' }}>
                    <div style={{ width:34, height:34, borderRadius:'50%', background:C.teal, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0, overflow:'hidden' as const }}>
                      {f.avatar_url ? <img loading="lazy" decoding="async" src={f.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' as const }} /> : (f.display_name||'?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:14, color:C.text }}>{f.display_name}</div>
                      <div style={{ fontSize:12, color:C.sub }}>@{f.username}</div>
                    </div>
                    <div style={{ width:22, height:22, borderRadius:5, border:`2px solid ${on ? C.teal : C.border}`, background: on ? C.teal : '#fff', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:700, flexShrink:0 }}>{on ? '✓' : ''}</div>
                  </div>
                );
              })}
            </div>
          </div>
          {err && <div style={{ color:'#ef4444', fontSize:13 }}>{err}</div>}
        </div>
        <div style={{ padding:16, borderTop:`1px solid ${C.border}`, display:'flex', gap:10, justifyContent:'flex-end' as const }}>
          <button onClick={onClose} disabled={creating} style={{ background:'#fff', color:'#374151', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 18px', fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          <button onClick={create} disabled={creating} style={{ background: creating ? C.sub : C.teal, color:'#fff', border:'none', borderRadius:10, padding:'10px 20px', fontSize:14, fontWeight:700, cursor: creating ? 'wait' : 'pointer', fontFamily:'inherit' }}>{creating ? 'Creating…' : 'Create group'}</button>
        </div>
      </div>
    </div>
  );
}
