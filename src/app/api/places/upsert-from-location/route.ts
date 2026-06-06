import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { upsertPlaceFromLocation } from '@/lib/google-places';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const loc = typeof body?.location === 'string' ? body.location.trim() : '';
  if (!loc || loc.length < 2) return NextResponse.json({ error: 'location required' }, { status: 400 });
  const p = await upsertPlaceFromLocation(loc, sql);
  if (!p) return NextResponse.json({ error: 'Place not found' }, { status: 404 });
  return NextResponse.json({ place: p });
}
