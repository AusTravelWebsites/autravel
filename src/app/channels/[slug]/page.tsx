'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', red: '#ef4444' };
const MAX_WORDS = 30;

interface Msg { id: string; body: string; created_at: string; user_id: string; username?: string; display_name?: string; avatar_url?: string | null }
interface Channel { id: string; slug: string; city_name: string; country: string | null; member_count: number; message_count: number }

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function ChannelChatPage() {
  const { slug } = useParams() as { slug: string };
  const [me, setMe] = useState<any>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [blockBusy, setBlockBusy] = useState(false);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [hp, setHp] = useState(''); // honeypot
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [notFound, setNotFound] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const over = words > MAX_WORDS;

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => setMe(d?.user || null));
    fetch(`/api/channels/${slug}`).then(r => {
      if (r.status === 404) { setNotFound(true); return null; }
      return r.ok ? r.json() : null;
    }).then(d => { if (d?.channel) setChannel(d.channel); });
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [slug]);

  const load = async () => {
    try {
      const r = await fetch(`/api/channels/${slug}/messages`);
      if (r.status === 404) { setNotFound(true); setLoading(false); return; }
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      setMessages(d.messages || []);
      setLoading(false);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 20);
    } catch { setLoading(false); }
  };

  const send = async () => {
    if (!text.trim() || sending || over || hp) return;
    setSending(true); setErr('');
    try {
      const r = await fetch(`/api/channels/${slug}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text.trim(), hp }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Could not send'); return; }
      setText('');
      if (d.message) setMessages(m => [...m, d.message]);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 20);
    } catch { setErr('Network error'); }
    finally { setSending(false); }
  };

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, padding: 40, textAlign: 'center' as const }}>
        <div style={{ color: C.sub }}>Channel not found. <Link href="/channels" style={{ color: C.teal }}>Back to channels</Link></div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' as const }}>
      <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', padding: '18px 16px 0', flex: 1, display: 'flex', flexDirection: 'column' as const, minHeight: 0 }}>
        <Link href="/channels" style={{ color: C.sub, fontSize: 13, textDecoration: 'none' }}>← All channels</Link>
        <div style={{ margin: '10px 0 14px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 800, color: C.text, margin: 0 }}>
            #{channel?.city_name || slug}
            {channel?.country && <span style={{ color: C.sub, fontSize: 15, fontWeight: 500 }}> · {channel.country}</span>}
          </h1>
          <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>
            {channel?.member_count ?? 0} members · {channel?.message_count ?? 0} messages · Keep it friendly · Auto-moderated
          </div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' as const, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, minHeight: 0 }}>
          {loading ? (
            <div style={{ color: C.sub, textAlign: 'center' as const, padding: 40 }}>Loading messages…</div>
          ) : messages.length === 0 ? (
            <div style={{ color: C.sub, textAlign: 'center' as const, padding: 40 }}>No messages yet. Say hi 👋</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              {messages.map(msg => {
                const isSelf = me && msg.user_id === me.id;
                return (
                <div key={msg.id} style={{ display: 'flex', gap: 10, position: 'relative' as const }}>
                  <Link href={`/${msg.username}`} style={{ flexShrink: 0 }}>
                    {msg.avatar_url ? (
                      <img loading="lazy" decoding="async" src={msg.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' as const }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontSize: 13, fontWeight: 700 }}>
                        {(msg.display_name || msg.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.sub, marginBottom: 2 }}>
                      <Link href={`/${msg.username}`} style={{ color: C.text, fontWeight: 600, textDecoration: 'none' }}>{msg.display_name || msg.username}</Link>
                      <span style={{ marginLeft: 6 }}>· {timeAgo(msg.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 14, color: C.text, lineHeight: 1.45, wordBreak: 'break-word' as const }}>{msg.body}</div>
                  </div>
                  {me && !isSelf && (
                    <div style={{ position: 'relative' as const }}>
                      <button onClick={() => setMenuFor(menuFor === msg.id ? null : msg.id)} aria-label="Actions"
                        style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 16, padding: '0 6px', lineHeight: 1 }}>⋯</button>
                      {menuFor === msg.id && (
                        <div style={{ position: 'absolute' as const, right: 0, top: '100%', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.12)', minWidth: 150, zIndex: 20, padding: 4 }}>
                          <button onClick={async () => {
                            if (!confirm(`Block @${msg.username}? You won't see their messages anymore.`)) { setMenuFor(null); return; }
                            setBlockBusy(true);
                            await fetch('/api/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: msg.user_id }) });
                            setBlockBusy(false); setMenuFor(null);
                            setMessages(m => m.filter(x => x.user_id !== msg.user_id));
                          }} disabled={blockBusy}
                            style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '8px 12px', fontSize: 13, color: C.red, textAlign: 'left' as const, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6 }}>
                            Block @{msg.username}
                          </button>
                          <a href={`/${msg.username}`}
                            style={{ display: 'block', padding: '8px 12px', fontSize: 13, color: C.text, textDecoration: 'none', borderRadius: 6 }}>
                            View profile
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );})}
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{ padding: '12px 0 18px' }}>
          {!me ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, textAlign: 'center' as const, color: C.sub }}>
              <Link href={`/login?next=/channels/${slug}`} style={{ color: C.teal, fontWeight: 700 }}>Log in</Link> to chat
            </div>
          ) : (
            <>
              {/* Honeypot — hidden from humans, bots will fill it */}
              <input value={hp} onChange={e => setHp(e.target.value)} tabIndex={-1} autoComplete="off"
                style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value.slice(0, 1200))}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Say something (30 words max, no links)"
                  rows={2}
                  style={{ flex: 1, padding: '10px 14px', border: `1px solid ${over ? C.red : C.border}`, borderRadius: 10, fontSize: 14, fontFamily: 'inherit', resize: 'none' as const, outline: 'none', boxSizing: 'border-box' as const }} />
                <button onClick={send} disabled={!text.trim() || over || sending}
                  style={{ background: (!text.trim() || over) ? '#e5e7eb' : C.teal, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: (!text.trim() || over || sending) ? 'default' : 'pointer' }}>
                  {sending ? '…' : 'Send'}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' as const, fontSize: 11, marginTop: 4 }}>
                <span style={{ color: err ? C.red : C.sub }}>{err || ' '}</span>
                <span style={{ color: over ? C.red : C.sub }}>{words}/{MAX_WORDS} words</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
