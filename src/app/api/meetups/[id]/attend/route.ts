import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import sql from '@/lib/db'
import { canRsvpMeetup, getViewerWithVerify } from '@/lib/meetup-access'
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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await rateLimit(`rsvp:${user.id}`, 30, 60))) {
    return NextResponse.json({ error: 'RSVP limit: 30/min.' }, { status: 429 })
  }
  const body = await req.json().catch(() => ({}))
  const incoming = (body as any).status
  const rsvp = ['going', 'maybe', 'not_going'].includes(incoming) ? incoming : 'going'
  try {
    const [m] = await sql`SELECT id, max_attendees, host_id, scope, women_only, host_approval_required, min_age, status FROM meetups WHERE id = ${id} LIMIT 1`
    if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    let finalStatus: string = rsvp
    let extended: string | null = null
    let waitlisted = false, requested = false

    if (rsvp === 'going' && m.host_id !== user.id) {
      const viewer = await getViewerWithVerify(user.id)
      const allowed = await canRsvpMeetup(m as any, viewer)
      if (!allowed.ok) return NextResponse.json({ error: allowed.reason || 'Not allowed' }, { status: 403 })

      // Host approval required → mark as requested, don't count as going yet
      if (m.host_approval_required) {
        finalStatus = 'pending'; extended = 'requested'; requested = true
      } else {
        const [{ c }] = await sql`SELECT COUNT(*)::int AS c FROM meetup_attendees WHERE meetup_id = ${id} AND status = 'going' AND user_id <> ${user.id}`
        if (m.max_attendees != null && c >= m.max_attendees) {
          // Full → add to waitlist
          finalStatus = 'pending'; extended = 'waitlist'; waitlisted = true
        }
      }
    }

    await sql`
      INSERT INTO meetup_attendees (meetup_id, user_id, status, status_extended)
      VALUES (${id}, ${user.id}, ${finalStatus}, ${extended})
      ON CONFLICT (meetup_id, user_id) DO UPDATE SET status = EXCLUDED.status, status_extended = EXCLUDED.status_extended`

    // Notify host for new join requests
    if (requested && m.host_id !== user.id) {
      try {
        const { notify } = await import('@/lib/notify')
        notify({ recipientId: String(m.host_id), actorId: String(user.id), type: 'meetup_join_request', link: `/meetups/${id}`, preview: 'Wants to join your meetup' }).catch(() => {})
      } catch {}
    }

    const [{ c: count }] = await sql`SELECT COUNT(*)::int AS c FROM meetup_attendees WHERE meetup_id = ${id} AND status = 'going'`
    return NextResponse.json({ ok: true, status: finalStatus, status_extended: extended, waitlisted, requested, attendee_count: count })
  } catch (e: any) {
    console.error('[meetup attend POST]', e)
    return serverError(e, 'meetups/[id]/attend', req)
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    // Record whether leaving user was 'going' — if so, promote oldest waitlist entry
    const [leaving] = await sql`SELECT status, status_extended FROM meetup_attendees WHERE meetup_id = ${id} AND user_id = ${user.id} LIMIT 1`
    await sql`DELETE FROM meetup_attendees WHERE meetup_id = ${id} AND user_id = ${user.id}`

    // Auto-promote first waitlist entry if someone left a going-slot
    if (leaving?.status === 'going') {
      const [next] = await sql`
        SELECT user_id FROM meetup_attendees
        WHERE meetup_id = ${id} AND status_extended = 'waitlist'
        ORDER BY created_at ASC LIMIT 1`
      if (next) {
        await sql`UPDATE meetup_attendees SET status = 'going', status_extended = NULL WHERE meetup_id = ${id} AND user_id = ${next.user_id}`
        try {
          const { notify } = await import('@/lib/notify')
          notify({ recipientId: String(next.user_id), actorId: String(user.id), type: 'meetup_approved', link: `/meetups/${id}`, preview: "A spot opened up — you're in!" }).catch(() => {})
        } catch {}
      }
    }

    const [{ c: count }] = await sql`SELECT COUNT(*)::int AS c FROM meetup_attendees WHERE meetup_id = ${id} AND status = 'going'`
    return NextResponse.json({ ok: true, attendee_count: count })
  } catch (e: any) {
    console.error('[meetup attend DELETE]', e)
    return serverError(e, 'meetups/[id]/attend', req)
  }
}
