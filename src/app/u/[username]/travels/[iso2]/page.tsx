import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { COUNTRIES, flagFor } from '@/lib/countries'
import TravelMapClient from '@/components/features/TravelMapClient'

type Params = Promise<{ username: string; iso2: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username, iso2: raw } = await params
  const iso2 = raw.toUpperCase()
  const [u] = await db`SELECT username, display_name FROM users WHERE username = ${username} LIMIT 1`
  const country = COUNTRIES[iso2]
  if (!u || !country) return { title: 'Not found' }
  const who = u.display_name || u.username
  const title = `${flagFor(iso2)} ${who} in ${country.name}`
  return {
    title,
    description: `${who}'s travels, photos and journal entries from ${country.name}.`,
    alternates: { canonical: `https://bugbitten.com/u/${u.username}/travels/${iso2.toLowerCase()}` },
    openGraph: { title, type: 'profile' },
  }
}

export default async function PublicCountryTravelsPage({ params }: { params: Params }) {
  const { username, iso2: raw } = await params
  const iso2 = raw.toUpperCase()
  const [u] = await db`SELECT username, display_name FROM users WHERE username = ${username} LIMIT 1`
  if (!u || !COUNTRIES[iso2]) notFound()

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <TravelMapClient username={u.username} initialIso2={iso2}/>
    </main>
  )
}
