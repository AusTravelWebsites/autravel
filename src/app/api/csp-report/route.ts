import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

// CSP violation collector. Inserts or bumps a hit_count row per
// (directive, blocked_uri) so admin dashboards stay compact.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const r = body?.['csp-report'] || body || {};
    const directive = (r['violated-directive'] || r.violatedDirective || '').toString().split(' ')[0] || null;
    let blocked = (r['blocked-uri'] || r.blockedURI || '').toString() || null;
    // Strip query strings from http(s) URIs so dedup isn't defeated by cache-busters
    if (blocked && /^https?:\/\//i.test(blocked)) {
      try { const u = new URL(blocked); blocked = u.origin + u.pathname; } catch {}
    }
    const doc = (r['document-uri'] || r.documentURI || '').toString() || null;
    const source = (r['source-file'] || r.sourceFile || '').toString() || null;
    if (source && (source.startsWith('chrome-extension:') || source.startsWith('moz-extension:') || source.startsWith('safari-web-extension:'))) {
      return NextResponse.json({ ok: true, skipped: 'extension' });
    }
    if (blocked && (blocked.startsWith('chrome-extension:') || blocked.startsWith('moz-extension:') || blocked.startsWith('safari-web-extension:'))) {
      return NextResponse.json({ ok: true, skipped: 'extension' });
    }
    if (!directive && !blocked) return NextResponse.json({ ok: true, skipped: 'empty' });

    const ua = (req.headers.get('user-agent') || '').slice(0, 400);
    await sql`
      INSERT INTO csp_violations (directive, blocked_uri, document_uri, source_file, user_agent)
      VALUES (${directive}, ${blocked}, ${doc}, ${source}, ${ua})
      ON CONFLICT (directive, COALESCE(blocked_uri, ''))
      DO UPDATE SET last_seen = NOW(), hit_count = csp_violations.hit_count + 1,
                    document_uri = EXCLUDED.document_uri, user_agent = EXCLUDED.user_agent`;
  } catch (e) { console.warn('[csp-report]', e); }
  return NextResponse.json({ ok: true });
}
