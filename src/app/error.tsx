'use client';
import Link from 'next/link';
import { useEffect } from 'react';

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488', tealLight:'#f0fdfa' };

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[app error]', error); }, [error]);
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:'44px 32px', maxWidth:520, width:'100%', textAlign:'center' as const }}>
        <div style={{ fontSize:64, marginBottom:12 }}>🧭</div>
        <h1 style={{ fontFamily:'Georgia, serif', fontSize:28, fontWeight:800, color:C.text, margin:'0 0 8px' }}>Lost the trail</h1>
        <p style={{ fontSize:15, color:C.sub, lineHeight:1.6, margin:'0 0 24px' }}>
          Something went wrong loading this page. It's usually a brief hiccup — give it another go.
        </p>
        {error.digest && <p style={{ fontSize:11, color:C.sub, margin:'0 0 20px', fontFamily:'monospace' }}>ref: {error.digest}</p>}
        <div style={{ display:'flex', gap:10, justifyContent:'center' as const, flexWrap:'wrap' as const }}>
          <button onClick={() => reset()} style={{ background:C.teal, color:'#fff', padding:'11px 22px', borderRadius:10, fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit' }}>Try again</button>
          <Link href="/" style={{ background:'#fff', color:C.text, padding:'11px 22px', borderRadius:10, fontSize:14, fontWeight:700, textDecoration:'none', border:`1px solid ${C.border}` }}>Go home</Link>
        </div>
      </div>
    </div>
  );
}
