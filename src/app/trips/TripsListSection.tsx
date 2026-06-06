'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Trip {
  id: string
  title: string
  slug: string
  cover_emoji: string
  country_count: number
  post_count: number
  started_at: string
  ended_at: string | null
  is_active: boolean
}

export default function TripsListSection() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/trips')
      .then(r => r.json())
      .then(d => { setTrips(d.trips || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <section style={{ background: '#f3f4f6', padding: '32px 16px 48px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' as const }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 800, margin: 0, color: '#111827' }}>My trips</h2>
          <button
            onClick={() => router.push('/trips/new')}
            style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >+ New adventure</button>
        </div>

        {loading ? (
          <p style={{ color: '#6b7280' }}>Loading…</p>
        ) : trips.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, textAlign: 'center' as const, padding: '40px 24px', color: '#6b7280' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🌏</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>No trips yet</p>
            <p style={{ marginBottom: 20, fontSize: 14 }}>Group your journal entries into named adventures.</p>
            <button
              onClick={() => router.push('/trips/new')}
              style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >Plan your first adventure</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            {trips.map(trip => (
              <Link key={trip.id} href={`/trips/${trip.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 32 }}>{trip.cover_emoji || '🌏'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 2 }}>{trip.title}</div>
                      <div style={{ fontSize: 13, color: '#6b7280' }}>
                        {(() => {
                          const start = (trip as any).start_date || trip.started_at
                          const end = (trip as any).end_date || trip.ended_at
                          if (!start) return 'No dates set'
                          const fmt = (d: string) => new Date(d).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
                          return fmt(start) + (end ? ' – ' + fmt(end) : ' – ongoing')
                        })()}
                      </div>
                    </div>
                    {trip.is_active && (
                      <span style={{ background: '#f0fdfa', color: '#0d9488', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>Active</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, color: '#6b7280' }}>
                    <span>🌍 {trip.country_count || 0} countries</span>
                    <span>📝 {trip.post_count || 0} posts</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
