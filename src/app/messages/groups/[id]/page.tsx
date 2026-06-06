'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488', tealLight:'#f0fdfa', red:'#ef4444' };

type Member = { user_id:string; role:'owner'|'admin'|'member'; username:string; display_name:string; avatar_url?:string };
type Message = { id:string; body:string; created_at:string; from_user_id:string; username:string; display_name:string; avatar_url?:string };
type Conversation = { id:string; name:string; description?:string; avatar_url?:string; created_by:string; created_at:string };

function fmt(ts: string) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function fmtDay(ts: string) { return new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }); }

export default function GroupChatPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const router = useRouter();

  const [me, setMe] = useState<{ id: string; username: string } | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myRole, setMyRole] = useState<'owner'|'admin'|'member'|null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<any>(null);

  const isAdmin = myRole === 'owner' || myRole === 'admin';
  const owner = useMemo(() => members.find(m => m.role === 'owner'), [members]);

  const load = async (scroll = true) => {
    try {
      const r = await fetch(`/api/conversations/${id}`);
      if (r.status === 403) { setErr('You are not a member of this group.'); setLoading(false); return; }
      if (r.status === 404) { setErr('Group not found.'); setLoading(false); return; }
      const d = await r.json();
      setConv(d.conversation);
      setMembers(d.members || []);
      setMessages(d.messages || []);
      setMyRole(d.my_role);
      setLoading(false);
      if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {}
  };

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => { if (d?.user) setMe(d.user); });
    load();
  }, [id]);

  useEffect(() => {
    pollRef.current = setInterval(() => load(false), 5000);
    return () => clearInterval(pollRef.current);
  }, [id]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setInput('');
    try {
      const r = await fetch(`/api/conversations/${id}/messages`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ body: text }) });
      if (r.ok) load();
      else { const d = await r.json().catch(() => ({})); setErr(d.error || 'Send failed'); setInput(text); }
    } catch { setInput(text); } finally { setSending(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  if (loading) return <div style={{ minHeight:'100vh', background:C.bg, padding:80, textAlign:'center' as const, color:C.sub }}>Loading…</div>;
  if (err) return (
    <div style={{ minHeight:'100vh', background:C.bg, padding:60, textAlign:'center' as const }}>
      <p style={{ color:C.red, marginBottom:16 }}>{err}</p>
      <Link href="/messages/groups" style={{ color:C.teal, fontWeight:600 }}>← Back to groups</Link>
    </div>
  );
  if (!conv) return null;

  return (
    <div style={{ minHeight:'100vh', background:C.bg }}>
      <div style={{ maxWidth:900, margin:'24px auto', padding:'0 16px' }}>
        <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, display:'flex', height:'calc(100vh - 96px)', minHeight:500, overflow:'hidden' as const }}>

          {/* Chat column */}
          <div style={{ flex:1, display:'flex', flexDirection:'column' as const, minWidth:0 }}>
            <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:12, background:'#f9fafb' }}>
              <Link href="/messages/groups" style={{ color:C.sub, fontSize:20, textDecoration:'none' }}>←</Link>
              <div style={{ width:40, height:40, borderRadius:'50%', background:C.tealLight, color:C.teal, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                {conv.avatar_url ? <img loading="lazy" decoding="async" src={conv.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' as const, borderRadius:'50%' }} /> : '👥'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, color:C.text, fontSize:15 }}>{conv.name}</div>
                <div style={{ fontSize:12, color:C.sub }}>{members.length} {members.length === 1 ? 'member' : 'members'}{owner ? ` · owned by @${owner.username}` : ''}</div>
              </div>
              <button onClick={() => setShowInfo(!showInfo)} style={{ background:'none', border:'none', cursor:'pointer', color:C.sub, fontSize:20, padding:6 }} aria-label="Group info">ⓘ</button>
            </div>

            <div style={{ flex:1, overflowY:'auto' as const, padding:'16px 20px', display:'flex', flexDirection:'column' as const, gap:12 }}>
              {messages.length === 0 && (
                <div style={{ color:C.sub, textAlign:'center' as const, fontSize:14, marginTop:40 }}>No messages yet. Start the conversation!</div>
              )}
              {messages.map((m, i) => {
                const isMe = m.from_user_id === me?.id;
                const prev = messages[i-1];
                const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                const showName = !isMe && (!prev || prev.from_user_id !== m.from_user_id);
                return (
                  <div key={m.id}>
                    {showDay && <div style={{ textAlign:'center' as const, color:C.sub, fontSize:11, margin:'12px 0 6px' }}>{fmtDay(m.created_at)}</div>}
                    <div style={{ display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap:8, alignItems:'flex-end' }}>
                      {!isMe && (
                        <Link href={`/${m.username}`} style={{ flexShrink:0 }}>
                          {m.avatar_url ? <img loading="lazy" decoding="async" src={m.avatar_url} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' as const }} /> : <div style={{ width:28, height:28, borderRadius:'50%', background:C.teal, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{(m.display_name||'?')[0].toUpperCase()}</div>}
                        </Link>
                      )}
                      <div style={{ maxWidth:'70%' }}>
                        {showName && <div style={{ fontSize:11, color:C.teal, fontWeight:700, marginBottom:2, paddingLeft:4 }}>{m.display_name}</div>}
                        <div style={{ background: isMe ? C.teal : '#e5e7eb', color: isMe ? '#fff' : C.text, borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding:'9px 14px', fontSize:14, lineHeight:1.5, wordBreak:'break-word' as const }}>{m.body}</div>
                        <div style={{ fontSize:11, color:C.sub, marginTop:3, textAlign: isMe ? 'right' as const : 'left' as const }}>{fmt(m.created_at)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}`, display:'flex', gap:10, alignItems:'flex-end', background:'#f9fafb' }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Message the group…" rows={1} style={{ flex:1, background:'#fff', border:`1px solid ${C.border}`, borderRadius:22, padding:'10px 16px', fontSize:14, outline:'none', resize:'none' as const, fontFamily:'inherit', maxHeight:100 }} />
              <button onClick={sendMessage} disabled={sending || !input.trim()} style={{ background: input.trim() ? C.teal : C.border, border:'none', borderRadius:'50%', width:42, height:42, color:'#fff', fontSize:18, cursor: input.trim() ? 'pointer' : 'default', flexShrink:0 }} aria-label="Send">➤</button>
            </div>
          </div>

          {/* Info sidebar */}
          {showInfo && me && (
            <GroupInfoSidebar
              conv={conv}
              members={members}
              myId={me.id}
              myRole={myRole}
              isAdmin={isAdmin}
              onChange={() => load(false)}
              onClose={() => setShowInfo(false)}
              onDeleted={() => router.push('/messages/groups')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GroupInfoSidebar({ conv, members, myId, myRole, isAdmin, onChange, onClose, onDeleted }: {
  conv: Conversation; members: Member[]; myId: string; myRole: 'owner'|'admin'|'member'|null; isAdmin: boolean;
  onChange: () => void; onClose: () => void; onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(conv.name);
  const [description, setDescription] = useState(conv.description || '');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!adding) return;
    fetch('/api/follows?mutual=1').then(r => r.ok ? r.json() : {}).then(d => setFriends((d.users || []).map((u: any) => ({ ...u, user_id: u.id, role: 'member' as const })))).catch(() => {});
  }, [adding]);

  const memberIds = new Set(members.map(m => m.user_id));
  const candidates = friends.filter(f => !memberIds.has(f.user_id)).filter(f => {
    const q = search.trim().toLowerCase();
    return !q || (f.display_name||'').toLowerCase().includes(q) || (f.username||'').toLowerCase().includes(q);
  });

  const saveMeta = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/conversations/${conv.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: name.trim(), description: description.trim() }) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Save failed'); }
      setEditing(false); onChange();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const addMember = async (userId: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/conversations/${conv.id}/members`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id: userId }) });
      if (r.ok) onChange();
    } finally { setBusy(false); }
  };

  const removeMember = async (userId: string) => {
    if (!confirm(userId === myId ? 'Leave this group?' : 'Remove this member?')) return;
    const r = await fetch(`/api/conversations/${conv.id}/members/${userId}`, { method:'DELETE' });
    if (r.ok) {
      if (userId === myId) onDeleted(); else onChange();
    } else { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed'); }
  };

  const setRole = async (userId: string, role: 'admin'|'member') => {
    const r = await fetch(`/api/conversations/${conv.id}/members/${userId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ role }) });
    if (r.ok) onChange();
  };

  const deleteGroup = async () => {
    if (!confirm('Delete this group for everyone? This cannot be undone.')) return;
    const r = await fetch(`/api/conversations/${conv.id}`, { method:'DELETE' });
    if (r.ok) onDeleted();
  };

  const inp: React.CSSProperties = { width:'100%', padding:'8px 12px', borderRadius:8, border:`1px solid ${C.border}`, fontSize:13, background:'#fff', boxSizing:'border-box' as const, outline:'none', fontFamily:'inherit' };

  return (
    <div style={{ width:300, borderLeft:`1px solid ${C.border}`, display:'flex', flexDirection:'column' as const, background:'#fff' }}>
      <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f9fafb' }}>
        <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>Group info</div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.sub, fontSize:18 }}>×</button>
      </div>
      <div style={{ overflowY:'auto' as const, flex:1, padding:16 }}>

        {/* Name + description */}
        <div style={{ marginBottom:16 }}>
          {editing ? (
            <>
              <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Group name" maxLength={80} />
              <textarea style={{ ...inp, marginTop:8, minHeight:60, resize:'vertical' as const }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" maxLength={300} />
              {err && <div style={{ color:C.red, fontSize:12, marginTop:4 }}>{err}</div>}
              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                <button onClick={() => setEditing(false)} disabled={busy} style={{ flex:1, background:'#fff', color:C.sub, border:`1px solid ${C.border}`, borderRadius:6, padding:'6px 10px', fontSize:12, cursor:'pointer' }}>Cancel</button>
                <button onClick={saveMeta} disabled={busy} style={{ flex:1, background:C.teal, color:'#fff', border:'none', borderRadius:6, padding:'6px 10px', fontSize:12, fontWeight:600, cursor:'pointer' }}>{busy ? 'Saving…' : 'Save'}</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{conv.name}</div>
              {conv.description && <div style={{ fontSize:13, color:C.sub, marginTop:4, lineHeight:1.5 }}>{conv.description}</div>}
              {isAdmin && <button onClick={() => setEditing(true)} style={{ marginTop:8, background:'none', border:'none', color:C.teal, fontSize:12, cursor:'pointer', padding:0, fontWeight:600 }}>Edit</button>}
            </>
          )}
        </div>

        {/* Members */}
        <div style={{ fontSize:11, color:C.sub, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.04em', margin:'16px 0 8px' }}>Members ({members.length})</div>
        {isAdmin && !adding && <button onClick={() => setAdding(true)} style={{ background:C.tealLight, color:C.teal, border:`1px solid #99f6e4`, borderRadius:8, padding:'7px 12px', fontSize:12, fontWeight:600, cursor:'pointer', marginBottom:10, width:'100%' }}>+ Add members</button>}

        {adding && (
          <div style={{ marginBottom:12, padding:10, background:'#f9fafb', borderRadius:10, border:`1px solid ${C.border}` }}>
            <input style={inp} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search friends…" />
            <div style={{ maxHeight:160, overflowY:'auto' as const, marginTop:8 }}>
              {candidates.length === 0 ? <div style={{ fontSize:12, color:C.sub, textAlign:'center' as const, padding:10 }}>No friends to add</div>
                : candidates.map(f => (
                  <div key={f.user_id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 2px' }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:C.teal, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0, overflow:'hidden' as const }}>
                      {f.avatar_url ? <img loading="lazy" decoding="async" src={f.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' as const }} /> : (f.display_name||'?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, fontSize:12, color:C.text, minWidth:0, overflow:'hidden' as const, textOverflow:'ellipsis' as const, whiteSpace:'nowrap' as const }}>{f.display_name}</div>
                    <button onClick={() => addMember(f.user_id)} disabled={busy} style={{ background:C.teal, color:'#fff', border:'none', borderRadius:6, padding:'3px 9px', fontSize:11, fontWeight:600, cursor:'pointer' }}>Add</button>
                  </div>
                ))}
            </div>
            <button onClick={() => setAdding(false)} style={{ marginTop:6, background:'none', border:'none', color:C.sub, fontSize:12, cursor:'pointer', width:'100%' }}>Done</button>
          </div>
        )}

        <div>
          {members.map(m => (
            <div key={m.user_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 2px' }}>
              <Link href={`/${m.username}`} style={{ flexShrink:0 }}>
                {m.avatar_url ? <img loading="lazy" decoding="async" src={m.avatar_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover' as const }} /> : <div style={{ width:32, height:32, borderRadius:'50%', background:C.teal, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 }}>{(m.display_name||'?')[0].toUpperCase()}</div>}
              </Link>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:C.text, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                  {m.display_name}
                  {m.role === 'owner' && <span style={{ background:'#fef3c7', color:'#92400e', fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99 }}>OWNER</span>}
                  {m.role === 'admin' && <span style={{ background:C.tealLight, color:C.teal, fontSize:9, fontWeight:700, padding:'1px 6px', borderRadius:99 }}>ADMIN</span>}
                </div>
                <div style={{ fontSize:11, color:C.sub }}>@{m.username}</div>
              </div>
              {myRole === 'owner' && m.user_id !== myId && m.role !== 'owner' && (
                <select value={m.role} onChange={e => setRole(m.user_id, e.target.value as 'admin'|'member')} style={{ border:`1px solid ${C.border}`, borderRadius:6, fontSize:11, padding:'2px 4px', background:'#fff' }}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              )}
              {((isAdmin && m.user_id !== myId && m.role !== 'owner') || m.user_id === myId) && (
                <button onClick={() => removeMember(m.user_id)} title={m.user_id === myId ? 'Leave group' : 'Remove member'} style={{ background:'none', border:'none', cursor:'pointer', color:C.red, fontSize:14, padding:4 }}>{m.user_id === myId ? '↩' : '✕'}</button>
              )}
            </div>
          ))}
        </div>

        {myRole === 'owner' && (
          <div style={{ marginTop:20, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
            <button onClick={deleteGroup} style={{ background:'#fef2f2', color:C.red, border:`1px solid #fecaca`, borderRadius:8, padding:'8px 12px', fontSize:12, fontWeight:600, cursor:'pointer', width:'100%' }}>Delete group</button>
          </div>
        )}
      </div>
    </div>
  );
}
