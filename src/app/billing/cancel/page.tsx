import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Checkout cancelled', robots: { index: false, follow: true } };

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488' };

export default function CancelPage() {
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'40px 32px', maxWidth:480, width:'100%', textAlign:'center' as const }}>
        <div style={{ fontSize:48, marginBottom:14 }}>👋</div>
        <h1 style={{ fontFamily:'Georgia, serif', fontSize:24, fontWeight:800, color:C.text, margin:'0 0 8px' }}>Checkout cancelled</h1>
        <p style={{ fontSize:15, color:C.sub, lineHeight:1.6, margin:'0 0 22px' }}>No payment was taken. You can come back any time.</p>
        <Link href="/" style={{ background:C.teal, color:'#fff', padding:'11px 22px', borderRadius:10, fontSize:14, fontWeight:700, textDecoration:'none' }}>Back to BugBitten</Link>
      </div>
    </div>
  );
}
