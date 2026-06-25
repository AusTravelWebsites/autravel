'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

export type TrackCard = {
  slug: string;
  name: string;
  region: string | null;
  grade: string | null;
  length_km: number | null;
  days: string | null;
  best_season: string | null;
  remoteness: string | null;
};

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', accent: '#b45309', accentLight: '#fff7ed' };
const GRADE_COLOR: Record<string, string> = { 'Easy 4WD': '#16a34a', 'Moderate 4WD': '#d97706', 'Hard 4WD': '#ea580c', 'Extreme': '#dc2626' };
const GRADE_ORDER = ['Easy 4WD', 'Moderate 4WD', 'Hard 4WD', 'Extreme'];

const chip = (active: boolean, color = C.accent): React.CSSProperties => ({
  padding: '6px 13px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: `1px solid ${active ? color : C.border}`, background: active ? color : C.card,
  color: active ? '#fff' : C.text, whiteSpace: 'nowrap',
});

export function TrackFinder({ tracks, regions, scope }: { tracks: TrackCard[]; regions: string[]; scope: string }) {
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const [region, setRegion] = useState('');
  const [maxKm, setMaxKm] = useState(0);
  const [sort, setSort] = useState('grade');
  const [shown, setShown] = useState(24);

  const grades = useMemo(() => GRADE_ORDER.filter(g => tracks.some(t => t.grade === g)), [tracks]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = tracks.filter(t => {
      if (term && !t.name.toLowerCase().includes(term) && !(t.region || '').toLowerCase().includes(term)) return false;
      if (grade && t.grade !== grade) return false;
      if (region && t.region !== region) return false;
      if (maxKm && (t.length_km || 0) > maxKm) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'longest') return (b.length_km || 0) - (a.length_km || 0);
      if (sort === 'shortest') return (a.length_km || 0) - (b.length_km || 0);
      if (sort === 'name') return a.name.localeCompare(b.name);
      // grade: easy → extreme, then longer
      const ai = GRADE_ORDER.indexOf(a.grade || ''), bi = GRADE_ORDER.indexOf(b.grade || '');
      if (ai !== bi) return ai - bi;
      return (b.length_km || 0) - (a.length_km || 0);
    });
    return list;
  }, [tracks, q, grade, region, maxKm, sort]);

  const visible = filtered.slice(0, shown);
  const reset = () => setShown(24);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input value={q} onChange={e => { setQ(e.target.value); reset(); }} placeholder="Search by track name or region…"
          style={{ flex: '1 1 280px', minWidth: 220, padding: '11px 15px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 15, outline: 'none' }} />
        <select value={region} onChange={e => { setRegion(e.target.value); reset(); }} style={{ padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: '#fff', maxWidth: 260 }}>
          <option value="">All regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '11px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: '#fff' }}>
          <option value="grade">By difficulty</option>
          <option value="longest">Longest first</option>
          <option value="shortest">Shortest first</option>
          <option value="name">A–Z</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={chip(grade === '')} onClick={() => { setGrade(''); reset(); }}>All grades</span>
        {grades.map(g => (
          <span key={g} style={chip(grade === g, GRADE_COLOR[g])} onClick={() => { setGrade(grade === g ? '' : g); reset(); }}>{g}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>Max length:</span>
        {[0, 100, 500, 1000].map(km => (
          <span key={km} style={chip(maxKm === km)} onClick={() => { setMaxKm(km); reset(); }}>{km === 0 ? 'Any' : `≤ ${km.toLocaleString()} km`}</span>
        ))}
      </div>

      <div style={{ color: C.sub, fontSize: 13, marginBottom: 14 }}>
        <b style={{ color: C.text }}>{filtered.length}</b> {filtered.length === 1 ? 'track' : 'tracks'}
        {(q || grade || region || maxKm) ? ' match your search' : ` across ${scope}`}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
        {visible.map(t => {
          const gc = GRADE_COLOR[t.grade || ''] || C.accent;
          return (
            <Link key={t.slug} href={`/off-road-tracks/${t.slug}/`} style={{ textDecoration: 'none', color: 'inherit', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 8, background: gc }} />
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {t.grade && <span style={{ fontSize: 11, fontWeight: 700, color: gc, background: `${gc}14`, padding: '2px 9px', borderRadius: 6 }}>{t.grade}</span>}
                  {t.remoteness && <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, background: '#f3f4f6', padding: '2px 9px', borderRadius: 6 }}>{t.remoteness} remoteness</span>}
                </div>
                <div style={{ fontWeight: 800, fontSize: 16.5, lineHeight: 1.25, marginBottom: 4 }}>{t.name}</div>
                {t.region && <div style={{ fontSize: 12.5, color: C.sub }}>📍 {t.region}</div>}
                <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: C.text, marginTop: 10, flexWrap: 'wrap' }}>
                  {t.length_km != null && <span>📏 <b>{t.length_km.toLocaleString()}</b> km</span>}
                  {t.days && <span>🗓 {t.days}</span>}
                  {t.best_season && <span>☀️ {t.best_season}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {visible.length < filtered.length && (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button onClick={() => setShown(shown + 24)} style={{ padding: '11px 26px', borderRadius: 10, border: `1px solid ${C.accent}`, background: C.accentLight, color: C.accent, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Show more ({filtered.length - visible.length} left)
          </button>
        </div>
      )}
      {filtered.length === 0 && <div style={{ textAlign: 'center', padding: 50, color: C.sub }}>No tracks match your search. Try clearing a filter.</div>}
    </div>
  );
}
