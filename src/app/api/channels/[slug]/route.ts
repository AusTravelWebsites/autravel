import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const [ch] = await sql`
    SELECT id, slug, city_name, country, description, member_count, message_count, last_activity_at, created_at
    FROM channels WHERE slug = ${slug} LIMIT 1`;
  if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ channel: ch });
}
