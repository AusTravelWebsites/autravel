import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin, logAction, getIP } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const status = new URL(req.url).searchParams.get('status') || 'pending';
  const rows = await db`
    SELECT r.id::text, r.target_type, r.target_id, r.reason, r.notes, r.status, r.created_at,
           u.username AS reporter_username, u.display_name AS reporter_name
    FROM content_reports r
    LEFT JOIN users u ON u.id::text = r.reporter_id
    WHERE r.status = ${status}
    ORDER BY r.created_at DESC LIMIT 200`;
  return NextResponse.json({ items: rows });
}

// POST { id, action: 'dismiss'|'delete_content' } — resolve a report
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, action } = await req.json().catch(() => ({} as any));
  if (!id || !action) return NextResponse.json({ error: 'id + action required' }, { status: 400 });

  const [report] = await db`SELECT target_type, target_id FROM content_reports WHERE id = ${id} LIMIT 1`;
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'delete_content') {
    const t = report.target_type;
    const tid = report.target_id;
    try {
      if (t === 'post') await db`DELETE FROM journal_entries WHERE id = ${tid}`;
      else if (t === 'review') await db`DELETE FROM reviews WHERE id = ${tid}`;
      else if (t === 'trip') await db`DELETE FROM trips WHERE id = ${tid}`;
      await logAction(admin, `delete_${t}_via_report`, { targetType: t, targetId: tid, ip: getIP(req) });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  const newStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
  await db`UPDATE content_reports SET status = ${newStatus}, resolved_by = ${admin.id}::text, resolved_at = NOW() WHERE id = ${id}`;
  await logAction(admin, `report_${newStatus}`, { targetType: 'report', targetId: id, ip: getIP(req) });
  return NextResponse.json({ ok: true });
}
