'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text: string; secondary_text: string };
}

function slugifyCountry(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Google Places autocomplete restricted to country type, typo-tolerant.
// Lands the user on /country/[slug] instantly.
export function PlacesCountrySearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const s = q.trim();
    if (s.length < 2) { setPreds([]); return; }
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/places/search?q=${encodeURIComponent(s)}&types=country`);
        const d = r.ok ? await r.json() : { predictions: [] };
        setPreds(d.predictions || []);
        setOpen(true); setHi(0);
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const pick = (p: Prediction) => {
    const name = p.structured_formatting?.main_text || p.description;
    router.push(`/country/${slugifyCountry(name)}`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && preds.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, preds.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); pick(preds[hi]); return; }
      if (e.key === 'Escape')    { setOpen(false); }
    }
    if (e.key === 'Enter' && q.trim() && preds.length === 0) {
      router.push(`/country/${slugifyCountry(q.trim())}`);
    }
  };

  return (
    <div ref={wrap} style={{ position: 'relative' as const, maxWidth: 520, margin: '0 auto' }}>
      <div style={{ position: 'relative' as const }}>
        <span style={{ position: 'absolute' as const, left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 18, pointerEvents: 'none' as const }}>🌍</span>
        <input
          type="search"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => preds.length > 0 && setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search any country… e.g. Thailand, Portugal, Peru"
          autoComplete="off"
          style={{ width: '100%', padding: '14px 16px 14px 48px', borderRadius: 999, border: 'none', fontSize: 16, color: '#111827', background: '#fff', outline: 'none', boxSizing: 'border-box' as const, boxShadow: '0 6px 20px rgba(0,0,0,0.15)' }}
        />
      </div>
      {open && preds.length > 0 && (
        <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, marginTop: 6, background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 20, maxHeight: 320, overflowY: 'auto' as const, textAlign: 'left' as const }}>
          {preds.map((p, i) => (
            <button key={p.place_id}
              onMouseDown={e => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setHi(i)}
              style={{ display: 'block', width: '100%', padding: '10px 16px', background: hi === i ? '#f0fdfa' : 'transparent', border: 'none', textAlign: 'left' as const, cursor: 'pointer', fontSize: 14, color: '#111827', fontFamily: 'inherit' }}>
              <div style={{ fontWeight: 600 }}>🌍 {p.structured_formatting?.main_text || p.description}</div>
              {p.structured_formatting?.secondary_text && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{p.structured_formatting.secondary_text}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
