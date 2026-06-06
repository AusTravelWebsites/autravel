import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function RandomPlace() {
  let slug: string | null = null;
  try {
    const [row] = await db`SELECT slug FROM places ORDER BY RANDOM() LIMIT 1`;
    slug = row?.slug || null;
  } catch {}
  if (!slug) redirect('/explore');
  redirect('/places/' + slug);
}
