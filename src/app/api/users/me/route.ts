import { NextRequest, NextResponse } from 'next/server';
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin';
import sql from '@/lib/db';
import { stripExternalLinks, onlyInternalUrl } from '@/lib/sanitize';
import { resolveLocation } from '@/lib/google-places';
import { rateLimit } from '@/lib/admin';

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value;
  if (!session) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true);
    const [u] = await sql`SELECT id, firebase_uid FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await rateLimit(`profile-edit:${user.id}`, 30, 60))) {
      return NextResponse.json({ error: 'Profile update limit: 30/min.' }, { status: 429 });
    }
    const body = await req.json().catch(() => ({} as any));

    const text = (k: string) => body[k] !== undefined ? (body[k] === '' ? null : body[k]) : undefined;
    const arr = (k: string) => Array.isArray(body[k]) ? body[k] : undefined;

    // Strip any external URLs out of free-text fields; force website to internal-only
    const auto_meetup_opt_in = typeof body.auto_meetup_opt_in === 'boolean' ? body.auto_meetup_opt_in : undefined;
    const display_name     = stripExternalLinks(text('display_name'));
    const bio              = stripExternalLinks(text('bio'));
    const location         = stripExternalLinks(text('location'));
    const birth_place      = stripExternalLinks(text('birth_place'));
    const gender           = text('gender');
    const website          = body.website !== undefined ? onlyInternalUrl(body.website) : undefined;
    const avatar_url       = text('avatar_url');
    const cover_url        = text('cover_url');
    const travel_status    = text('travel_status');
    const current_location = stripExternalLinks(text('current_location'));
    const interests        = arr('interests');
    const visited          = arr('visited_countries');
    const wishlist         = arr('wishlist_countries');

    // Resolve home location via Google Places when location changes (non-blocking on error)
    let home_country: string | null | undefined = undefined;
    let home_country_code: string | null | undefined = undefined;
    let home_city: string | null | undefined = undefined;
    let home_place_id: string | null | undefined = undefined;
    if (location && typeof location === 'string' && location.trim().length >= 2) {
      try {
        const resolved = await resolveLocation(location);
        if (resolved) {
          home_country = resolved.country;
          home_country_code = resolved.country_code;
          home_city = resolved.city;
          home_place_id = resolved.place_id;
        }
      } catch (e) { console.warn('[users/me PUT] location resolve failed', e); }
    }

    const [updated] = await sql`
      UPDATE users SET
        display_name       = COALESCE(${display_name     ?? null}, display_name),
        bio                = COALESCE(${bio              ?? null}, bio),
        location           = COALESCE(${location         ?? null}, location),
        home_country       = COALESCE(${home_country     ?? null}, home_country),
        home_country_code  = COALESCE(${home_country_code ?? null}, home_country_code),
        home_city          = COALESCE(${home_city        ?? null}, home_city),
        home_place_id      = COALESCE(${home_place_id    ?? null}, home_place_id),
        birth_place        = COALESCE(${birth_place      ?? null}, birth_place),
        gender             = COALESCE(${gender           ?? null}, gender),
        website            = COALESCE(${website          ?? null}, website),
        avatar_url         = COALESCE(${avatar_url       ?? null}, avatar_url),
        cover_url          = COALESCE(${cover_url        ?? null}, cover_url),
        travel_status      = COALESCE(${travel_status    ?? null}, travel_status),
        current_location   = COALESCE(${current_location ?? null}, current_location),
        interests          = COALESCE(${(interests as any) ?? null}, interests),
        visited_countries  = COALESCE(${(visited as any)   ?? null}, visited_countries),
        wishlist_countries = COALESCE(${(wishlist as any)  ?? null}, wishlist_countries),
        auto_meetup_opt_in = COALESCE(${auto_meetup_opt_in ?? null}, auto_meetup_opt_in),
        updated_at         = NOW()
      WHERE firebase_uid = ${user.firebase_uid}
      RETURNING id, username, display_name, bio, location, home_country, home_country_code, home_city, website, avatar_url, cover_url, travel_status, current_location, interests, visited_countries, wishlist_countries`;
    return NextResponse.json({ ok: true, user: updated });
  } catch (err: any) {
    console.error('[users/me PUT]', err);
    return serverError(err, 'users/me', req);
  }
}
