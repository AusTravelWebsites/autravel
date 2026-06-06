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

// GET /api/travels?username=foo
// - If username omitted: returns the viewer's own travels (auth required).
// - If username given: public travels only, unless viewer === target (then all).
export async function GET(req: NextRequest) {
  const viewer = await getViewer(req)
  const username = new URL(req.url).searchParams.get('username')

  let target: { id: string; username: string } | null = null
  if (username) {
    const [row] = await db`SELECT id::text, username FROM users WHERE username = ${username} LIMIT 1`
    if (!row) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    target = row
  } else {
    if (!viewer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    target = { id: viewer.id, username: viewer.username }
  }

  const isOwner = viewer?.id === target.id

  try {
    // Aggregate from user_locations + journal_entries → places.
    // Only surface countries where we have an ISO2 code (so the globe can render them).
    const rows = await db`
      WITH loc AS (
        SELECT UPPER(country_code) AS iso2,
               MAX(country_name) AS country_name,
               SUM(COALESCE(array_length(photos, 1), 0))::int AS photos,
               COUNT(*)::int AS places,
               MAX(COALESCE(updated_at, created_at)) AS last_activity,
               BOOL_OR(is_public) AS any_public
        FROM user_locations
        WHERE user_id = ${target.id}
          AND country_code IS NOT NULL AND country_code <> ''
        GROUP BY UPPER(country_code)
      ),
      jrnl AS (
        SELECT UPPER(p.country_code) AS iso2,
               MAX(p.country) AS country_name,
               SUM(COALESCE(array_length(je.media_urls, 1), 0))::int AS photos,
               COUNT(je.id)::int AS entries,
               MAX(COALESCE(je.posted_at, je.created_at)) AS last_activity,
               BOOL_OR(je.is_public) AS any_public
        FROM journal_entries je
        JOIN places p ON p.id = je.place_id
        WHERE je.user_id = ${target.id}
          AND p.country_code IS NOT NULL AND p.country_code <> ''
        GROUP BY UPPER(p.country_code)
      ),
      combined AS (
        SELECT COALESCE(l.iso2, j.iso2) AS iso2,
               COALESCE(l.country_name, j.country_name) AS country_name,
               (COALESCE(l.photos, 0) + COALESCE(j.photos, 0))::int AS photos,
               COALESCE(l.places, 0)::int AS places,
               COALESCE(j.entries, 0)::int AS entries,
               GREATEST(l.last_activity, j.last_activity) AS last_activity,
               (COALESCE(l.any_public, false) OR COALESCE(j.any_public, false)) AS has_any_public
        FROM loc l
        FULL OUTER JOIN jrnl j ON l.iso2 = j.iso2
        WHERE COALESCE(l.iso2, j.iso2) IS NOT NULL
      )
      SELECT c.iso2, c.country_name, c.photos, c.places, c.entries, c.last_activity, c.has_any_public,
             COALESCE(cv.is_public, c.has_any_public) AS is_public,
             (
               SELECT je.media_urls[1]
               FROM journal_entries je
               JOIN places p ON p.id = je.place_id
               WHERE je.user_id = ${target.id}
                 AND UPPER(p.country_code) = c.iso2
                 AND je.media_urls IS NOT NULL AND array_length(je.media_urls, 1) > 0
               ORDER BY COALESCE(je.posted_at, je.created_at) DESC
               LIMIT 1
             ) AS cover_photo
      FROM combined c
      LEFT JOIN country_visibility cv
        ON cv.user_id = ${target.id} AND cv.country_code = c.iso2
      ORDER BY c.last_activity DESC NULLS LAST, c.country_name ASC`

    const countries = (rows as any[])
      .filter(r => isOwner || r.is_public)
      .map(r => {
        const meta = COUNTRIES[r.iso2]
        return {
          iso2: r.iso2,
          name: meta?.name || r.country_name || r.iso2,
          flag: flagFor(r.iso2),
          numericId: meta?.numericId || null,
          photos: r.photos || 0,
          entries: r.entries || 0,
          places: r.places || 0,
          lastActivity: r.last_activity,
          isPublic: !!r.is_public,
          coverPhoto: r.cover_photo || null,
        }
      })

    return NextResponse.json({
      user: { username: target.username },
      isOwner,
      countries,
    })
  } catch (e: any) {
    console.error('[GET /api/travels]', e)
    return serverError(e, 'travels', req)
  }
}
