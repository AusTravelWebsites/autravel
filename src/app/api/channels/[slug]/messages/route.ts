import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { rateLimit, getIP } from '@/lib/admin';
import { moderateMessage, MAX_WORDS } from '@/lib/channel-moderation';
import { getMutedIds } from '@/lib/blocks';

async function getViewer(req: NextRequest) {
  const s = req.cookies.get('__session')?.value;
  if (!s) return null;
  try {
    const d = await getAdminAuth().verifySessionCookie(s, true);
    const [u] = await sql`SELECT id::text AS id, is_banned, created_at FROM users WHERE firebase_uid = ${d.uid} LIMIT 1`;
    if (!u || u.is_banned) return null;
    return u as { id: string; created_at: string };
  } catch { return null; }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const before = url.searchParams.get('before');
  const [ch] = await sql`SELECT id FROM channels WHERE slug = ${slug} LIMIT 1`;
  if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const viewer = await getViewer(req);
  const muted = viewer ? await getMutedIds(viewer.id) : [];

  const rows = before
    ? await sql`
        SELECT m.id, m.body, m.created_at, u.id::text AS user_id, u.username, u.display_name, u.avatar_url
        FROM channel_messages m
        JOIN users u ON u.id::text = m.user_id
        WHERE m.channel_id = ${ch.id} AND m.is_hidden = false AND m.created_at < ${before}::timestamptz
          AND (${muted.length === 0 ? true : false}::boolean = true OR u.id::text <> ALL(${muted as any}::text[]))
        ORDER BY m.created_at DESC LIMIT 50`
    : await sql`
        SELECT m.id, m.body, m.created_at, u.id::text AS user_id, u.username, u.display_name, u.avatar_url
        FROM channel_messages m
        JOIN users u ON u.id::text = m.user_id
        WHERE m.channel_id = ${ch.id} AND m.is_hidden = false
          AND (${muted.length === 0 ? true : false}::boolean = true OR u.id::text <> ALL(${muted as any}::text[]))
        ORDER BY m.created_at DESC LIMIT 50`;
  return NextResponse.json({ messages: rows.reverse() });
}

