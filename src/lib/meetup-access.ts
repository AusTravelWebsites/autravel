import sql from '@/lib/db';
import { hasBlocked } from '@/lib/blocks';

export interface MeetupRow {
  id: string;
  host_id: string;
  scope: string;
  women_only: boolean;
  min_age: number | null;
  host_approval_required: boolean;
  status: string;
  max_attendees: number;
}
export interface ViewerRow {
  id: string;
  verification_status?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
}

export async function canViewMeetup(m: MeetupRow, viewer: ViewerRow | null): Promise<boolean> {
  if (m.scope === 'public' || m.scope === 'verified_only') return true;
  if (!viewer) return false;
  if (viewer.id === m.host_id) return true;
  if (m.scope === 'friends_only') {
    const [r] = await sql`
      SELECT 1 FROM follows f1 JOIN follows f2
        ON f1.following_id = f2.follower_id AND f1.follower_id = f2.following_id
      WHERE f1.follower_id = ${viewer.id} AND f1.following_id = ${m.host_id} LIMIT 1`;
    return !!r;
  }
  if (m.scope === 'friends_of_friends') {
    const [r] = await sql`
      SELECT 1 FROM follows WHERE follower_id = ${viewer.id} AND following_id IN (
        SELECT follower_id FROM follows WHERE following_id = ${m.host_id}
      ) LIMIT 1`;
    return !!r;
  }
  return false;
}

export async function canRsvpMeetup(m: MeetupRow, viewer: ViewerRow | null): Promise<{ ok: boolean; reason?: string }> {
  if (!viewer) return { ok: false, reason: 'Please log in' };
  if (viewer.id === m.host_id) return { ok: false, reason: 'You are the host' };
  if (await hasBlocked(m.host_id, viewer.id)) return { ok: false, reason: 'Not available' };
  if (m.status === 'cancelled') return { ok: false, reason: 'Meetup cancelled' };
  if (m.status === 'past') return { ok: false, reason: 'Meetup already happened' };

  if (m.scope === 'public' || m.scope === 'verified_only') {
    if (viewer.verification_status !== 'verified') {
      return { ok: false, reason: 'Verify your profile (18+) to join open meetups' };
    }
  }
  if (m.min_age && viewer.date_of_birth) {
    const age = Math.floor((Date.now() - new Date(viewer.date_of_birth).getTime()) / 31557600000);
    if (age < m.min_age) return { ok: false, reason: `Must be ${m.min_age}+` };
  }
  if (m.women_only && viewer.gender !== 'female') {
    return { ok: false, reason: 'Women-only meetup' };
  }
  const viewable = await canViewMeetup(m, viewer);
  if (!viewable) return { ok: false, reason: 'Not visible to you' };
  return { ok: true };
}

export async function getViewerWithVerify(userId: string): Promise<ViewerRow | null> {
  const [u] = await sql`SELECT id::text AS id, verification_status, gender, date_of_birth FROM public.users WHERE id::text = ${userId} LIMIT 1`;
  return u as ViewerRow | null;
}
