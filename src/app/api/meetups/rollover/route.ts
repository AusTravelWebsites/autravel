import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

// Recurring meetup rollover.
// For each meetup whose meetup_date has passed and has recurrence set ('weekly' | 'monthly'),
// clone it for the next cycle IF the next-cycle instance doesn't already exist.
// Runs via cron (token) or admin POST.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const expected = process.env.AUTO_MEETUP_TOKEN; // reuse the existing cron token
  let authed = false;
  if (expected && token && token === expected) authed = true;
  if (!authed) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Housekeeping: mark past meetups (not cancelled) so they drop out of upcoming lists
  const marked = await sql`UPDATE meetups SET status = 'past' WHERE meetup_date < NOW() - INTERVAL '6 hours' AND COALESCE(status, 'open') IN ('open','full') RETURNING id`;

  const passed = await sql`
    SELECT id, host_id, title, description, location_name, meetup_date, max_attendees, is_public,
           place_id, lat, lng, cover_image, category, scope, women_only, host_approval_required, min_age, recurrence
    FROM meetups
    WHERE recurrence IN ('weekly','monthly')
      AND meetup_date < NOW()
      AND COALESCE(status, 'open') <> 'cancelled'
    ORDER BY meetup_date DESC`;

  const { notify } = await import('@/lib/notify');
  let cloned = 0, skipped = 0;

  for (const m of passed as any[]) {
    const nextDate = new Date(m.meetup_date);
    if (m.recurrence === 'weekly') nextDate.setUTCDate(nextDate.getUTCDate() + 7);
    else if (m.recurrence === 'monthly') nextDate.setUTCMonth(nextDate.getUTCMonth() + 1);
    if (nextDate.getTime() <= Date.now()) continue; // still in the past — skip (user fell behind)

    // Check if a clone already exists at that date + same host + same title
    const [dup] = await sql`
      SELECT id FROM meetups
      WHERE host_id = ${m.host_id} AND title = ${m.title}
        AND date_trunc('minute', meetup_date) = date_trunc('minute', ${nextDate.toISOString()}::timestamptz)
      LIMIT 1`;
    if (dup) { skipped++; continue; }

    const [created] = await sql`
      INSERT INTO meetups (host_id, title, description, location_name, meetup_date, max_attendees, is_public,
        place_id, lat, lng, cover_image, category, scope, women_only, host_approval_required, min_age,
        recurrence, parent_meetup_id, status)
      VALUES (${m.host_id}, ${m.title}, ${m.description}, ${m.location_name},
              ${nextDate.toISOString()}::timestamptz, ${m.max_attendees}, ${m.is_public},
              ${m.place_id}, ${m.lat}, ${m.lng}, ${m.cover_image}, ${m.category}, ${m.scope},
              ${m.women_only}, ${m.host_approval_required}, ${m.min_age},
              ${m.recurrence}, ${m.id}, 'open')
      RETURNING id`;
    // Host auto-attends
    await sql`INSERT INTO meetup_attendees (meetup_id, user_id, status) VALUES (${created.id}, ${m.host_id}, 'going') ON CONFLICT DO NOTHING`;
    cloned++;

    // Notify host so they can promote / re-invite
    notify({ recipientId: String(m.host_id), actorId: String(m.host_id), type: 'meetup_approved',
             link: `/meetups/${created.id}`,
             preview: `Your recurring meetup "${m.title}" has been scheduled for ${nextDate.toLocaleDateString()}.` }).catch(() => {});
  }

  return NextResponse.json({ ok: true, candidates: passed.length, cloned, skipped, marked_past: (marked as any[]).length });
}
