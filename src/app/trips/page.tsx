import { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import TravelMapClient from '@/components/features/TravelMapClient'
import TravelCountryGallery from '@/components/features/TravelCountryGallery'
import TripsListSection from './TripsListSection'

export const metadata: Metadata = {
  title: 'My Trips · Interactive Travel Globe',
  description: 'Rotate your globe to see every country you\'ve journaled in. Browse your trips and the photos, entries and stories that came out of each one.',
  alternates: { canonical: 'https://bugbitten.com/trips' },
  openGraph: {
    title: 'My Trips · Interactive Travel Globe | BugBitten',
    description: 'An interactive globe of everywhere you\'ve travelled, plus the trip journals underneath.',
    type: 'website',
  },
}

async function getViewer() {
  const session = (await cookies()).get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const [u] = await db`SELECT id::text, username, display_name FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return u || null
  } catch { return null }
}

export default async function TripsPage() {
  const viewer = await getViewer()

  if (!viewer) {
    return (
      <main style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 30% 10%, #0f2740 0%, #050914 60%, #02050c 100%)', color: '#fff' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🌍</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px,5vw,44px)', fontWeight: 800, margin: '0 0 14px', letterSpacing: '-0.01em' }}>
            Your travel globe
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 17, lineHeight: 1.55, margin: '0 auto 28px', maxWidth: 560 }}>
            Turn your journal entries and trips into an interactive globe. Every country you write about lights up. Click a country to see the photos and stories from that trip, and choose what to share with friends or the world.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login?next=/trips" style={{ background: 'var(--brand)', color: '#fff', borderRadius: 999, padding: '12px 22px', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Sign in</Link>
            <Link href="/signup" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, padding: '12px 22px', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Create an account</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <TravelMapClient />
      <TravelCountryGallery />
      <TripsListSection />
    </main>
  )
}
