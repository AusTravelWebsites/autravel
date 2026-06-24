'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

export type ParkCard = {
  slug: string;
  name: string;
  park_type: string | null;
  region: string | null;
  suburb: string | null;
  avg_rating: number | null;
  review_count: number | null;
  cover_image: string | null;
};

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa' };

const TYPE_META: Record<string, { icon: string; label: string }> = {
  caravan:       { icon: '🚐', label: 'Caravan park' },
  holiday:       { icon: '🏖️', label: 'Holiday park' },
  tourist:       { icon: '🧳', label: 'Tourist park' },
  national_park: { icon: '⛺', label: 'National park camping' },
};

const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${active ? C.teal : C.border}`, background: active ? C.teal : C.card,
  color: active ? '#fff' : C.text, whiteSpace: 'nowrap',
});

export function ParkFinder({ parks, regions, scope }: { parks: ParkCard[]; regions: string[]; scope: string }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [region, setRegion] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('top');
  const [shown, setShown] = useState(24);

  const types = useMemo(() => [...new Set(parks.map(p => p.park_type).filter(Boolean) as string[])], [parks]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = parks.filter(p => {
      if (term && !p.name.toLowerCase().includes(term) && !(p.suburb || '').toLowerCase().includes(term) && !(p.region || '').toLowerCase().includes(term)) return false;
      if (type && p.park_type !== type) return false;
      if (region && p.region !== region) return false;
      if (minRating && (p.avg_rating || 0) < minRating) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'reviews') return (b.review_count || 0) - (a.review_count || 0);
      // top: rating, then review_count
      const ar = a.avg_rating || 0, br = b.avg_rating || 0;
      if (br !== ar) return br - ar;
      return (b.review_count || 0) - (a.review_count || 0);
    });
    return list;
  }, [parks, q, type, region, minRating, sort]);

  const visible = filtered.slice(0, shown);
  const reset = () => setShown(24);

  return (
    <div>
      {/* Search + region + sort */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input
          value={q} onChange={e => { setQ(e.target.value); reset(); }}
          placeholder="Search by park name, town or area…"
          style={{ flex: '1 1 280px', minWidth: 220, padding: '11px 15px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 15, outline: 'none' }}
        />
        <select value={region} onChange={e => { setRegion(e.target.value); reset(); }} style={{ padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: '#fff', maxWidth: 260 }}>
          <option value="">All areas</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: '#fff' }}>
          <option value="top">Top rated</option>
          <option value="reviews">Most reviewed</option>
          <option value="name">A–Z</option>
        </select>
      </div>

      {/* Type chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={chip(type === '')} onClick={() => { setType(''); reset(); }}>All parks</span>
        {types.map(t => (
          <span key={t} style={chip(type === t)} onClick={() => { setType(type === t ? '' : t); reset(); }}>
            {TYPE_META[t]?.icon || '•'} {TYPE_META[t]?.label || t}
          </span>
        ))}
      </div>

      {/* Rating filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>Min rating:</span>
        {[0, 3, 4, 4.5].map(r => (
          <span key={r} style={chip(minRating === r)} onClick={() => { setMinRating(r); reset(); }}>{r === 0 ? 'Any' : `★ ${r}+`}</span>
        ))}
      </div>

      <div style={{ color: C.sub, fontSize: 13, marginBottom: 14 }}>
        <b style={{ color: C.text }}>{filtered.length}</b> {filtered.length === 1 ? 'park' : 'parks'}
        {(q || type || region || minRating) ? ' match your search' : ` across ${scope}`}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 16 }}>
        {visible.map(p => {
          const meta = TYPE_META[p.park_type || ''] || { icon: '🚐', label: 'Park' };
          return (
            <Link key={p.slug} href={`/parks/${p.slug}/`} style={{ textDecoration: 'none', color: 'inherit', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '16/10', background: '#f1f5f9' }}>
                {p.cover_image
                  ? <img src={p.cover_image} alt={p.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>{meta.icon}</div>}
              </div>
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, background: C.tealLight, padding: '2px 8px', borderRadius: 6, display: 'inline-block', marginBottom: 6 }}>{meta.icon} {meta.label}</div>
                <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.25, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 12.5, color: C.sub }}>{[p.suburb, p.region].filter(Boolean).join(' · ')}</div>
                {p.avg_rating != null && (
                  <div style={{ fontSize: 13, color: C.text, marginTop: 8 }}>★ <b>{Number(p.avg_rating).toFixed(1)}</b>{p.review_count ? <span style={{ color: C.sub }}> ({Number(p.review_count).toLocaleString()})</span> : null}</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {visible.length < filtered.length && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={() => setShown(shown + 24)} style={{ padding: '11px 26px', borderRadius: 10, border: `1px solid ${C.teal}`, background: C.tealLight, color: C.teal, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Show more ({filtered.length - visible.length} left)
          </button>
        </div>
      )}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 50, color: C.sub }}>No parks match your search. Try clearing a filter.</div>
      )}
    </div>
  );
}
