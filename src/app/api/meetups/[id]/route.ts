import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { canViewMeetup, getViewerWithVerify } from '@/lib/meetup-access';

async function getViewerId(req: NextRequest): Promise<string | null> {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id FROM public.users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u?.id || null;
  } catch { return null; }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [m] = await sql`
    SELECT m.*, u.username AS host_username, u.display_name AS host_display_name,
           u.avatar_url AS host_avatar_url, u.bb_rating AS host_rating, u.bb_rating_count AS host_rating_count,
           u.verification_status AS host_verified
    FROM meetups m JOIN public.users u ON u.id::text = m.host_id
    WHERE m.id = ${id} LIMIT 1`;
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const viewerId = await getViewerId(req);
  const viewer = viewerId ? await getViewerWithVerify(viewerId) : null;
  const viewable = await canViewMeetup(m as any, viewer);
  if (!viewable) return NextResponse.json({ error: 'Not visible' }, { status: 403 });

  const attendees = await sql`
    SELECT ma.user_id, ma.status, ma.status_extended, ma.approved_at,
           u.username, u.display_name, u.avatar_url, u.bb_rating, u.verification_status
    FROM meetup_attendees ma JOIN public.users u ON u.id::text = ma.user_id
    WHERE ma.meetup_id = ${id}
    ORDER BY ma.created_at ASC`;
  const mine = viewerId ? attendees.find((a: any) => a.user_id === viewerId) || null : null;
  return NextResponse.json({ meetup: m, attendees, is_host: viewerId === m.host_id, mine });
}
