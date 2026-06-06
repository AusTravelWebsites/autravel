'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', red: '#ef4444' };

interface Comment {
  id: string; body: string; created_at: string;
  username?: string; display_name?: string; avatar_url?: string | null; verification_status?: string | null;
}

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function BlogComments({ slug }: { slug: string }) {
  const [me, setMe] = useState<any>(null);
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => setMe(d?.user || null));
    fetch(`/api/blog/${slug}/comments`).then(r => r.ok ? r.json() : { comments: [] }).then(d => {
      setItems(d.comments || []); setLoading(false);
    });
  }, [slug]);

  const submit = async () => {
    if (!text.trim() || sending) return;
    setSending(true); setErr('');
    try {
      const r = await fetch(`/api/blog/${slug}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: text.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Failed'); return; }
      setItems(x => [...x, d.comment]); setText('');
    } finally { setSending(false); }
  };

  const remove = async (cid: string) => {
    if (!confirm('Delete this comment?')) return;
    const r = await fetch(`/api/blog/${slug}/comments?comment_id=${cid}`, { method: 'DELETE' });
    if (r.ok) setItems(x => x.filter(c => c.id !== cid));
  };

  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 800, margin: '0 0 16px' }}>
        Comments {items.length > 0 && <span style={{ color: C.sub, fontWeight: 500, fontSize: 18 }}>({items.length})</span>}
      </h2>

      {loading ? (
        <div style={{ color: C.sub }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ color: C.sub, fontSize: 14, padding: '8px 0' }}>Be the first to comment.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14, marginBottom: 18 }}>
          {items.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 12, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
              <Link href={`/${c.username}`} style={{ flexShrink: 0 }}>
                {c.avatar_url ? (
                  <img loading="lazy" decoding="async" src={c.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' as const }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, fontWeight: 700 }}>
                    {(c.display_name || c.username || '?')[0].toUpperCase()}
                  </div>
                )}
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.sub, marginBottom: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Link href={`/${c.username}`} style={{ color: C.text, fontWeight: 600, textDecoration: 'none' }}>{c.display_name || c.username}</Link>
                  {c.verification_status === 'verified' && <span style={{ color: C.teal, fontSize: 11 }}>✓</span>}
                  <span>· {timeAgo(c.created_at)}</span>
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: C.text, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }}>{c.body}</div>
              </div>
              {me && me.username === c.username && (
                <button onClick={() => remove(c.id)} title="Delete" style={{ background: 'none', border: 'none', color: C.sub, cursor: 'pointer', fontSize: 16, padding: 4 }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {me ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
          <textarea value={text} onChange={e => setText(e.target.value.slice(0, 1000))}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit(); }}
            placeholder="Share your thoughts…" rows={3}
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit', resize: 'vertical' as const, boxSizing: 'border-box' as const }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' as const, alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: err ? C.red : C.sub }}>{err || `${text.length}/1000`}</span>
            <button onClick={submit} disabled={!text.trim() || sending}
              style={{ background: text.trim() ? C.teal : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 700, cursor: text.trim() && !sending ? 'pointer' : 'default' }}>
              {sending ? '…' : 'Post'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, textAlign: 'center' as const, color: C.sub }}>
          <Link href={`/login?next=/blog/${slug}`} style={{ color: C.teal, fontWeight: 700 }}>Log in</Link> to comment
        </div>
      )}
    </section>
  );
}
