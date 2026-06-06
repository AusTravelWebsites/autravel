import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit, getIP } from '@/lib/admin';
import { verifyOnGoogle } from '@/lib/google-places';
import { slugifyCity } from '@/lib/channel-moderation';

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id, is_banned FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    if (!u || u.is_banned) return null;
    return u as { id: string };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const pat = '%' + q + '%';
  const rows = q
    ? await sql`
        SELECT id, slug, city_name, country, member_count, message_count, last_activity_at
        FROM channels
        WHERE city_name ILIKE ${pat} OR country ILIKE ${pat}
        ORDER BY last_activity_at DESC NULLS LAST, member_count DESC LIMIT 80`
    : await sql`
        SELECT id, slug, city_name, country, member_count, message_count, last_activity_at
        FROM channels
        ORDER BY last_activity_at DESC NULLS LAST, member_count DESC LIMIT 80`;
  return NextResponse.json({ channels: rows });
}

export async function POST(req: NextRequest) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Please log in' }, { status: 401 });
  if (!(await rateLimit(`channel-create:${viewer.id}`, 5, 3600))) {
    return NextResponse.json({ error: 'Too many channel creations. Try later.' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({} as any));
  const query = typeof body?.location === 'string' ? body.location.trim() : '';
  if (query.length < 2) return NextResponse.json({ error: 'City required' }, { status: 400 });

  const match = await verifyOnGoogle(query);
  if (!match) return NextResponse.json({ error: 'City not found on Google Maps' }, { status: 404 });

  // Extract city + country from formatted_address (last = country, second-last = city)
  const parts = (match.formatted_address || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const country = parts[parts.length - 1] || null;
  const cityName = match.name || parts[parts.length - 2] || parts[0] || query;

  // Already exists?
  const existing = await sql`SELECT id, slug FROM channels WHERE google_place_id = ${match.place_id} LIMIT 1`;
  if (existing[0]) {
    return NextResponse.json({ channel: existing[0], created: false });
  }

  // Build unique slug
  let baseSlug = slugifyCity(cityName, country);
  let slug = baseSlug;
  for (let n = 2; n < 40; n++) {
    const dupe = await sql`SELECT 1 FROM channels WHERE slug = ${slug} LIMIT 1`;
    if (!dupe.length) break;
    slug = `${baseSlug}-${n}`;
  }

  const [channel] = await sql`
    INSERT INTO channels (slug, city_name, country, google_place_id, lat, lng, created_by, member_count)
    VALUES (${slug}, ${cityName}, ${country}, ${match.place_id},
            ${match.geometry?.location?.lat ?? null}, ${match.geometry?.location?.lng ?? null},
            ${viewer.id}, 1)
    RETURNING id, slug`;
  await sql`INSERT INTO channel_members (channel_id, user_id) VALUES (${channel.id}, ${viewer.id}) ON CONFLICT DO NOTHING`;
  return NextResponse.json({ channel, created: true });
}
