import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getMutedIds } from '@/lib/blocks';

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id, location, home_country, home_country_code FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ users: [], error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const genders = (url.searchParams.get('genders') || '').split(',').map(s => s.trim()).filter(Boolean);
  const ageMin = parseInt(url.searchParams.get('age_min') || '0') || null;
  const ageMax = parseInt(url.searchParams.get('age_max') || '0') || null;
  const hasPhotos = url.searchParams.get('has_photos') === '1';
  const sameCountry = url.searchParams.get('same_country') !== '0';

  const viewerCountryCode = viewer.home_country_code || null;
  const viewerCountry = viewer.home_country || null;

  const pat = '%' + q + '%';
  const hasQ = q.length > 0;
  const useCountryFilter = sameCountry && (viewerCountryCode || viewerCountry);
  const muted = await getMutedIds(viewer.id);

  const rows = await sql`
    SELECT id::text AS id, username, display_name, avatar_url, bio, location, home_country, home_country_code,
      last_seen_at, verification_status,
      gender, date_of_birth,
      CASE WHEN date_of_birth IS NOT NULL THEN DATE_PART('year', AGE(date_of_birth))::int ELSE NULL END AS age
    FROM users
    WHERE id::text <> ${viewer.id}
      AND COALESCE(is_banned, false) = false
      AND username IS NOT NULL
      AND id::text NOT IN (SELECT following_id FROM follows WHERE follower_id = ${viewer.id})
      AND (${muted.length === 0 ? true : false}::boolean = true OR id::text <> ALL(${muted as any}::text[]))
      AND (${hasQ}::boolean = false OR (display_name ILIKE ${pat} OR username ILIKE ${pat} OR location ILIKE ${pat} OR home_city ILIKE ${pat} OR home_country ILIKE ${pat}))
      AND (${useCountryFilter ? true : false}::boolean = false
           OR home_country_code = ${viewerCountryCode}
           OR home_country = ${viewerCountry})
      AND (${genders.length > 0 ? true : false}::boolean = false OR gender = ANY(${genders as any}::text[]))
      AND (${hasPhotos ? true : false}::boolean = false OR (avatar_url IS NOT NULL AND avatar_url <> ''))
      AND (${ageMin ?? 0}::int = 0 OR (date_of_birth IS NOT NULL AND DATE_PART('year', AGE(date_of_birth)) >= ${ageMin ?? 0}))
      AND (${ageMax ?? 0}::int = 0 OR (date_of_birth IS NOT NULL AND DATE_PART('year', AGE(date_of_birth)) <= ${ageMax ?? 0}))
    ORDER BY
      CASE WHEN avatar_url IS NOT NULL AND avatar_url <> '' THEN 0 ELSE 1 END,
      created_at DESC
    LIMIT 100`;

  const users = (rows as any[]).map(u => ({
    id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url,
    bio: u.bio, location: u.location, gender: u.gender, age: u.age,
    home_country: u.home_country, home_country_code: u.home_country_code,
    last_seen_at: u.last_seen_at, verification_status: u.verification_status,
  }));
  return NextResponse.json({ users, viewer_country: viewerCountry, viewer_country_code: viewerCountryCode });
}
