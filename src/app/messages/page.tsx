"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function Avatar({ user, size = 40 }: { user: any; size?: number }) {
  const letter = (user?.display_name || user?.username || '?')[0].toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0, overflow: 'hidden' }}>
      {user?.avatar_url ? <img loading="lazy" decoding="async" src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : letter}
    </div>
  );
}

function MessagesInner() {
  const searchParams = useSearchParams();
  const withUserId = searchParams.get('with');
  const [me, setMe] = useState<any>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => { if (d?.user) setMe(d.user); }).catch(() => {});
    loadThreads();
  }, []);

  useEffect(() => {
    if (withUserId) loadConversation(withUserId);
  }, [withUserId]);

  useEffect(() => {
    if (!activeThread) return;
    pollRef.current = setInterval(() => loadConversation(activeThread.other_user, false), 5000);
    return () => clearInterval(pollRef.current);
  }, [activeThread]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadThreads = () => {
    fetch('/api/messages').then(r => r.ok ? r.json() : null).then(d => { if (d?.threads) setThreads(d.threads); }).catch(() => {});
  };

  const loadConversation = (userId: string, scroll = true) => {
    fetch(`/api/messages?with=${userId}`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.messages) { setMessages(d.messages); if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }
    }).catch(() => {});
  };

  const openThread = (thread: any) => { setActiveThread(thread); loadConversation(thread.other_user); };

  const sendMessage = async () => {
    if (!input.trim() || !activeThread || sending) return;
    setSending(true);
    const body = input.trim(); setInput('');
    try {
      const r = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to_user_id: activeThread.other_user, body }) });
      if (r.ok) { loadConversation(activeThread.other_user); loadThreads(); }
    } finally { setSending(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const fmt = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh' }}>
      <style>{`
        @media (max-width: 720px) {
          .bb-msg-shell { height: calc(100vh - 200px) !important; min-height: 480px; }
          .bb-msg-threads { width: 100% !important; ${activeThread ? 'display: none !important;' : ''} }
          .bb-msg-chat { ${activeThread ? '' : 'display: none !important;'} }
        }
      `}</style>
      <div style={{ maxWidth: 1000, margin: '24px auto', padding: '0 16px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', color: '#111827', fontSize: 26, fontWeight: 800, margin: '0 0 16px' }}>Messages</h1>
        <div className="bb-msg-shell" style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e5e7eb', display: 'flex', height: 600, overflow: 'hidden' }}>
          {/* Thread list */}
          <div className="bb-msg-threads" style={{ width: 280, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#111827', fontWeight: 700, fontSize: 15 }}>Conversations</span>
              <Link href="/friends" style={{ color: '#0d9488', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>+ New</Link>
            </div>
            <Link href="/messages/groups" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textDecoration: 'none', borderBottom: '1px solid #e5e7eb', background: '#f0fdfa' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#0d9488', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👥</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#111827', fontWeight: 700, fontSize: 14 }}>Group chats</div>
                <div style={{ color: '#0d9488', fontSize: 12, fontWeight: 600 }}>Plan trips, create groups →</div>
              </div>
            </Link>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {threads.length === 0 && (
                <div style={{ padding: '24px 16px', color: '#6b7280', textAlign: 'center', fontSize: 14, lineHeight: 1.6 }}>
                  No messages yet.<br />
                  <Link href="/friends" style={{ color: '#0d9488', fontWeight: 600 }}>Find travellers to chat with →</Link>
                </div>
              )}
              {threads.map((t: any) => (
                <div key={t.other_user} onClick={() => openThread(t)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', background: activeThread?.other_user === t.other_user ? 'rgba(20,184,166,0.08)' : 'transparent', borderBottom: '1px solid rgba(30,51,84,0.3)', borderLeft: activeThread?.other_user === t.other_user ? '3px solid #0d9488' : '3px solid transparent' }}>
                  <Avatar user={t} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#111827', fontWeight: 600, fontSize: 14 }}>{t.display_name || t.username}</div>
                    <div style={{ color: '#6b7280', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      {t.from_user_id === me?.id ? 'You: ' : ''}{t.body}
                    </div>
                  </div>
                  {!t.read && t.from_user_id !== me?.id && <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#0d9488', flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="bb-msg-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {activeThread ? (
              <>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, background: '#f9fafb' }}>
                  <Avatar user={activeThread} size={36} />
                  <div>
                    <div style={{ color: '#111827', fontWeight: 700, fontSize: 15 }}>{activeThread.display_name || activeThread.username}</div>
                    <Link href={`/${activeThread.username}`} style={{ color: '#0d9488', fontSize: 12, textDecoration: 'none' }}>@{activeThread.username}</Link>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {messages.length === 0 && (
                    <div style={{ color: '#6b7280', textAlign: 'center', fontSize: 14, marginTop: 40 }}>Start the conversation! Say hello </div>
                  )}
                  {messages.map((m: any) => {
                    const isMe = m.from_user_id === me?.id;
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                        {!isMe && <Avatar user={{ username: m.from_username, display_name: m.from_display_name, avatar_url: m.from_avatar }} size={28} />}
                        <div style={{ maxWidth: '68%' }}>
                          <div style={{ background: isMe ? '#0d9488' : '#e5e7eb', color: isMe ? '#fff' : '#111827', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 16px', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {m.body}
                          </div>
                          <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>{fmt(m.created_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 10, alignItems: 'flex-end', background: '#f9fafb' }}>
                  <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Message... (Enter to send, Shift+Enter for newline)" rows={1} style={{ flex: 1, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 22, padding: '10px 16px', color: '#111827', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', maxHeight: 100 }} />
                  <button onClick={sendMessage} disabled={sending || !input.trim()} style={{ background: input.trim() ? '#0d9488' : '#e5e7eb', border: 'none', borderRadius: '50%', width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0, transition: 'background 0.15s' }}>
                    
                  </button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <div style={{ fontSize: 56 }}></div>
                <div style={{ color: '#111827', fontWeight: 700, fontSize: 20 }}>Chat with Travellers</div>
                <div style={{ color: '#4a6a9a', fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                  Message friends, plan trips together, and share adventures in real time.
                </div>
                <Link href="/friends" style={{ background: '#0d9488', color: '#fff', borderRadius: 10, padding: '11px 28px', textDecoration: 'none', fontWeight: 700, fontSize: 15, marginTop: 4 }}>
                  Find Travellers to Chat
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div style={{ background: '#f3f4f6', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a9a', fontSize: 16 }}>Loading messages...</div>}>
      <MessagesInner />
    </Suspense>
  );
}
