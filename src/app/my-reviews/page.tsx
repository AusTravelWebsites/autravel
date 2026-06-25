'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Review = {
  id: string;
  place_id: string;
  place_name: string | null;
  place_slug: string | null;
  city: string | null;
  country: string | null;
  title: string | null;
  body: string | null;
  overall_rating: number | null;
  rating: number | null;
  visit_date: string | null;
  created_at: string;
  gps_verified: boolean;
};

function Stars({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={14} height={14} viewBox="0 0 24 24" fill={i <= Math.round(n) ? '#f59e0b' : '#d1d5db'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </span>
  );
}

export default function MyReviewsPage() {
  const [me, setMe] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.user) { setError('Please sign in to see your reviews.'); setLoading(false); return; }
      setMe(d.user);
      fetch(`/api/reviews?username=${encodeURIComponent(d.user.username)}&limit=200`)
        .then(r => r.ok ? r.json() : null)
        .then(rd => { setReviews(rd?.reviews || []); setLoading(false); })
        .catch(() => { setError('Failed to load reviews.'); setLoading(false); });
    }).catch(() => { setError('Please sign in.'); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return reviews;
    return reviews.filter(r =>
      r.title?.toLowerCase().includes(needle) ||
      r.place_name?.toLowerCase().includes(needle) ||
      r.country?.toLowerCase().includes(needle) ||
      r.city?.toLowerCase().includes(needle)
    );
  }, [reviews, q]);

  return (
    <>
      <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '24px 16px 60px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#111827', margin: 0 }}>My Reviews</h1>
            <Link href="/reviews/new" style={{ background: 'var(--brand)', color: '#fff', borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>+ Write a Review</Link>
          </div>

          <div style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <input
              type="search"
              placeholder="Search by country, city or title…"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 14, color: '#111827', background: '#fff', outline: 'none' }}
            />
            {!loading && <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{filtered.length} of {reviews.length} review{reviews.length === 1 ? '' : 's'}</div>}
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>Loading…</div>}
          {error && <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280', background: '#fff', borderRadius: 12 }}>{error}</div>}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6b7280', background: '#fff', borderRadius: 12 }}>
              {reviews.length === 0 ? (
                <>
                  <div style={{ fontSize: 42, marginBottom: 10 }}>✍️</div>
                  <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#111827' }}>You haven't written any reviews yet.</p>
                  <p style={{ margin: 0, fontSize: 14 }}><Link href="/reviews/new" style={{ color: 'var(--brand)', fontWeight: 600 }}>Leave your first review →</Link></p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>🔎</div>
                  <p style={{ margin: 0, fontSize: 14 }}>No reviews match your search.</p>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(r => (
              <article key={r.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {r.place_slug ? (
                      <Link href={`/places/${r.place_slug}`} style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                        {r.place_name || 'Unknown place'}
                      </Link>
                    ) : (
                      <span style={{ color: '#111827', fontWeight: 700, fontSize: 15 }}>{r.place_name || 'Unknown place'}</span>
                    )}
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {[r.city, r.country].filter(Boolean).join(', ')}
                      {r.visit_date && <> · visited {new Date(r.visit_date).toLocaleDateString()}</>}
                    </div>
                  </div>
                  <Stars n={Number(r.overall_rating ?? r.rating ?? 0)} />
                </div>
                {r.title && <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '8px 0 4px' }}>{r.title}</h3>}
                {r.body && <p style={{ fontSize: 14, color: '#374151', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{r.body}</p>}
                <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.gps_verified && <span style={{ marginLeft: 8, color: 'var(--brand)' }}>📍 GPS verified</span>}
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
