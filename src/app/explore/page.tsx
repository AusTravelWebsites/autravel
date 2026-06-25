'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ensureLocation } from '@/lib/ensureLocation';

interface Place {
  id: string; slug: string; name: string; country: string; city: string;
  category: string; emoji: string; description: string; cover_image: string;
  bb_rating: number; bb_review_count: number; bb_checkin_count: number;
}

function HeartButton({ placeId, initialFav, onChange }: { placeId: string; initialFav: boolean; onChange?: (fav: boolean) => void }) {
  const [fav, setFav] = useState(initialFav);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setFav(initialFav); }, [initialFav]);
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    const next = !fav;
    setFav(next); setBusy(true);
    try {
      const r = await fetch('/api/favourites', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place_id: placeId }),
      });
      if (!r.ok) {
        setFav(!next);
        if (r.status === 401) window.location.href = '/login';
      } else {
        onChange?.(next);
      }
    } catch { setFav(!next); }
    finally { setBusy(false); }
  };
  return (
    <button onClick={toggle} aria-label={fav ? 'Remove from favourites' : 'Save to favourites'} disabled={busy}
      style={{ position: 'absolute', top: 10, left: 10, width: 36, height: 36, borderRadius: '50%',
        background: 'rgba(0,0,0,0.55)', border: 'none', display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: busy ? 'wait' : 'pointer', padding: 0, zIndex: 2 }}>
      <span style={{ fontSize: 18, lineHeight: 1, color: fav ? '#ef4444' : '#fff' }}>{fav ? '\u2665' : '\u2661'}</span>
    </button>
  );
}

const CATS = [
  { key: '', label: 'All' },
  { key: 'cities', label: '🏙️ Cities' },
  { key: 'attractions', label: '🎯 Attractions' },
  { key: 'activities', label: '🚴 Activities' },
  { key: 'tours', label: '🚌 Tours' },
  { key: 'beaches', label: '🏖️ Beaches' },
  { key: 'nature', label: '🌿 Nature' },
  { key: 'temples', label: '🏛️ Temples' },
  { key: 'food', label: '🍜 Food' },
  { key: 'hotels', label: '🏨 Hotels' },
  { key: 'hostels', label: '🏕️ Hostels' },
];

function ExplorePageInner() {
  const params = useSearchParams();
  const [places, setPlaces] = useState<Place[]>([]);
  const [cat, setCat] = useState(params.get('category') ?? '');
  const [country, setCountry] = useState(params.get('country') ?? '');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [loading, setLoading] = useState(true);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [nearBusy, setNearBusy] = useState(false);

  useEffect(() => {
    const q = params.get('q');
    if (q !== null && q !== search) setSearch(q);
    const c = params.get('category');
    if (c !== null && c !== cat) setCat(c);
    const cc = params.get('country');
    if (cc !== null && cc !== country) setCountry(cc);
  }, [params]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cat) params.set('category', cat);
    if (country) params.set('country', country);
    if (search) params.set('search', search);
    if (near) params.set('near', `${near.lat},${near.lng}`);
    fetch('/api/places?' + params)
      .then(r => r.json())
      .then(d => { setPlaces(d.places || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [cat, country, search, near]);

  useEffect(() => {
    fetch('/api/favourites?ids=1')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ids) setFavIds(new Set(d.ids)); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', color: '#111827' }}>
      <div style={{ background: 'linear-gradient(160deg,var(--brand) 0%,var(--brand-dark) 100%)', borderBottom: '1px solid var(--brand)', padding: '32px 20px 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Explore places</h1>
          <p style={{ color: '#cbd5e1', marginBottom: 24, fontSize: 15 }}>Browse cities, attractions, activities and natural wonders across the world.</p>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' as const, alignItems:'center', marginBottom:20, maxWidth:680 }}>
            <input type="text" placeholder="Search places, cities, countries..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex:'1 1 280px', padding: '10px 16px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const }} />
            <button
              onClick={async () => {
                if (near) { setNear(null); return; }
                setNearBusy(true);
                try {
                  const c = await ensureLocation('Show places near you, sorted by distance.');
                  setNear({ lat: c.lat, lng: c.lng });
                } catch {} finally { setNearBusy(false); }
              }}
              disabled={nearBusy}
              style={{ padding:'10px 18px', borderRadius:10, border:'1.5px solid rgba(255,255,255,0.4)', background: near ? '#fff' : 'rgba(255,255,255,0.15)', color: near ? 'var(--brand)' : '#fff', fontSize:14, fontWeight:700, cursor: nearBusy?'wait':'pointer', whiteSpace:'nowrap' as const, fontFamily:'inherit' }}>
              {nearBusy ? 'Locating…' : (near ? '✓ Near me' : '📍 Near me')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, paddingBottom: 20 }}>
            {CATS.map(c => (
              <button key={c.key} onClick={() => setCat(c.key)}
                style={{ padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: cat === c.key ? '#fff' : 'rgba(255,255,255,0.15)',
                  color: cat === c.key ? 'var(--brand)' : '#fff' }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>Loading places...</div>
        ) : places.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>No places found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20 }}>
            {places.map(place => (
              <Link key={place.id} href={'/places/' + place.slug} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                  <div style={{ height: 160, position: 'relative', overflow: 'hidden', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {place.cover_image
                      ? <img loading="lazy" decoding="async" src={place.cover_image} alt={place.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : <span style={{ fontSize: 48 }}>{place.emoji || '📍'}</span>
                    }
                    <HeartButton placeId={place.id} initialFav={favIds.has(place.id)} onChange={fav => {
                      setFavIds(prev => { const n = new Set(prev); if (fav) n.add(place.id); else n.delete(place.id); return n; });
                    }} />
                    <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 600 }}>
                      {place.category}
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{place.name}</div>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8, display:'flex', gap:8, flexWrap:'wrap' as const, alignItems:'center' }}>
                      <span>📍 {place.city}, {place.country}</span>
                      {(place as any).distance_km != null && (
                        <span style={{ background:'var(--brand-light)', color:'var(--brand)', border:'1px solid #99f6e4', borderRadius:999, padding:'1px 8px', fontSize:11, fontWeight:700 }}>
                          {(() => { const km = Number((place as any).distance_km); return km < 1 ? Math.round(km*1000) + ' m' : km < 50 ? km.toFixed(1) + ' km' : Math.round(km) + ' km'; })()}
                        </span>
                      )}
                    </div>
                    {place.description && (
                      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 10 }}>
                        {place.description.slice(0, 80)}{place.description.length > 80 ? '…' : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#6b7280' }}>
                      {Number(place.bb_review_count) > 0 && <span>⭐ {Number(place.bb_rating || 0).toFixed(1)} ({place.bb_review_count})</span>}
                      {Number(place.bb_checkin_count) > 0 && <span>📍 {place.bb_checkin_count} check-ins</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExplorePageInner />
    </Suspense>
  );
}