const COOLDOWN_SEC = 3;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const viewer = await getViewer(req);
  if (!viewer) return NextResponse.json({ error: 'Please log in' }, { status: 401 });
  const ip = getIP(req) || 'unknown';
  const ua = req.headers.get('user-agent') || '';

  // Bot guards:
  // 1. UA must look like a real browser (reject curl/wget/bot/crawl)
  if (/^(?:python|curl|wget|go-http|java|ruby|node-fetch|axios|postman|bot|crawl|spider|scan)/i.test(ua) || ua.length < 20) {
    return NextResponse.json({ error: 'Automated clients are blocked' }, { status: 403 });
  }

  // 2. IP ban check
  const [ipBan] = await sql`SELECT 1 FROM channel_bans WHERE ip = ${ip} AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`;
  if (ipBan) return NextResponse.json({ error: 'Your IP has been blocked from channels' }, { status: 403 });
  const [ipAdminBan] = await sql`SELECT 1 FROM blocklist WHERE kind = 'ip' AND value = ${ip} LIMIT 1`;
  if (ipAdminBan) return NextResponse.json({ error: 'IP blocked' }, { status: 403 });

  // 3. User ban check
  const [userBan] = await sql`SELECT 1 FROM channel_bans WHERE user_id = ${viewer.id} AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`;
  if (userBan) return NextResponse.json({ error: 'You are muted in channels' }, { status: 403 });

  // 4. Account-age gate (bots usually post minutes after signup) — require ≥ 10 min
  const ageMs = Date.now() - new Date(viewer.created_at).getTime();
  if (ageMs < 10 * 60 * 1000) {
    return NextResponse.json({ error: 'New accounts can chat after 10 minutes — welcome!' }, { status: 403 });
  }

  // 5. Cooldown (one post per 3s per user, plus 30/hour per IP and 200/day per user)
  const [last] = await sql`SELECT created_at FROM channel_messages WHERE user_id = ${viewer.id} ORDER BY created_at DESC LIMIT 1`;
  if (last && Date.now() - new Date(last.created_at).getTime() < COOLDOWN_SEC * 1000) {
    return NextResponse.json({ error: `Slow down — wait ${COOLDOWN_SEC}s between messages` }, { status: 429 });
  }
  if (!(await rateLimit(`chmsg-ip:${ip}`, 30, 3600))) {
    return NextResponse.json({ error: 'Too many messages from your network' }, { status: 429 });
  }
  if (!(await rateLimit(`chmsg-user:${viewer.id}`, 200, 86400))) {
    return NextResponse.json({ error: 'Daily message limit reached' }, { status: 429 });
  }

  const { slug } = await ctx.params;
  const [ch] = await sql`SELECT id, is_locked FROM channels WHERE slug = ${slug} LIMIT 1`;
  if (!ch) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  if (ch.is_locked) return NextResponse.json({ error: 'Channel is locked' }, { status: 403 });

  const body = await req.json().catch(() => ({} as any));
  const text = typeof body?.body === 'string' ? body.body : '';
  const mod = moderateMessage(text);
  if (!mod.ok && !mod.hidden) {
    return NextResponse.json({ error: mod.reason || 'Message not allowed' }, { status: 400 });
  }

  // Insert (hidden-if-profanity, else visible)
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const [msg] = await sql`
    INSERT INTO channel_messages (channel_id, user_id, body, word_count, ip, user_agent, is_hidden, hidden_reason, moderation_flags)
    VALUES (${ch.id}, ${viewer.id}, ${text.trim()}, ${wordCount}, ${ip}, ${ua.slice(0, 400)},
            ${mod.hidden}, ${mod.hidden ? (mod.reason || null) : null},
            ${mod.flag ? sql.json({ flag: mod.flag }) : null})
    RETURNING id, body, created_at`;

  if (mod.hidden) {
    // Record strike and escalate
    await sql`INSERT INTO channel_strikes (user_id, ip, reason) VALUES (${viewer.id}, ${ip}, ${mod.flag || 'profanity'})`;
    const [{ cnt }] = await sql`SELECT COUNT(*)::int AS cnt FROM channel_strikes WHERE user_id = ${viewer.id} AND created_at > NOW() - INTERVAL '24 hours'`;
    if (cnt >= 10) {
      // Long ban
      await sql`INSERT INTO channel_bans (user_id, ip, reason, expires_at) VALUES (${viewer.id}, ${ip}, ${'auto: 10+ strikes/24h'}, NOW() + INTERVAL '7 days')`;
    } else if (cnt >= 3) {
      await sql`INSERT INTO channel_bans (user_id, ip, reason, expires_at) VALUES (${viewer.id}, ${ip}, ${'auto: 3+ strikes/24h'}, NOW() + INTERVAL '1 hour')`;
    }
    return NextResponse.json({ error: mod.reason || 'Message blocked', blocked: true }, { status: 422 });
  }

  // Update channel counters (denormalised)
  await sql`UPDATE channels SET message_count = message_count + 1, last_activity_at = NOW() WHERE id = ${ch.id}`;
  // Auto-join channel on first message
  await sql`INSERT INTO channel_members (channel_id, user_id) VALUES (${ch.id}, ${viewer.id}) ON CONFLICT DO NOTHING`;

  // Return with user profile
  const [u] = await sql`SELECT username, display_name, avatar_url FROM users WHERE id::text = ${viewer.id} LIMIT 1`;
  return NextResponse.json({
    message: {
      id: msg.id, body: msg.body, created_at: msg.created_at,
      user_id: viewer.id,
      username: u?.username, display_name: u?.display_name, avatar_url: u?.avatar_url,
    },
  });
}
