import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    return u || null;
  } catch { return null; }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ meetupId: string }> }) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ stars: null });
  const { meetupId } = await ctx.params;
  const [r] = await sql`
    SELECT stars, comment, created_at FROM user_ratings
    WHERE rater_id = ${viewer.id} AND context = 'meetup' AND context_id = ${meetupId} LIMIT 1`;
  return NextResponse.json({ stars: r?.stars ?? null, comment: r?.comment ?? null });
}
