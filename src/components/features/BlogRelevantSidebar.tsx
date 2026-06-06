'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Post = { slug: string; title: string; excerpt?: string; featured_image?: string; category: string; location_name?: string; country?: string; view_count: number; username: string; display_name?: string; distance_km?: number };

const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488' };

export function BlogRelevantSidebar() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/blog/relevant').then(r => r.ok ? r.json() : { posts: [] }).then(d => { setPosts(d.posts || []); setLoading(false) }).catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!posts.length) return null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' as const, position: 'sticky' as const, top: 80 }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: '#f9fafb' }}>
        <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>For you</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Top reads near you</div>
      </div>
      <div>
        {posts.map((p, i) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderTop: i > 0 ? `1px solid ${C.border}` : 'none', textDecoration: 'none', color: C.text }}>
            {p.featured_image && <img src={p.featured_image} alt="" loading="lazy" style={{ width: 68, height: 68, objectFit: 'cover' as const, borderRadius: 8, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 2 }}>{p.category}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: C.text, display: '-webkit-box' as any, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{p.title}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>
                👁 {p.view_count.toLocaleString()} · @{p.username}
                {p.distance_km != null && Number(p.distance_km) <= 500 && <span> · {Number(p.distance_km).toFixed(0)} km away</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
