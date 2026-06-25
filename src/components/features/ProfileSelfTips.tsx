'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const C = { teal: 'var(--brand)', amber: '#f59e0b' };

interface Props { username: string; verified: boolean }

// Shown only when the viewer is looking at their OWN profile. Surfaces a soft CTA
// if they're not verified yet.
export function ProfileSelfTips({ username, verified }: Props) {
  const [me, setMe] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem('bb-verify-tip-dismissed') === '1') setDismissed(true); } catch {}
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => setMe(d?.user || null));
  }, []);

  if (!me || me.username !== username || verified || dismissed) return null;

  const close = () => { try { localStorage.setItem('bb-verify-tip-dismissed', '1'); } catch {}; setDismissed(true); };

  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', margin: '16px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
      <span style={{ fontSize: 22 }}>✓</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>Get the verified badge</div>
        <div style={{ fontSize: 12, color: '#92400e' }}>Verified travellers can host open meetups and get higher trust ratings.</div>
      </div>
      <Link href="/verify" style={{ background: C.amber, color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>Verify me</Link>
      <button onClick={close} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
    </div>
  );
}
