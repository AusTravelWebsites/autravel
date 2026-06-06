import { permanentRedirect, notFound } from 'next/navigation'
import { db } from '@/lib/db'

interface Props { params: Promise<{ id: string }> }

export default async function LegacyTripRedirect({ params }: Props) {
  const { id } = await params
  let rows: any[] = []
  try {
    rows = await db`
      SELECT t.slug, u.username
      FROM trips t
      JOIN users u ON u.id::text = t.user_id
      WHERE t.id::text = ${id} LIMIT 1`
  } catch {}
  const r = rows[0]
  if (!r) notFound()
  permanentRedirect(`/${r.username}/trips/${r.slug}`)
}
