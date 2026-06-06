import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { stripExternalLinks } from '@/lib/sanitize';
import { upsertPlaceFromLocation } from '@/lib/google-places';
import { rateLimit, getIP } from '@/lib/admin';
import { getMutedIds } from '@/lib/blocks';

async function getUser(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await db`SELECT id::text, username FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/['"’`]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0, 80) || 'post';
}
function readingMinutes(body: string) { return Math.max(1, Math.round((body.trim().split(/\s+/).length || 1) / 200)); }
function excerptOf(body: string, n = 180) { const s = body.replace(/\s+/g,' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }

// GET /api/blog?category=&country=&tag=&search=&author=&page=&limit=
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const category = sp.get('category');
  const country = sp.get('country');
  const tag = sp.get('tag');
  const search = (sp.get('search') || '').trim();
  const author = sp.get('author'); // username
  const page = Math.max(1, parseInt(sp.get('page') || '1'));
  const limit = Math.min(50, Math.max(3, parseInt(sp.get('limit') || '12')));
  const offset = (page - 1) * limit;
  const pat = '%' + search + '%';
  const viewer = await getUser(req);
  const muted = viewer ? await getMutedIds(viewer.id) : [];
  const rows = await db`
    SELECT b.id::text, b.slug, b.title, b.subtitle, b.excerpt, b.featured_image, b.category, b.tags,
           b.location_name, b.country, b.view_count, b.reading_minutes, b.published_at, b.updated_at,
           u.username, u.display_name, u.avatar_url
    FROM blog_posts b JOIN users u ON u.id::text = b.user_id
    WHERE b.status = 'published'
      AND (${category ? true : false}::boolean = false OR b.category = ${category || ''})
      AND (${country ? true : false}::boolean = false OR b.country = ${country || ''})
      AND (${tag ? true : false}::boolean = false OR ${tag || ''} = ANY(b.tags))
      AND (${search ? true : false}::boolean = false OR b.title ILIKE ${pat} OR b.body ILIKE ${pat} OR b.location_name ILIKE ${pat})
      AND (${author ? true : false}::boolean = false OR u.username = ${author || ''})
      AND (${muted.length === 0 ? true : false}::boolean = true OR b.user_id <> ALL(${muted as any}::text[]))
    ORDER BY COALESCE(b.published_at, b.created_at) DESC LIMIT ${limit} OFFSET ${offset}`;
  const [{ count }] = await db`
    SELECT COUNT(*)::int AS count FROM blog_posts b JOIN users u ON u.id::text = b.user_id
    WHERE b.status = 'published'
      AND (${category ? true : false}::boolean = false OR b.category = ${category || ''})
      AND (${country ? true : false}::boolean = false OR b.country = ${country || ''})
      AND (${tag ? true : false}::boolean = false OR ${tag || ''} = ANY(b.tags))
      AND (${search ? true : false}::boolean = false OR b.title ILIKE ${pat} OR b.body ILIKE ${pat} OR b.location_name ILIKE ${pat})
      AND (${author ? true : false}::boolean = false OR u.username = ${author || ''})`;
  return NextResponse.json({ posts: rows, total: count, page, limit });
}

// POST — create a blog post
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: 'Sign in to publish' }, { status: 401 });
  const ip = getIP(req);
  if (ip && !(await rateLimit(`blog:${ip}`, 10, 3600))) return NextResponse.json({ error: 'Too many posts — try later.' }, { status: 429 });

  const b = await req.json().catch(() => ({} as any));
  const title = stripExternalLinks(b.title)?.trim();
  const body = stripExternalLinks(b.body)?.trim();
  const location_name = stripExternalLinks(b.location_name)?.trim();
  const category = ['blog','review','story'].includes(b.category) ? b.category : 'blog';
  const featured_image = typeof b.featured_image === 'string' && /^https?:\/\//.test(b.featured_image) ? b.featured_image : null;
  const featured_image_alt = typeof b.featured_image_alt === 'string' ? b.featured_image_alt.trim().slice(0, 200) : null;

  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
  if (!body || body.length < 40) return NextResponse.json({ error: 'Body must be at least 40 characters' }, { status: 400 });
  if (!featured_image) return NextResponse.json({ error: 'Featured image is required — upload an image first.' }, { status: 400 });
  if (!location_name) return NextResponse.json({ error: 'Location is required.' }, { status: 400 });

  // Resolve location via Google Places (already reused elsewhere)
  let place_id: string | null = null;
  let lat: number | null = null, lng: number | null = null, country: string | null = null;
  try {
    const p = await upsertPlaceFromLocation(location_name, db as any);
    if (p) { place_id = p.id; lat = p.lat ?? null; lng = p.lng ?? null; country = p.country ?? null; }
  } catch (e: any) { console.error('[blog place upsert]', e?.message); }

  const subtitle = stripExternalLinks(b.subtitle)?.trim().slice(0, 200) || null;
  const excerpt = (stripExternalLinks(b.excerpt)?.trim().slice(0, 220)) || excerptOf(body);
  const tags: string[] = Array.isArray(b.tags) ? (b.tags as any[]).map(t => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 10) : [];
  const metaTitle = stripExternalLinks(b.meta_title)?.trim().slice(0, 70) || null;
  const metaDescription = stripExternalLinks(b.meta_description)?.trim().slice(0, 160) || null;

  let baseSlug = slugify(b.slug || title);
  let slug = baseSlug;
  for (let n = 2; n < 25; n++) {
    const [clash] = await db`SELECT 1 FROM blog_posts WHERE slug = ${slug} LIMIT 1`;
    if (!clash) break;
    slug = `${baseSlug}-${n}`;
  }

  const status = b.status === 'draft' ? 'draft' : 'published';
  const publishedAt = status === 'published' ? new Date() : null;

  const [row] = await db`
    INSERT INTO blog_posts (user_id, slug, title, subtitle, body, excerpt, featured_image, featured_image_alt,
      category, tags, location_name, place_id, lat, lng, country, meta_title, meta_description,
      reading_minutes, status, published_at)
    VALUES (${user.id}::text, ${slug}, ${title}, ${subtitle}, ${body}, ${excerpt}, ${featured_image}, ${featured_image_alt},
      ${category}, ${tags as any}, ${location_name}, ${place_id}, ${lat}, ${lng}, ${country}, ${metaTitle}, ${metaDescription},
      ${readingMinutes(body)}, ${status}, ${publishedAt})
    RETURNING id::text, slug`;
  return NextResponse.json({ post: row }, { status: 201 });
}
