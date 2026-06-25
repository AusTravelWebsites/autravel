'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Place {
  id: string;
  name: string;
  slug: string;
  country: string;
  category: string;
  image_url: string | null;
  review_count: number;
  avg_rating: number | null;
  favourited_at: string;
}

export default function FavouritesPage() {
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/favourites')
      .then(r => r.json())
      .then(d => { setPlaces(d.favourites || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const removeFavourite = async (placeId: string) => {
    setRemoving(placeId);
    await fetch('/api/favourites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ place_id: placeId })
    });
    setPlaces(prev => prev.filter(p => p.id !== placeId));
    setRemoving(null);
  };

  const card = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden' as const,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0 }}>
            My favourites
          </h1>
          <p style={{ color: '#6b7280', marginTop: '6px', fontSize: '14px' }}>
            Places you've saved to revisit or share.
          </p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
            Loading your favourites...
          </div>
        )}

        {!loading && places.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>No favourites yet</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
              Explore places and tap the heart to save them here
            </p>
            <button
              onClick={() => router.push('/explore')}
              style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              Explore Places
            </button>
          </div>
        )}

        {!loading && places.length > 0 && (
          <>
            <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
              {places.length} saved place{places.length !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {places.map(place => (
                <div key={place.id} style={card} onClick={() => router.push('/places/' + place.slug)}>
                  {/* Image */}
                  <div style={{ position: 'relative', height: '180px', background: '#e5e7eb', overflow: 'hidden' }}>
                    {place.image_url ? (
                      <img
                        src={place.image_url}
                        alt={place.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>
                        🌍
                      </div>
                    )}
                    {/* Remove button */}
                    <button
                      onClick={e => { e.stopPropagation(); removeFavourite(place.id); }}
                      disabled={removing === place.id}
                      style={{
                        position: 'absolute', top: '10px', right: '10px',
                        background: 'rgba(255,255,255,0.9)', border: 'none',
                        borderRadius: '50%', width: '32px', height: '32px',
                        cursor: 'pointer', fontSize: '16px', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        opacity: removing === place.id ? 0.5 : 1
                      }}
                    >
                      ❤️
                    </button>
                    {/* Category badge */}
                    <div style={{
                      position: 'absolute', bottom: '10px', left: '10px',
                      background: 'rgba(0,0,0,0.6)', color: '#fff',
                      borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 600
                    }}>
                      {place.category}
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: '14px 16px' }}>
                    <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#111827' }}>{place.name}</h3>
                    <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280' }}>📍 {place.country}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        {place.avg_rating ? `⭐ ${Number(place.avg_rating).toFixed(1)}` : 'No ratings yet'}
                        {place.review_count > 0 && ` · ${place.review_count} review${place.review_count !== 1 ? 's' : ''}`}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                        Saved {new Date(place.favourited_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
