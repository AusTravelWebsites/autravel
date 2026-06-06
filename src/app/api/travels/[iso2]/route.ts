import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import { COUNTRIES, flagFor } from '@/lib/countries'

async function getViewer(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const [u] = await db`SELECT id::text, username FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return u || null
  } catch { return null }
}

function normaliseIso2(raw: string) {
  return (raw || '').toUpperCase().slice(0, 2)
}

async function resolveTarget(req: NextRequest, viewer: { id: string; username: string } | null) {
  const username = new URL(req.url).searchParams.get('username')
  if (username) {
    const [row] = await db`SELECT id::text, username FROM users WHERE username = ${username} LIMIT 1`
    return row || null
  }
  return viewer
}

// GET /api/travels/[iso2]?username=foo — photos + journal entries for this country.
export async function GET(req: NextRequest, { params }: { params: Promise<{ iso2: string }> }) {
  const viewer = await getViewer(req)
  const target = await resolveTarget(req, viewer)
  if (!target) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isOwner = viewer?.id === target.id
  const iso2 = normaliseIso2((await params).iso2)
  if (!COUNTRIES[iso2]) return NextResponse.json({ error: 'Unknown country' }, { status: 400 })

  try {
    // Only return public data when viewer isn't the owner.
    const [vis] = await db`
      SELECT is_public FROM country_visibility
      WHERE user_id = ${target.id} AND country_code = ${iso2} LIMIT 1`

    if (!isOwner) {
      const isPublic = vis?.is_public ?? true // default to public if unset — owner can opt out explicitly
      if (!isPublic) return NextResponse.json({ error: 'Private' }, { status: 403 })
    }

    const entries = await db`
      SELECT je.id::text, je.body, je.location_name, je.media_urls,
             COALESCE(je.posted_at, je.created_at) AS posted_at,
             p.slug AS place_slug, p.name AS place_name, p.city AS place_city
      FROM journal_entries je
      JOIN places p ON p.id = je.place_id
      WHERE je.user_id = ${target.id}
        AND UPPER(p.country_code) = ${iso2}
        AND (${isOwner}::boolean OR je.is_public = true)
      ORDER BY COALESCE(je.posted_at, je.created_at) DESC
      LIMIT 50`

    const locations = await db`
      SELECT id::text, place_name, category, notes, photos, lat, lng, is_public,
             COALESCE(updated_at, created_at) AS updated_at
      FROM user_locations
      WHERE user_id = ${target.id}
        AND UPPER(country_code) = ${iso2}
        AND (${isOwner}::boolean OR is_public = true)
      ORDER BY COALESCE(updated_at, created_at) DESC`

    // Flatten photos across sources for a country gallery.
    const photos: { url: string; source: 'journal' | 'location'; id: string; postedAt: string | null }[] = []
    for (const e of entries as any[]) {
      for (const u of (e.media_urls || [])) photos.push({ url: u, source: 'journal', id: e.id, postedAt: e.posted_at })
    }
    for (const l of locations as any[]) {
      for (const u of (l.photos || [])) photos.push({ url: u, source: 'location', id: l.id, postedAt: l.updated_at })
    }

    return NextResponse.json({
      country: {
        iso2, name: COUNTRIES[iso2].name, flag: flagFor(iso2),
        isPublic: vis?.is_public ?? true,
        isOwner,
      },
      entries,
      locations,
      photos,
    })
  } catch (e: any) {
    console.error('[GET /api/travels/iso2]', e)
    return serverError(e, 'travels/[iso2]', req)
  }
}

// PATCH /api/travels/[iso2]  body: { is_public: boolean }  — owner only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ iso2: string }> }) {
  const viewer = await getViewer(req)
  if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const iso2 = normaliseIso2((await params).iso2)
  if (!COUNTRIES[iso2]) return NextResponse.json({ error: 'Unknown country' }, { status: 400 })

  const body = await req.json().catch(() => ({} as any))
  if (typeof body.is_public !== 'boolean') {
    return NextResponse.json({ error: 'is_public (boolean) required' }, { status: 400 })
  }

  try {
    await db`
      INSERT INTO country_visibility (user_id, country_code, is_public, updated_at)
      VALUES (${viewer.id}, ${iso2}, ${body.is_public}, NOW())
      ON CONFLICT (user_id, country_code)
      DO UPDATE SET is_public = EXCLUDED.is_public, updated_at = NOW()`
    return NextResponse.json({ iso2, is_public: body.is_public })
  } catch (e: any) {
    console.error('[PATCH /api/travels/iso2]', e)
    return serverError(e, 'travels/[iso2]', req)
  }
}
