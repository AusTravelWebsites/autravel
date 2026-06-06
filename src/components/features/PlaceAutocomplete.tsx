'use client';
import { useEffect, useRef, useState } from 'react';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text: string; secondary_text: string };
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSelect?: (pred: Prediction) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

export function PlaceAutocomplete({ value, onChange, onSelect, placeholder = 'Search a place...', style, inputStyle }: Props) {
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [internal, setInternal] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipNextFetchRef = useRef(false);

  useEffect(() => { setInternal(value); }, [value]);

  useEffect(() => {
    if (skipNextFetchRef.current) { skipNextFetchRef.current = false; return; }
    const q = internal.trim();
    if (q.length < 2) { setPreds([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch('/api/places/search?q=' + encodeURIComponent(q));
        if (!r.ok) return;
        const d = await r.json();
        setPreds(d.predictions || []);
        setOpen(true); setHi(0);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [internal]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const pick = (p: Prediction) => {
    const name = p.structured_formatting?.main_text || p.description;
    skipNextFetchRef.current = true;
    setInternal(name);
    onChange(name);
    onSelect?.(p);
    setOpen(false);
    setPreds([]);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || preds.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, preds.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); pick(preds[hi]); }
    if (e.key === 'Escape')    { setOpen(false); }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={internal}
        onChange={e => { setInternal(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => preds.length > 0 && setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        autoComplete="off"
        style={inputStyle}
      />
      {open && preds.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 1000,
          maxHeight: 280, overflowY: 'auto',
        }}>
          {preds.map((p, i) => (
            <div key={p.place_id}
              onMouseDown={e => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setHi(i)}
              style={{
                padding: '10px 14px', cursor: 'pointer', fontSize: 14, color: '#111827',
                background: hi === i ? '#f0fdfa' : 'transparent',
                borderBottom: i < preds.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}>
              <div style={{ fontWeight: 600 }}>📍 {p.structured_formatting?.main_text || p.description}</div>
              {p.structured_formatting?.secondary_text && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{p.structured_formatting.secondary_text}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
