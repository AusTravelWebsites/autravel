import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import TravelMapClient from '@/components/features/TravelMapClient'

type Params = Promise<{ username: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params
  const [u] = await db`SELECT username, display_name FROM users WHERE username = ${username} LIMIT 1`
  if (!u) return { title: 'Traveller not found' }
  const title = `${u.display_name || u.username}'s travel globe`
  return {
    title,
    description: `Explore where ${u.display_name || u.username} has travelled — interactive globe with photos and journal entries from every country.`,
    alternates: { canonical: `https://bugbitten.com/u/${u.username}/travels` },
    openGraph: { title, type: 'profile' },
  }
}

export default async function PublicTravelsPage({ params }: { params: Params }) {
  const { username } = await params
  const [u] = await db`SELECT username, display_name FROM users WHERE username = ${username} LIMIT 1`
  if (!u) notFound()

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <TravelMapClient username={u.username}/>
    </main>
  )
}
