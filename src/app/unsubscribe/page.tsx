import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Unsubscribed', robots: { index: false, follow: true } };

interface Props { searchParams: Promise<{ ok?: string; type?: string }> }

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'var(--brand)' };

const LABELS: Record<string, string> = {
  all: 'all email notifications',
  like: 'likes',
  comment: 'comments',
  follow: 'new followers',
  tag_trip: 'trip tags',
  tag_review: 'review tags',
  new_message: 'new messages',
};

export default async function UnsubscribePage({ searchParams }: Props) {
  const sp = await searchParams;
  const type = sp.type || 'all';
  const label = LABELS[type] || type;
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'40px 32px', maxWidth:480, width:'100%', textAlign:'center' as const }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✉️</div>
        <h1 style={{ fontFamily:'Georgia, serif', fontSize:24, fontWeight:800, color:C.text, margin:'0 0 8px' }}>You're unsubscribed</h1>
        <p style={{ fontSize:15, color:C.sub, lineHeight:1.6, margin:'0 0 22px' }}>
          We won't send you emails about <strong>{label}</strong> any more. You'll still get them in your in-app notifications.
        </p>
        <div style={{ display:'flex', gap:10, justifyContent:'center' as const, flexWrap:'wrap' as const }}>
          <Link href="/settings" style={{ background:C.teal, color:'#fff', padding:'11px 22px', borderRadius:10, fontSize:14, fontWeight:700, textDecoration:'none' }}>Manage preferences</Link>
          <Link href="/" style={{ background:'#fff', color:C.text, padding:'11px 22px', borderRadius:10, fontSize:14, fontWeight:700, textDecoration:'none', border:`1px solid ${C.border}` }}>Go home</Link>
        </div>
      </div>
    </div>
  );
}
