'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

export type TrailCard = {
  slug: string;
  name: string;
  trail_type: string;
  difficulty: string | null;
  distance_label: string | null;
  duration_label: string | null;
  length_m: number | null;
  area: string | null;
  surface: string | null;
  waymarked: boolean | null;
  dog_friendly: boolean | null;
  bicycle_allowed: boolean | null;
  horse_allowed: boolean | null;
  preview: [number, number][]; // normalised route shape, 0..100 x / 0..60 y
};

const BASE = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280' };

const TYPE_META: Record<string, { icon: string; color: string }> = {
  'Walking route': { icon: '🥾', color: '#0d9488' },
  'Cycle route':   { icon: '🚲', color: '#2563eb' },
  'Cycle path':    { icon: '🚲', color: '#2563eb' },
  'Footpath':      { icon: '🚶', color: '#16a34a' },
  'Bridleway':     { icon: '🐎', color: '#a16207' },
  'Byway':         { icon: '🛤️', color: '#7c3aed' },
  'Track':         { icon: '🌲', color: '#65a30d' },
  'Path':          { icon: '🚶', color: '#16a34a' },
};
const DIFFICULTY_COLOR: Record<string, string> = { Easy: '#16a34a', Moderate: '#d97706', Challenging: '#dc2626' };

function RouteSvg({ pts, color }: { pts: [number, number][]; color: string }) {
  if (!pts?.length) return <div style={{ height: 110, background: '#eef2f5' }} />;
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 110, display: 'block', background: 'linear-gradient(135deg,#ecfdf5,#f0f9ff)' }}>
      <path d={d} fill="none" stroke="#fff" strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      {pts[0] && <circle cx={pts[0][0]} cy={pts[0][1]} r={2.2} fill={color} stroke="#fff" strokeWidth={0.8} />}
    </svg>
  );
}

const chip = (active: boolean, accent: string): React.CSSProperties => ({
  padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${active ? accent : BASE.border}`, background: active ? accent : BASE.card,
  color: active ? '#fff' : BASE.text, whiteSpace: 'nowrap',
});

export function TrailExplorer({
  trails, types, areas,
  base = '/park-maps',
  scopeText = '',
  accent = '#0d9488',
  accentLight = '#f0fdfa',
}: {
  trails: TrailCard[]; types: string[]; areas: string[];
  base?: string; scopeText?: string; accent?: string; accentLight?: string;
}) {
  const C = { ...BASE, teal: accent, tealLight: accentLight };
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [area, setArea] = useState<string>('');
  const [maxKm, setMaxKm] = useState<number>(0); // 0 = any
  const [sort, setSort] = useState<string>('featured');
  const [shown, setShown] = useState(24);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = trails.filter(t => {
      if (term && !t.name.toLowerCase().includes(term) && !(t.area || '').toLowerCase().includes(term)) return false;
      if (type && t.trail_type !== type) return false;
      if (difficulty && t.difficulty !== difficulty) return false;
      if (area && t.area !== area) return false;
      if (maxKm && (t.length_m || 0) > maxKm * 1000) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'longest') return (b.length_m || 0) - (a.length_m || 0);
      if (sort === 'shortest') return (a.length_m || 0) - (b.length_m || 0);
      if (sort === 'name') return a.name.localeCompare(b.name);
      // featured: waymarked routes first, then longer
      const aw = a.trail_type.includes('route') ? 1 : 0, bw = b.trail_type.includes('route') ? 1 : 0;
      if (aw !== bw) return bw - aw;
      return (b.length_m || 0) - (a.length_m || 0);
    });
    return list;
  }, [trails, q, type, difficulty, area, maxKm, sort]);

  const visible = filtered.slice(0, shown);

  return (
    <div>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input
          value={q} onChange={e => { setQ(e.target.value); setShown(24); }}
          placeholder="Search walks, trails & paths by name or town…"
          style={{ flex: '1 1 280px', minWidth: 220, padding: '11px 15px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 15, outline: 'none' }}
        />
        <select value={area} onChange={e => { setArea(e.target.value); setShown(24); }} style={{ padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: '#fff' }}>
          <option value="">All areas</option>
          {areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: '#fff' }}>
          <option value="featured">Featured</option>
          <option value="longest">Longest first</option>
          <option value="shortest">Shortest first</option>
          <option value="name">A–Z</option>
        </select>
      </div>

      {/* Type chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={chip(type === '', accent)} onClick={() => { setType(''); setShown(24); }}>All types</span>
        {types.map(t => (
          <span key={t} style={chip(type === t, accent)} onClick={() => { setType(type === t ? '' : t); setShown(24); }}>
            {TYPE_META[t]?.icon || '•'} {t}
          </span>
        ))}
      </div>

      {/* Difficulty + length */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        {['Easy', 'Moderate', 'Challenging'].map(d => (
          <span key={d} style={{ ...chip(difficulty === d, accent), borderColor: difficulty === d ? DIFFICULTY_COLOR[d] : C.border, background: difficulty === d ? DIFFICULTY_COLOR[d] : C.card }}
            onClick={() => { setDifficulty(difficulty === d ? '' : d); setShown(24); }}>{d}</span>
        ))}
        <span style={{ width: 1, height: 22, background: C.border, margin: '0 4px' }} />
        {[2, 5, 10, 20].map(km => (
          <span key={km} style={chip(maxKm === km, accent)} onClick={() => { setMaxKm(maxKm === km ? 0 : km); setShown(24); }}>≤ {km} km</span>
        ))}
      </div>

      <div style={{ color: C.sub, fontSize: 13, marginBottom: 14 }}>
        <b style={{ color: C.text }}>{filtered.length}</b> {filtered.length === 1 ? 'route' : 'routes'}
        {(q || type || difficulty || area || maxKm) ? ' match your search' : (scopeText ? ` ${scopeText}` : '')}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 16 }}>
        {visible.map(t => {
          const meta = TYPE_META[t.trail_type] || { icon: '•', color: C.teal };
          return (
            <Link key={t.slug} href={`${base}/${t.slug}/`} style={{ textDecoration: 'none', color: 'inherit', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <RouteSvg pts={t.preview} color={meta.color} />
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: `${meta.color}14`, padding: '2px 8px', borderRadius: 6 }}>{meta.icon} {t.trail_type}</span>
                  {t.difficulty && <span style={{ fontSize: 11, fontWeight: 700, color: DIFFICULTY_COLOR[t.difficulty], background: `${DIFFICULTY_COLOR[t.difficulty]}14`, padding: '2px 8px', borderRadius: 6 }}>{t.difficulty}</span>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25, marginBottom: 6 }}>{t.name}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12.5, color: C.sub, flexWrap: 'wrap' }}>
                  {t.distance_label && <span>📏 {t.distance_label}</span>}
                  {t.duration_label && <span>⏱ {t.duration_label}</span>}
                  {t.area && <span>📍 {t.area}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {t.dog_friendly && <span title="Dog-friendly" style={{ fontSize: 14 }}>🐕</span>}
                  {t.bicycle_allowed && <span title="Cycling allowed" style={{ fontSize: 14 }}>🚲</span>}
                  {t.horse_allowed && <span title="Horse riding" style={{ fontSize: 14 }}>🐎</span>}
                  {t.waymarked && <span title="Waymarked" style={{ fontSize: 11, color: C.teal, fontWeight: 700, alignSelf: 'center' }}>✓ waymarked</span>}
                </div>
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
        <div style={{ textAlign: 'center', padding: 50, color: C.sub }}>No routes match your search. Try clearing a filter.</div>
      )}
    </div>
  );
}
