import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await sql`
    SELECT id, directive, blocked_uri, document_uri, source_file, first_seen, last_seen, hit_count
    FROM csp_violations
    ORDER BY last_seen DESC LIMIT 200`;
  return NextResponse.json({ violations: rows });
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    await sql`DELETE FROM csp_violations WHERE id = ${id}`;
  } else {
    await sql`DELETE FROM csp_violations`;
  }
  return NextResponse.json({ ok: true });
}
