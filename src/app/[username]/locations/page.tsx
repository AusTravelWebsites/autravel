import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { LocationsClient } from '@/components/features/LocationsClient';

interface Props { params: Promise<{ username: string }> }

export default async function UserLocationsPage({ params }: Props) {
  const { username } = await params;

  // Auth gate — viewers must be logged in (per Craig's spec).
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  let viewerOk = false;
  if (session) {
    try {
      await getAdminAuth().verifySessionCookie(session, true);
      viewerOk = true;
    } catch {}
  }
  if (!viewerOk) {
    redirect(`/login?next=${encodeURIComponent(`/${username}/locations`)}`);
  }

  const users = await sql`SELECT id, username, display_name, avatar_url FROM users WHERE username = ${username} LIMIT 1`;
  if (!users.length) notFound();
  const user = users[0];

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', color: '#111827', paddingBottom: 60 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <Link href={`/${user.username}`} style={{ color: '#0d9488', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>← {user.display_name || user.username}</Link>
        </div>
        <LocationsClient username={user.username as string} displayName={(user.display_name as string) || (user.username as string)} />
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `${username}'s Locations` };
}
