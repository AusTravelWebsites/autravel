import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import sql from '@/lib/db'
import { stripExternalLinks } from '@/lib/sanitize'
import { getMutedIds } from '@/lib/blocks'
import { rateLimit } from '@/lib/admin'

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const [u] = await sql`SELECT id FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return u || null
  } catch { return null }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const filter = url.searchParams.get('filter') || 'upcoming'
  const category = url.searchParams.get('category') || ''
  const verifiedOnly = url.searchParams.get('verified') === '1'
  const scopeFilter = url.searchParams.get('scope') || ''
  const user = await getUser(req)
  const muted = user ? await getMutedIds(user.id) : []
  try {
    let rows
    if (filter === 'mine') {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      rows = await sql`
        SELECT m.*,
          u.username        AS host_username,
          u.display_name    AS host_display_name,
          u.avatar_url      AS host_avatar_url,
          (m.host_id = ${user.id}) AS is_host,
          (SELECT COUNT(*)::int FROM meetup_attendees WHERE meetup_id = m.id AND status = 'going') AS attendee_count,
          EXISTS (SELECT 1 FROM meetup_attendees WHERE meetup_id = m.id AND user_id = ${user.id} AND status = 'going') AS is_attending
        FROM meetups m
        JOIN public.users u ON u.id::text = m.host_id
        WHERE m.host_id = ${user.id}
           OR EXISTS (SELECT 1 FROM meetup_attendees WHERE meetup_id = m.id AND user_id = ${user.id})
        ORDER BY m.meetup_date ASC LIMIT 50`
    } else {
      const catLike = category ? category : null
      const scopeLike = scopeFilter ? scopeFilter : null
      rows = await sql`
        SELECT m.*,
          u.username        AS host_username,
          u.display_name    AS host_display_name,
          u.avatar_url      AS host_avatar_url,
          u.verification_status AS host_verified,
          u.bb_rating       AS host_rating,
          u.bb_rating_count AS host_rating_count,
          (SELECT COUNT(*)::int FROM meetup_attendees WHERE meetup_id = m.id AND status = 'going') AS attendee_count,
          EXISTS (SELECT 1 FROM meetup_attendees WHERE meetup_id = m.id AND user_id = ${user?.id ?? '__none__'} AND status = 'going') AS is_attending
        FROM meetups m
        JOIN public.users u ON u.id::text = m.host_id
        WHERE m.meetup_date > NOW() - INTERVAL '2 hours'
          AND COALESCE(m.is_public, true) = true
          AND (${catLike}::text IS NULL OR m.category = ${catLike}::text)
          AND (${scopeLike}::text IS NULL OR m.scope = ${scopeLike}::text)
          AND (${verifiedOnly ? true : false}::boolean = false OR u.verification_status = 'verified')
          AND COALESCE(m.status, 'open') <> 'cancelled'
          AND (${muted.length === 0 ? true : false}::boolean = true OR m.host_id <> ALL(${muted as any}::text[]))
        ORDER BY m.meetup_date ASC LIMIT 50`
    }
    return NextResponse.json({ meetups: rows })
  } catch (e: any) {
    console.error('[meetups GET]', e)
    return serverError(e, 'meetups', req)
  }
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await rateLimit(`meetup-create:${user.id}`, 10, 3600))) {
    return NextResponse.json({ error: 'Meetup creation limit: 10/hour.' }, { status: 429 })
  }
  const body = await req.json().catch(() => ({} as any))
  const { meetup_date, max_attendees, is_public, place_id, lat, lng,
          cover_image, category, women_only, host_approval_required, min_age, recurrence } = body
  const title = stripExternalLinks(body.title)
  const description = stripExternalLinks(body.description)
  const location_name = stripExternalLinks(body.location_name)
  const validScopes = ['public','verified_only','friends_only','friends_of_friends']
  const scope = validScopes.includes(body.scope) ? body.scope : 'friends_of_friends'
  if (!title?.trim() || !meetup_date) {
    return NextResponse.json({ error: 'title and meetup_date required' }, { status: 400 })
  }
  // Stranger-accessible meetups require host to be verified
  if ((scope === 'public' || scope === 'verified_only')) {
    const [hv] = await sql`SELECT verification_status FROM public.users WHERE id::text = ${user.id} LIMIT 1`
    if (hv?.verification_status !== 'verified') {
      return NextResponse.json({ error: 'Verify your profile to host open meetups' }, { status: 403 })
    }
  }
  try {
    const [meetup] = await sql`
      INSERT INTO meetups (host_id, title, description, location_name, meetup_date, max_attendees, is_public,
        place_id, lat, lng, cover_image, category, scope, women_only, host_approval_required, min_age, recurrence)
      VALUES (${user.id}, ${title.trim()}, ${description ?? null}, ${location_name ?? null},
              ${meetup_date}::timestamptz, ${max_attendees ?? 20}, ${is_public ?? true},
              ${place_id ?? null}, ${lat ?? null}, ${lng ?? null},
              ${cover_image ?? null}, ${category ?? null}, ${scope},
              ${!!women_only}, ${!!host_approval_required}, ${min_age ?? null}, ${recurrence ?? null})
      RETURNING *`
    await sql`
      INSERT INTO meetup_attendees (meetup_id, user_id, status)
      VALUES (${meetup.id}, ${user.id}, 'going')
      ON CONFLICT (meetup_id, user_id) DO NOTHING`
    return NextResponse.json({ meetup })
  } catch (e: any) {
    console.error('[meetups POST]', e)
    return serverError(e, 'meetups', req)
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({} as any))
  const { id, meetup_date, max_attendees, is_public, cover_image, category, women_only, host_approval_required, min_age, scope } = body
  const title = stripExternalLinks(body.title)
  const description = stripExternalLinks(body.description)
  const location_name = stripExternalLinks(body.location_name)
  const validScopes = ['public','verified_only','friends_only','friends_of_friends']
  const safeScope = body.scope && validScopes.includes(body.scope) ? body.scope : null
  const validStatuses = ['open','full','cancelled','past']
  const status = body.status && validStatuses.includes(body.status) ? body.status : null
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const [m] = await sql`SELECT host_id FROM meetups WHERE id = ${id} LIMIT 1`
    if (!m || m.host_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const [updated] = await sql`
      UPDATE meetups SET
        title                   = COALESCE(${title         ?? null}, title),
        description             = COALESCE(${description   ?? null}, description),
        location_name           = COALESCE(${location_name ?? null}, location_name),
        meetup_date             = COALESCE(${meetup_date ?? null}::timestamptz, meetup_date),
        max_attendees           = COALESCE(${max_attendees ?? null}, max_attendees),
        is_public               = COALESCE(${is_public     ?? null}, is_public),
        cover_image             = COALESCE(${cover_image ?? null}, cover_image),
        category                = COALESCE(${category ?? null}, category),
        scope                   = COALESCE(${safeScope ?? null}, scope),
        women_only              = COALESCE(${women_only ?? null}, women_only),
        host_approval_required  = COALESCE(${host_approval_required ?? null}, host_approval_required),
        min_age                 = COALESCE(${min_age ?? null}, min_age),
        status                  = COALESCE(${status ?? null}, status),
        updated_at              = NOW()
      WHERE id = ${id} RETURNING *`

    // If host cancelled, notify going attendees
    if (status === 'cancelled') {
      try {
        const { notify } = await import('@/lib/notify')
        const attendees = await sql`SELECT user_id FROM meetup_attendees WHERE meetup_id = ${id} AND status = 'going' AND user_id <> ${user.id}`
        for (const a of attendees as any[]) {
          notify({ recipientId: String(a.user_id), actorId: String(user.id), type: 'meetup_approved', link: `/meetups/${id}`, preview: `Meetup "${updated.title}" was cancelled by the host.` }).catch(() => {})
        }
      } catch {}
    }
    return NextResponse.json({ meetup: updated })
  } catch (e: any) {
    console.error('[meetups PATCH]', e)
    return serverError(e, 'meetups', req)
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const [m] = await sql`SELECT host_id FROM meetups WHERE id = ${id} LIMIT 1`
  if (!m || m.host_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await sql`DELETE FROM meetups WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
