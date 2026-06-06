'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text: string; secondary_text: string };
}

// Google Places country-type autocomplete → navigates to /tours?country=<name>&...
// Country name kept as the display name (matches what the tours.country column stores).
export function ToursCountrySearch({ currentCountry, preserveParams = {} }: {
  currentCountry?: string
  preserveParams?: Record<string, string | undefined>
}) {
  const router = useRouter();
  const [q, setQ] = useState(currentCountry || '');
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const skip = useRef(false);

  // Reset local input when the selected country changes (e.g. after navigation)
  useEffect(() => { setQ(currentCountry || '') }, [currentCountry])

  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    const s = q.trim();
    if (s.length < 2) { setPreds([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/places/search?q=${encodeURIComponent(s)}&types=country`);
        const d = r.ok ? await r.json() : { predictions: [] };
        setPreds(d.predictions || []);
        setOpen(true); setHi(0);
      } catch {}
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const navigateTo = (countryName: string | null) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(preserveParams)) if (v) p.set(k, v)
    if (countryName) p.set('country', countryName)
    router.push(`/tours${p.toString() ? '?' + p.toString() : ''}`)
  }

  const pick = (p: Prediction) => {
    const name = p.structured_formatting?.main_text || p.description;
    skip.current = true;
    setQ(name); setOpen(false);
    navigateTo(name);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && preds.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, preds.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); pick(preds[hi]); return; }
      if (e.key === 'Escape')    { setOpen(false); return; }
    }
    if (e.key === 'Enter' && q.trim()) {
      e.preventDefault();
      navigateTo(q.trim());
    }
  };

  const clear = () => { setQ(''); setPreds([]); setOpen(false); navigateTo(null); };

  return (
    <div ref={wrap} style={{ position: 'relative' as const, width: '100%' }}>
      <div style={{ position: 'relative' as const }}>
        <span style={{ position: 'absolute' as const, left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' as const }}>🌍</span>
        <input
          type="search"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => preds.length > 0 && setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search country to start — e.g. Thailand, Peru, Japan"
          autoComplete="off"
          style={{ width: '100%', padding: '11px 40px 11px 40px', borderRadius: 999, border: '1px solid #d1d5db', fontSize: 14, color: '#111827', background: '#fff', outline: 'none', boxSizing: 'border-box' as const }}
        />
        {q && (
          <button onClick={clear} aria-label="Clear country filter"
            style={{ position: 'absolute' as const, right: 10, top: '50%', transform: 'translateY(-50%)', background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', color: '#6b7280', fontSize: 13, lineHeight: 1 }}>×</button>
        )}
      </div>
      {open && preds.length > 0 && (
        <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, marginTop: 6, background: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.15)', zIndex: 30, maxHeight: 320, overflowY: 'auto' as const, textAlign: 'left' as const, border: '1px solid #e5e7eb' }}>
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
