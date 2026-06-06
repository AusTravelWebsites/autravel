import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Thanks for your support', robots: { index: false, follow: true } };

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488' };

export default function SuccessPage() {
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'40px 32px', maxWidth:480, width:'100%', textAlign:'center' as const }}>
        <div style={{ fontSize:48, marginBottom:14 }}>🌿</div>
        <h1 style={{ fontFamily:'Georgia, serif', fontSize:28, fontWeight:800, color:C.text, margin:'0 0 8px' }}>Thank you!</h1>
        <p style={{ fontSize:15, color:C.sub, lineHeight:1.6, margin:'0 0 24px' }}>
          Your payment was successful. You'll get a receipt by email shortly.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' as const, flexWrap:'wrap' as const }}>
          <Link href="/feed" style={{ background:C.teal, color:'#fff', padding:'11px 22px', borderRadius:10, fontSize:14, fontWeight:700, textDecoration:'none' }}>Back to feed</Link>
          <Link href="/settings" style={{ background:'#fff', color:C.text, padding:'11px 22px', borderRadius:10, fontSize:14, fontWeight:700, textDecoration:'none', border:`1px solid ${C.border}` }}>Manage billing</Link>
        </div>
      </div>
    </div>
  );
}
