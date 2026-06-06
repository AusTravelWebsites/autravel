import sql from '@/lib/db';

// Returns all user IDs that should be hidden from the given viewer's lists —
// includes both users they've blocked and users who have blocked them.
// Cached per request would be ideal; callers typically make one call per handler.
export async function getMutedIds(viewerId: string | null | undefined): Promise<string[]> {
  if (!viewerId) return [];
  try {
    const rows = await sql`
      SELECT blocked_id AS id FROM user_blocks WHERE blocker_id = ${viewerId}
      UNION
      SELECT blocker_id AS id FROM user_blocks WHERE blocked_id = ${viewerId}`;
    return (rows as any[]).map(r => r.id);
  } catch { return []; }
}

export async function hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  if (!blockerId || !blockedId || blockerId === blockedId) return false;
  try {
    const [r] = await sql`
      SELECT 1 FROM user_blocks
      WHERE (blocker_id = ${blockerId} AND blocked_id = ${blockedId})
         OR (blocker_id = ${blockedId} AND blocked_id = ${blockerId})
      LIMIT 1`;
    return !!r;
  } catch { return false; }
}
