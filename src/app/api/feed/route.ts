import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import { getMutedIds } from '@/lib/blocks'

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const rows = await db`SELECT id FROM users WHERE firebase_uid=${decoded.uid} LIMIT 1`
    return rows[0] ?? null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawMode = searchParams.get('mode')
    const mode = rawMode === 'global' ? 'global' : rawMode === 'mine' ? 'mine' : 'following'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50)
    const cursor = searchParams.get('cursor') ?? null
    const user = await getUser(req)

    if ((mode === 'following' || mode === 'mine') && !user) {
      return NextResponse.json({ entries: [], nextCursor: null, hasMore: false })
    }
    const me = user?.id ? String(user.id) : null
    const muted = me ? await getMutedIds(me) : []

    const fetchLimit = limit + 1

    // Preload the followed-user id set ONCE instead of running the subquery inside each of the 3 feeds.
    // For a user following 200 people, the 3× correlated IN-subqueries plus follows scan was hitting the 8s
    // Supabase statement_timeout and surfacing as an unhandled rejection — breaking the Friends feed entirely.
    let followedIds: string[] = []
    if (mode === 'following' && user) {
      const rows = await db`SELECT following_id FROM follows WHERE follower_id = ${String(user.id)}::text`
      followedIds = (rows as any[]).map(r => String(r.following_id))
      // No follows → shortcut to empty (no need to query content at all)
      if (followedIds.length === 0) {
        return NextResponse.json({ entries: [], nextCursor: null, hasMore: false })
      }
    }

    // ── Journal entries ──
    const journalsPromise = mode === 'mine' ? db`
      SELECT je.id, 'journal' as type,
        COALESCE(je.posted_at, je.created_at) as created_at,
        NULL::text as title, je.body, je.media_urls as photo_urls,
        je.like_count, je.comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM journal_entries je
      JOIN users u ON u.id::text = je.user_id
      LEFT JOIN trips t ON t.id = je.trip_id
      LEFT JOIN places p ON p.id = je.place_id
      WHERE je.user_id = ${me!}::text
        AND (${cursor}::timestamptz IS NULL OR COALESCE(je.posted_at, je.created_at) < ${cursor}::timestamptz)
      ORDER BY COALESCE(je.posted_at, je.created_at) DESC LIMIT ${fetchLimit}
    ` : mode === 'following' ? db`
      SELECT je.id, 'journal' as type,
        COALESCE(je.posted_at, je.created_at) as created_at,
        NULL::text as title, je.body, je.media_urls as photo_urls,
        je.like_count, je.comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM journal_entries je
      JOIN users u ON u.id::text = je.user_id
      LEFT JOIN trips t ON t.id = je.trip_id
      LEFT JOIN places p ON p.id = je.place_id
      WHERE je.user_id = ANY(${followedIds as any}::text[])
        AND (${cursor}::timestamptz IS NULL OR COALESCE(je.posted_at, je.created_at) < ${cursor}::timestamptz)
      ORDER BY COALESCE(je.posted_at, je.created_at) DESC LIMIT ${fetchLimit}
    ` : db`
      SELECT je.id, 'journal' as type,
        COALESCE(je.posted_at, je.created_at) as created_at,
        NULL::text as title, je.body, je.media_urls as photo_urls,
        je.like_count, je.comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM journal_entries je
      JOIN users u ON u.id::text = je.user_id
      LEFT JOIN trips t ON t.id = je.trip_id
      LEFT JOIN places p ON p.id = je.place_id
      WHERE je.is_public = true
        AND (${cursor}::timestamptz IS NULL OR COALESCE(je.posted_at, je.created_at) < ${cursor}::timestamptz)
      ORDER BY COALESCE(je.posted_at, je.created_at) DESC LIMIT ${fetchLimit}
    `

    // ── Checkins ──
    const checkinsPromise = mode === 'mine' ? db`
      SELECT c.id, 'checkin' as type, c.created_at,
        NULL::text as title, c.note as body, c.images as photo_urls,
        0 as like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM checkins c
      JOIN users u ON u.id::text = c.user_id
      LEFT JOIN trips t ON t.id = c.trip_id
      LEFT JOIN places p ON p.id = c.place_id
      WHERE c.user_id = ${me!}::text
        AND (${cursor}::timestamptz IS NULL OR c.created_at < ${cursor}::timestamptz)
      ORDER BY c.created_at DESC LIMIT ${fetchLimit}
    ` : mode === 'following' ? db`
      SELECT c.id, 'checkin' as type, c.created_at,
        NULL::text as title, c.note as body, c.images as photo_urls,
        0 as like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM checkins c
      JOIN users u ON u.id::text = c.user_id
      LEFT JOIN trips t ON t.id = c.trip_id
      LEFT JOIN places p ON p.id = c.place_id
      WHERE c.user_id = ANY(${followedIds as any}::text[])
        AND (${cursor}::timestamptz IS NULL OR c.created_at < ${cursor}::timestamptz)
      ORDER BY c.created_at DESC LIMIT ${fetchLimit}
    ` : db`
      SELECT c.id, 'checkin' as type, c.created_at,
        NULL::text as title, c.note as body, c.images as photo_urls,
        0 as like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        t.id as trip_id, t.title as trip_title, t.slug as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        NULL::numeric as rating
      FROM checkins c
      JOIN users u ON u.id::text = c.user_id
      LEFT JOIN trips t ON t.id = c.trip_id
      LEFT JOIN places p ON p.id = c.place_id
      WHERE (${cursor}::timestamptz IS NULL OR c.created_at < ${cursor}::timestamptz)
      ORDER BY c.created_at DESC LIMIT ${fetchLimit}
    `

    // ── Reviews ──
    const reviewsPromise = mode === 'mine' ? db`
      SELECT r.id, 'review' as type, r.created_at,
        r.title, r.body, r.photo_urls,
        r.like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        NULL::uuid as trip_id, NULL::text as trip_title, NULL::text as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        r.rating
      FROM reviews r
      JOIN users u ON u.id::text = r.user_id
      LEFT JOIN places p ON p.id = r.place_id
      WHERE r.user_id = ${me!}::text
        AND (${cursor}::timestamptz IS NULL OR r.created_at < ${cursor}::timestamptz)
      ORDER BY r.created_at DESC LIMIT ${fetchLimit}
    ` : mode === 'following' ? db`
      SELECT r.id, 'review' as type, r.created_at,
        r.title, r.body, r.photo_urls,
        r.like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        NULL::uuid as trip_id, NULL::text as trip_title, NULL::text as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        r.rating
      FROM reviews r
      JOIN users u ON u.id::text = r.user_id
      LEFT JOIN places p ON p.id = r.place_id
      WHERE r.user_id = ANY(${followedIds as any}::text[])
        AND (${cursor}::timestamptz IS NULL OR r.created_at < ${cursor}::timestamptz)
      ORDER BY r.created_at DESC LIMIT ${fetchLimit}
    ` : db`
      SELECT r.id, 'review' as type, r.created_at,
        r.title, r.body, r.photo_urls,
        r.like_count, 0 as comment_count,
        u.id as user_id, u.username, u.display_name, u.avatar_url, u.travel_status, u.current_location,
        NULL::uuid as trip_id, NULL::text as trip_title, NULL::text as trip_slug,
        p.id as place_id, p.name as place_name, p.city as place_city, p.country as place_country, p.slug as place_slug,
        r.rating
      FROM reviews r
      JOIN users u ON u.id::text = r.user_id
      LEFT JOIN places p ON p.id = r.place_id
      WHERE (${cursor}::timestamptz IS NULL OR r.created_at < ${cursor}::timestamptz)
      ORDER BY r.created_at DESC LIMIT ${fetchLimit}
    `

    const [journals, checkins, reviews] = await Promise.all([journalsPromise, checkinsPromise, reviewsPromise])

    // Merge, filter muted users, sort, paginate
    const mutedSet = new Set(muted)
    const all = [...(journals as any[]), ...(checkins as any[]), ...(reviews as any[])]
      .filter(e => !mutedSet.has(String((e as any).user_id)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const hasMore = all.length > limit
    const page = all.slice(0, limit)
    const nextCursor = page.length > 0 ? new Date(page[page.length - 1].created_at).toISOString() : null

    return NextResponse.json({
      entries: page.map(e => ({
        id: e.id,
        type: e.type,
        createdAt: e.created_at,
        title: e.title ?? null,
        body: e.body ?? null,
        photoUrls: e.photo_urls ?? [],
        rating: e.rating != null ? Number(e.rating) : null,
        likeCount: Number(e.like_count ?? 0),
        commentCount: Number(e.comment_count ?? 0),
        user: {
          id: e.user_id,
          username: e.username,
          displayName: e.display_name,
          avatarUrl: e.avatar_url ?? null,
          travelStatus: e.travel_status ?? 'home',
          currentLocation: e.current_location ?? null,
        },
        trip: e.trip_id ? { id: e.trip_id, title: e.trip_title, slug: e.trip_slug } : null,
        place: e.place_id ? { id: e.place_id, name: e.place_name, city: e.place_city, country: e.place_country, slug: e.place_slug } : null,
      })),
      nextCursor,
      hasMore,
    })
  } catch (e: any) {
    console.error('[feed]', e.message, e.detail)
    return serverError(e, 'feed', req)
  }
}