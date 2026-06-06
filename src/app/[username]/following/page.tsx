import { notFound } from 'next/navigation';
import Link from 'next/link';
import sql from '@/lib/db';

interface Props { params: Promise<{ username: string }> }

export default async function FollowingPage({ params }: Props) {
  const { username } = await params;
  const users = await sql`SELECT id, username FROM users WHERE username = ${username} LIMIT 1`;
  if (!users.length) notFound();
  const user = users[0];

  const following = await sql`
    SELECT u.username, u.display_name, u.avatar_url, u.id
    FROM follows f JOIN users u ON u.id::text = f.following_id
    WHERE f.follower_id = ${user.id.toString()}
    ORDER BY f.created_at DESC
  `;

  return (
    <div style={{ background: '#f3f4f6', minHeight: '100vh', color: '#111827' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px' }}>
        <Link href={'/' + username} style={{ color: '#0d9488', textDecoration: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24 }}>
          ← {username}
        </Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 800, color: '#111827', marginBottom: 24 }}>Following</h1>
        {following.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6b7280' }}>Not following anyone yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {following.map((f: any) => (
              <Link key={f.id} href={'/' + f.username} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, background: '#ffffff', border: '1px solid #e5e7eb', marginBottom: 8 }}>
                  {f.avatar_url
                    ? <img loading="lazy" decoding="async" src={f.avatar_url} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 18 }}>{(f.display_name || f.username)?.[0]?.toUpperCase()}</div>
                  }
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{f.display_name || f.username}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>@{f.username}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
