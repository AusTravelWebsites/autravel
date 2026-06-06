import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { TripEditForm } from '@/components/features/TripEditForm'
import type { Metadata } from 'next'

interface Props { params: Promise<{ username: string; slug: string }> }

export const metadata: Metadata = {
  title: 'Edit trip',
  robots: { index: false, follow: false },
}

export default async function EditTripPage({ params }: Props) {
  const { username, slug } = await params
  let trip: any = null
  try {
    const rows = await db`
      SELECT t.id::text AS id
      FROM trips t JOIN users u ON u.id::text = t.user_id
      WHERE u.username = ${username} AND t.slug = ${slug} LIMIT 1`
    trip = rows[0] || null
  } catch {}
  if (!trip) notFound()
  const back = `/${username}/trips/${slug}`
  return <TripEditForm id={trip.id} backHref={back} afterSaveHref={back} />
}
