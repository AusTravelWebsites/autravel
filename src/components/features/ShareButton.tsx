'use client';
import { useEffect, useRef, useState } from 'react';

interface Props { url: string; text?: string; label?: string }

export function ShareButton({ url, text, label = 'Share' }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const shareText = text ? `${text} ${url}` : url;
  const options = [
    { n: 'Facebook', i: 'Ⓕ', color: '#1877F2', h: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { n: 'X / Twitter', i: '𝕏', color: '#000', h: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` },
    { n: 'WhatsApp', i: '💬', color: '#25D366', h: `https://wa.me/?text=${encodeURIComponent(shareText)}` },
    { n: 'Email', i: '✉️', color: '#6b7280', h: `mailto:?subject=${encodeURIComponent(text || 'Check this out')}&body=${encodeURIComponent(shareText)}` },
  ];

  const tryNative = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try { await (navigator as any).share({ url, text, title: text || 'BugBitten' }); return true; } catch {}
    }
    return false;
  };

  const handleClick = async () => {
    if (await tryNative()) return;
    setOpen(o => !o);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {}
  };

  return (
    <div ref={ref} style={{ position: 'relative' as const, display: 'inline-block' }}>
      <button onClick={handleClick} aria-label={label} style={{ background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        {label}
      </button>
      {open && (
        <div style={{ position: 'absolute' as const, right: 0, top: '100%', marginTop: 6, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 40, minWidth: 180, overflow: 'hidden' as const }}>
          {options.map(o => (
            <a key={o.n} href={o.h} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', color: '#374151', textDecoration: 'none', fontSize: 13, fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ color: o.color, fontSize: 16 }}>{o.i}</span>{o.n}
            </a>
          ))}
          <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', color: copied ? '#10b981' : '#374151', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%', textAlign: 'left' as const, fontFamily: 'inherit' }}>
            <span style={{ fontSize: 16 }}>🔗</span>{copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  );
}
