'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa' };

function Avatar({ user, size = 40 }: { user: any; size?: number }) {
  const l = (user?.display_name || user?.username || '?')[0].toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0, overflow: 'hidden' }}>
      {user?.avatar_url ? <img loading="lazy" decoding="async" src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : l}
    </div>
  );
}

export function LeftSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => { if (d?.user) setUser(d.user); }).catch(() => {});
  }, []);

  const links = [
    { href: '/feed', label: 'Feed' },
    { href: '/explore', label: 'Explore Places' },
    { href: '/check-in', label: 'Check In' },
    { href: '/friends', label: 'Friends' },
    { href: '/favourites', label: 'Favourites' },
    { href: '/meetups', label: 'Meetups' },
    { href: '/channels', label: 'Channels' },
    { href: '/auto-meetups', label: 'Nearby travellers' },
    { href: '/trips', label: 'My Trips' },
    { href: user ? `/${user.username}/locations` : '/login', label: 'Your Locations' },
    { href: '/messages', label: 'Messages' },
    { href: '/my-reviews', label: 'My Reviews' },
  ];

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href + '/'));

  return (
    <div style={{ position: 'sticky' as const, top: 76 }}>
      <div style={{ background: C.card, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        {user && (
          <Link href={`/${user.username}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', textDecoration: 'none', borderBottom: `1px solid ${C.border}`, background: C.tealLight }}>
            <Avatar user={user} size={40} />
            <div>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{user.display_name || user.username}</div>
              <div style={{ color: C.teal, fontSize: 12 }}>View my profile →</div>
            </div>
          </Link>
        )}
        {links.map((l, i) => (
          <Link key={l.href + i} href={l.href} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            color: isActive(l.href) ? C.teal : C.text,
            textDecoration: 'none',
            borderBottom: i < links.length - 1 ? `1px solid ${C.border}` : 'none',
            background: isActive(l.href) ? C.tealLight : 'transparent',
            borderLeft: isActive(l.href) ? `3px solid ${C.teal}` : '3px solid transparent',
            fontSize: 14, fontWeight: l.bold || isActive(l.href) ? 700 : 500,
          }}>
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
