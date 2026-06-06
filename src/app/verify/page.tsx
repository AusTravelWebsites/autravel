'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function VerifyPage() {
  const [me, setMe] = useState<any>(null);
  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => setMe(d?.user || null));
  }, []);

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', padding: '40px 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 32 }}>
        <Link href="/" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>← Back</Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 800, margin: '16px 0 12px' }}>Verify your profile</h1>

        {me?.verification_status === 'verified' ? (
          <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, padding: 16, color: '#065f46' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>✓ You're verified</div>
            <div style={{ fontSize: 13 }}>You can host and join open meetups with strangers.</div>
          </div>
        ) : (
          <>
            <p style={{ color: '#374151', lineHeight: 1.65, fontSize: 15 }}>
              We use a quick face-age estimation (no photo stored) to confirm you're 18+ before you join meetups
              with strangers. This keeps the community safe and meets UK, EU and Australian age-verification rules.
            </p>
            <ul style={{ color: '#374151', fontSize: 14, lineHeight: 1.8, paddingLeft: 18, margin: '12px 0 24px' }}>
              <li>★ Verified badge on your profile</li>
              <li>Host or join open-to-strangers meetups</li>
              <li>Higher trust rating from other travellers</li>
            </ul>
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: 14, fontSize: 13, color: '#92400e' }}>
              <strong>Coming very soon.</strong> Yoti facial age estimation is integrated and awaiting final
              go-live keys. Until then, friends-only and friends-of-friends meetups work as normal without
              verification.
            </div>
            {me?.is_admin && (
              <p style={{ marginTop: 18, fontSize: 12, color: '#6b7280' }}>
                Admins: manually mark a user as verified from the <Link href="/admin/users" style={{ color: '#0d9488' }}>users page</Link>.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
