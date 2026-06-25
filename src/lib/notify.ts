// Server-side notification helper.
//   - Inserts the in-app notification row
//   - Fires a fire-and-forget email via Resend if the recipient has opted in
import { db } from '@/lib/db';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const SITE = 'https://bugbitten.com';
const LOGO = 'https://media.bugbitten.com/brand/logo.webp?v=2';
const FROM = 'BugBitten <noreply@bugbitten.com>';

export type NotifyType =
  | 'like' | 'comment' | 'follow' | 'tag_trip' | 'tag_review' | 'new_message'
  | 'meetup_invite' | 'meetup_join_request' | 'meetup_approved' | 'meetup_comment' | 'meetup_rated'
  | 'blog_comment'
  | 'auto_meetup';

interface NotifyArgs {
  recipientId: string; // user_id receiving the notification (not actor)
  actorId: string;     // user_id who did the thing
  type: NotifyType;
  entryId?: string | null;
  // Optional context for email body
  link?: string;       // e.g. /journal-entries/abc
  preview?: string;    // body preview (comment text, etc.)
}

const SUBJECTS: Record<NotifyType, (a: { name: string; preview?: string }) => string> = {
  like:                ({ name }) => `${name} liked your post`,
  comment:             ({ name }) => `${name} commented on your post`,
  follow:              ({ name }) => `${name} started following you`,
  tag_trip:            ({ name }) => `${name} tagged you in a trip`,
  tag_review:          ({ name }) => `${name} tagged you in a review`,
  new_message:         ({ name }) => `New message from ${name}`,
  meetup_invite:       ({ name }) => `${name} invited you to a meetup`,
  meetup_join_request: ({ name }) => `${name} wants to join your meetup`,
  meetup_approved:     ({ name }) => `Meetup update from ${name}`,
  meetup_comment:      ({ name }) => `${name} commented on your meetup`,
  meetup_rated:        ({ name }) => `${name} rated your meetup`,
  blog_comment:        ({ name }) => `${name} commented on your blog post`,
  auto_meetup:         ()         => `Travellers near you on BugBitten`,
};

const HEADLINES: Record<NotifyType, (name: string) => string> = {
  like:                n => `${n} liked your post on BugBitten`,
  comment:             n => `${n} commented on your post`,
  follow:              n => `${n} started following you`,
  tag_trip:            n => `${n} tagged you in a trip`,
  tag_review:          n => `${n} tagged you in a review`,
  new_message:         n => `${n} sent you a message`,
  meetup_invite:       n => `${n} invited you to a meetup`,
  meetup_join_request: n => `${n} wants to join your meetup`,
  meetup_approved:     n => `${n} sent a meetup update`,
  meetup_comment:      n => `${n} commented on your meetup`,
  meetup_rated:        n => `${n} rated your meetup`,
  blog_comment:        n => `${n} commented on your blog post`,
  auto_meetup:         () => `There are travellers near you on BugBitten`,
};

const CTA_LABELS: Record<NotifyType, string> = {
  like: 'View your post',
  comment: 'Read the comment',
  follow: 'View their profile',
  tag_trip: 'Open the trip',
  tag_review: 'Read the review',
  new_message: 'Open the conversation',
  meetup_invite: 'View the meetup',
  meetup_join_request: 'Review the request',
  meetup_approved: 'Open the meetup',
  meetup_comment: 'Read the comment',
  meetup_rated: 'View your rating',
  blog_comment: 'Read the comment',
  auto_meetup: 'See who\'s nearby',
};

function escHtml(s: string) {
  return (s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c]!));
}

export async function notify({ recipientId, actorId, type, entryId, link, preview }: NotifyArgs) {
  if (recipientId === actorId) return; // never notify yourself

  // 1. Insert in-app notification (always — independent of email pref)
  try {
    await db`INSERT INTO notifications (user_id, type, actor_id, entry_id) VALUES (${recipientId}, ${type}, ${actorId}, ${entryId ?? null})`;
  } catch (e) { console.error('[notify insert]', e); return; }

  // 2. Resolve recipient + actor + email pref. Don't email if any of these fail.
  if (!resend) return;
  try {
    const [recipient] = await db`
      SELECT id::text, email, display_name, username, email_notifications, unsubscribe_token
      FROM users WHERE id::text = ${recipientId} LIMIT 1`;
    if (!recipient?.email) return;
    const prefs = (recipient.email_notifications || {}) as Record<string, boolean>;
    if (prefs[type] === false) return; // user opted out

    const [actor] = await db`SELECT username, display_name, avatar_url FROM users WHERE id::text = ${actorId} LIMIT 1`;
    if (!actor) return;
    const name = (actor.display_name || actor.username || 'Someone') as string;

    const url = link ? (link.startsWith('http') ? link : SITE + link) : SITE;
    const unsubUrl = recipient.unsubscribe_token
      ? `${SITE}/unsubscribe?token=${recipient.unsubscribe_token}&type=${type}`
      : `${SITE}/settings`;

    const subject = SUBJECTS[type]({ name });
    const html = renderEmail({
      headline: HEADLINES[type](escHtml(name)),
      previewText: preview,
      ctaLabel: CTA_LABELS[type],
      ctaUrl: url,
      unsubUrl,
      type,
      recipientName: (recipient.display_name || recipient.username || '') as string,
    });

    // Fire and forget
    resend.emails.send({ from: FROM, to: recipient.email, subject, html }).catch(e => console.error('[notify email]', e));
  } catch (e) { console.error('[notify email lookup]', e); }
}

function renderEmail({ headline, previewText, ctaLabel, ctaUrl, unsubUrl, type, recipientName }: { headline: string; previewText?: string; ctaLabel: string; ctaUrl: string; unsubUrl: string; type: string; recipientName: string }) {
  const greeting = recipientName ? `Hi ${escHtml(recipientName)},` : 'Hi,';
  return `
<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px">
    <div style="text-align:center;margin-bottom:20px">
      <img loading="lazy" decoding="async" src="${LOGO}" alt="BugBitten" width="180" style="height:auto;max-width:180px"/>
    </div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px 26px">
      <p style="margin:0 0 12px;color:#6b7280;font-size:13px">${greeting}</p>
      <h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:22px;color:#111827;line-height:1.3">${headline}</h1>
      ${previewText ? `<div style="background:#f9fafb;border-left:3px solid var(--brand);padding:12px 14px;border-radius:6px;color:#374151;font-size:14px;line-height:1.55;margin:0 0 18px;font-style:italic">${escHtml(previewText.slice(0, 280))}${previewText.length > 280 ? '…' : ''}</div>` : ''}
      <div style="text-align:center;margin:6px 0 4px">
        <a href="${ctaUrl}" style="display:inline-block;background:var(--brand);color:#ffffff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:8px;font-size:14px">${ctaLabel}</a>
      </div>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:11px;line-height:1.6;margin-top:18px">
      You're getting this because you have <strong>${escHtml(type)}</strong> emails turned on for BugBitten.<br/>
      <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline">Unsubscribe from these</a> · <a href="${SITE}/settings" style="color:#9ca3af;text-decoration:underline">Manage email preferences</a>
    </p>
  </div>
</body></html>`;
}
