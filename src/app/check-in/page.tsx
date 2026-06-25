'use client'
import { Suspense } from 'react'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete'

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckInState =
  | 'idle'
  | 'requesting'
  | 'acquiring'
  | 'calculating'
  | 'success'
  | 'out_of_range'
  | 'permission_denied'
  | 'already_checked_in'
  | 'mock_detected'
  | 'error'

interface Place {
  id:       string
  slug?:    string
  name:     string
  address:  string
  city:     string
  country:  string
  category: string
  lat:      number
  lng:      number
}

interface GpsResult {
  lat:            number
  lng:            number
  accuracyMetres: number
  distanceMetres: number
  withinRange:    boolean
  mockDetected:   boolean
  timestamp:      number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RANGE_METRES    = 5000
const GPS_TIMEOUT_MS  = 15000
const ACCURACY_MIN_M  = 150 // accept reading if accuracy better than this

// ─── Haversine distance ───────────────────────────────────────────────────────

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R  = 6_371_000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Mock place (replace with DB fetch using searchParams placeId) ─────────────

const MOCK_PLACE: Place = {
  id:       'pl_01',
  name:     'The Green Monkey Hostel',
  address:  'Jl. Bisma No.27, Ubud',
  city:     'Ubud',
  country:  'Bali, Indonesia',
  category: 'Hostel',
  lat:      -8.5069,
  lng:      115.2625,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CheckInPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const placeId      = searchParams.get('place')

  const [place, setPlace] = useState<Place | null>(null)
  useEffect(() => {
    if (!placeId) return
    fetch(`/api/places?slug=${encodeURIComponent(placeId)}&id=${encodeURIComponent(placeId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const p = d?.place
        if (!p) return
        setPlace({
          id: p.id,
          slug: p.slug || p.id,
          name: p.name,
          address: p.address || '',
          city: p.city || '',
          country: p.country || '',
          category: p.category || '',
          lat: Number(p.lat) || 0,
          lng: Number(p.lng) || 0,
        })
      }).catch(() => {})
  }, [placeId])

  const [state,     setState]     = useState<CheckInState>('idle')
  const [result,    setResult]    = useState<GpsResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [elapsed,    setElapsed]    = useState(0)

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef  = useRef<number>(0)

  // ── Tick timer during acquisition ───────────────────────────────────────────
  useEffect(() => {
    if (state === 'acquiring') {
      startRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }, 500)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setElapsed(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [state])

  // ── Main GPS flow ────────────────────────────────────────────────────────────
  async function startCheckIn() {
    if (!navigator.geolocation) {
      setState('error')
      return
    }

    setState('requesting')

    // Small delay so the UI transition is perceptible
    await new Promise(r => setTimeout(r, 600))

    setState('acquiring')

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout:            GPS_TIMEOUT_MS,
          maximumAge:         0,
        })
      })

      setState('calculating')
      await new Promise(r => setTimeout(r, 1200)) // dramatic pause

      const { latitude, longitude, accuracy } = position.coords
      const distanceM = haversineMetres(latitude, longitude, place.lat, place.lng)
      const within    = distanceM <= RANGE_METRES

      const gpsResult: GpsResult = {
        lat:            latitude,
        lng:            longitude,
        accuracyMetres: Math.round(accuracy),
        distanceMetres: Math.round(distanceM),
        withinRange:    within,
        mockDetected:   false, // server will check via App Attestation
        timestamp:      Date.now(),
      }

      setResult(gpsResult)
      setState(within ? 'success' : 'out_of_range')

    } catch (err: unknown) {
      const error = err as GeolocationPositionError
      if (error.code === 1) setState('permission_denied')
      else setState('error')
    }
  }

  // ── Submit check-in to API ───────────────────────────────────────────────────
  async function submitCheckIn() {
    if (!result || submitting) return
    setSubmitting(true)

    try {
      // POST /api/check-ins
      // Body: { placeId, lat, lng, accuracyMetres, distanceMetres, timestamp }
      // Server: validates against place coords, checks mock_location via attestation
      // Returns: { checkInId, reviewWindowEnds }
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          place_id: place.id,
          lat: result!.lat,
          lng: result!.lng,
          accuracy_metres: result!.accuracyMetres,
          distance_metres: result!.distanceMetres,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Check-in failed')
      setResult(data)
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted && result && place) {
    return <SuccessScreen place={place} result={result} onReview={() => router.push(`/reviews/new?place=${place.slug || place.id}`)} onFeed={() => router.push('/feed')} />
  }

  if (!place) {
    return <PickPlaceScreen onPick={(p) => router.push(`/check-in?place=${encodeURIComponent(p.slug || p.id)}`)} title="Check in to a place" />
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', color: '#111827' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <Link href={place.slug ? `/places/${place.slug}` : '/explore'} style={{ color: '#6b7280', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ← Back to place
          </Link>
          <button onClick={() => router.push('/check-in')} title="Change place" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#6b7280', fontSize: 13, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontWeight: 600 }}>
            ✕ Change place
          </button>
        </div>

        {/* Place info */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>Check in · {place.category}</div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 4px', lineHeight: 1.2 }}>
            {place.name}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>{[place.address, place.city, place.country].filter(Boolean).join(', ')}</p>
        </div>

        {/* Main state panel — light card, consistent with rest of site */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '28px 22px', minHeight: 380, display: 'flex', flexDirection: 'column' }}>
          {state === 'idle' && (
            <IdleState place={place} onStart={startCheckIn} />
          )}
          {state === 'requesting' && (
            <AcquiringState label="Requesting location access…" showRadar={false} />
          )}
          {state === 'acquiring' && (
            <AcquiringState label={`Acquiring GPS signal… ${elapsed}s`} showRadar elapsed={elapsed} />
          )}
          {state === 'calculating' && (
            <AcquiringState label="Calculating distance…" showRadar calculating />
          )}
          {state === 'success' && result && (
            <SuccessState place={place} result={result} submitting={submitting} onSubmit={submitCheckIn} />
          )}
          {state === 'out_of_range' && result && (
            <OutOfRangeState place={place} result={result} onRetry={startCheckIn} />
          )}
          {state === 'permission_denied' && (
            <PermissionDeniedState onRetry={() => setState('idle')} />
          )}
          {(state === 'error' || state === 'mock_detected') && (
            <ErrorState state={state} onRetry={() => setState('idle')} />
          )}
        </div>
      </div>
    </main>
  )
}

// ─── Idle state ───────────────────────────────────────────────────────────────

function IdleState({ place, onStart }: { place: Place; onStart: () => void }) {
  return (
    <div style={{ display:'flex', flexDirection:'column' as const, alignItems:'center', textAlign:'center' as const, gap:22 }}>
      <div style={{ position:'relative' as const, width:144, height:144 }}>
        <div style={{ position:'absolute' as const, inset:0, borderRadius:'50%', background:'var(--brand-light)', border:'2px solid #99f6e4' }} />
        <div style={{ position:'absolute' as const, inset:16, borderRadius:'50%', background:'#ecfeff', border:'2px solid #e5e7eb' }} />
        <div style={{ position:'absolute' as const, inset:32, borderRadius:'50%', background:'#f3f4f6', border:'2px solid #e5e7eb' }} />
        <div style={{ position:'absolute' as const, inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}>
            <PinIcon size={18} color="#fff" />
          </div>
        </div>
        <div style={{ position:'absolute' as const, bottom:-4, right:-4, background:'#fff', border:'1px solid #e5e7eb', borderRadius:99, padding:'2px 10px', fontSize:11, fontWeight:700, color:'#111827' }}>5 km</div>
      </div>

      <div>
        <h2 style={{ fontFamily:'Georgia, serif', fontSize:22, fontWeight:800, color:'#111827', margin:'0 0 6px' }}>Are you here?</h2>
        <p style={{ fontSize:14, color:'#6b7280', lineHeight:1.55, maxWidth:360, margin:'0 auto' }}>
          BugBitten will check your GPS location. You need to be within <strong style={{ color:'#111827' }}>5 km</strong> of {place.name} to check in.
        </p>
      </div>

      <button onClick={onStart} style={{ background:'var(--brand)', color:'#fff', border:'none', borderRadius:10, padding:'12px 28px', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Check in here</button>

      <p style={{ fontSize:12, color:'#6b7280', textAlign:'center' as const, lineHeight:1.5, maxWidth:380 }}>
        Your exact coordinates are never stored publicly. Only the check-in distance is recorded.
      </p>

      <div style={{ width:'100%', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'14px 16px', textAlign:'left' as const }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#111827', marginBottom:8 }}>Why GPS verification?</div>
        <ul style={{ margin:0, paddingLeft:0, listStyle:'none', display:'flex', flexDirection:'column' as const, gap:6 }}>
          {[
            'Ensures reviews come from real visitors',
            'Unlocks a 72-hour review window',
            'GPS-verified reviews rank higher on BugBitten',
          ].map(item => (
            <li key={item} style={{ display:'flex', alignItems:'flex-start' as const, gap:8, fontSize:12, color:'#374151' }}>
              <span style={{ color:'var(--brand)', fontWeight:700, flexShrink:0 }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─── Acquiring / calculating state ────────────────────────────────────────────

function AcquiringState({
  label,
  showRadar,
  elapsed,
  calculating,
}: {
  label: string
  showRadar?: boolean
  elapsed?: number
  calculating?: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 flex-1 animate-fade-in">
      {showRadar ? (
        <RadarAnimation calculating={calculating} />
      ) : (
        <div className="w-24 h-24 rounded-full border-4 border-gray-200 border-t-teal-500 animate-spin" />
      )}
      <div className="text-center">
        <p className="font-medium text-gray-900 text-base mb-1">{label}</p>
        <p className="text-xs text-gray-500">
          {calculating ? 'Comparing your location to the venue…' : 'Keep your phone still for best accuracy'}
        </p>
      </div>
    </div>
  )
}

// ─── Radar animation ──────────────────────────────────────────────────────────

function RadarAnimation({ calculating }: { calculating?: boolean }) {
  return (
    <div className="relative w-40 h-40">
      {/* Rings */}
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute inset-0 rounded-full border border-gray-200"
          style={{
            transform: `scale(${0.35 + i * 0.32})`,
            transformOrigin: 'center',
          }}
        />
      ))}

      {/* Radar sweep */}
      {!calculating && (
        <div
          className="absolute inset-0 rounded-full overflow-hidden"
          style={{ animation: 'spin 2s linear infinite' }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, transparent 270deg, rgba(76,175,128,0.4) 360deg)',
            }}
          />
        </div>
      )}

      {/* Centre pin */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center',
          calculating ? 'bg-gray-100 animate-pulse' : 'bg-teal-600'
        )}>
          <PinIcon size={22} color="var(--brand)" />
        </div>
      </div>

      {/* Pulsing dot */}
      {!calculating && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-3 h-3 rounded-full bg-gray-200 animate-ping opacity-75" />
        </div>
      )}
    </div>
  )
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState({
  place,
  result,
  submitting,
  onSubmit,
}: {
  place:      Place
  result:     GpsResult
  submitting: boolean
  onSubmit:   () => void
}) {
  const distanceKm = (result.distanceMetres / 1000).toFixed(1)

  return (
    <div className="flex flex-col gap-6 animate-scale-in">
      {/* Distance badge */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-teal-50 border-4 border-teal-200 flex items-center justify-center">
          <span className="text-4xl">✓</span>
        </div>
        <div className="text-center">
          <p className="font-display font-bold text-2xl text-gray-900 tracking-tight mb-1">
            You're here!
          </p>
          <p className="text-sm text-gray-500">
            {distanceKm} km from {place.name}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Distance',  value: `${distanceKm} km` },
          { label: 'Accuracy',  value: `±${result.accuracyMetres}m` },
          { label: 'Range',     value: '5 km ✓' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-teal-50 rounded-xl p-3 text-center border border-teal-100">
            <p className="font-semibold text-emerald-800 text-sm">{value}</p>
            <p className="text-xs text-teal-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Review window info */}
      <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-gray-700 text-lg mt-0.5">🕐</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm mb-0.5">72-hour review window</p>
            <p className="text-xs text-gray-800 leading-relaxed">
              Once you confirm, you'll have 72 hours to write a review from anywhere — no need to stay nearby.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting}
        className={cn(
          'w-full py-4 rounded-2xl font-semibold text-base',
          'flex items-center justify-center gap-3',
          'transition-all duration-fast active:scale-[0.98]',
          submitting
            ? 'bg-gray-100 text-gray-500'
            : 'bg-teal-600 text-white hover:bg-teal-500'
        )}
      >
        {submitting ? (
          <>
            <span className="w-5 h-5 rounded-full border-2 border-mist border-t-transparent animate-spin" />
            Confirming check-in…
          </>
        ) : (
          <>
            <PinIcon size={20} color="var(--brand)" />
            Confirm check-in
          </>
        )}
      </button>
    </div>
  )
}

// ─── Out of range state ───────────────────────────────────────────────────────

function OutOfRangeState({
  place,
  result,
  onRetry,
}: {
  place:   Place
  result:  GpsResult
  onRetry: () => void
}) {
  const distanceKm = (result.distanceMetres / 1000).toFixed(1)
  const overBy     = ((result.distanceMetres - RANGE_METRES) / 1000).toFixed(1)

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-red-50 border-4 border-red-100 flex items-center justify-center">
          <span className="text-4xl">📍</span>
        </div>
        <div className="text-center">
          <p className="font-display font-bold text-2xl text-gray-900 tracking-tight mb-1">
            Too far away
          </p>
          <p className="text-sm text-gray-500">
            You're {distanceKm} km from {place.name}
          </p>
        </div>
      </div>

      {/* Distance bar */}
      <div className="bg-white rounded-xl p-4">
        <div className="flex justify-between text-xs font-medium mb-2">
          <span className="text-gray-900">Your location</span>
          <span className="text-gray-500">{place.name}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-danger rounded-full"
            style={{ width: `${Math.min(100, (RANGE_METRES / result.distanceMetres) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5 text-gray-500">
          <span>0 km</span>
          <span className="text-danger font-medium">5 km limit</span>
          <span>{distanceKm} km</span>
        </div>
        <p className="text-xs text-center text-gray-600 mt-3">
          You need to be <strong>{overBy} km closer</strong> to check in here.
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={onRetry}
          style={{ width:'100%', padding:'12px 20px', borderRadius:10, background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer', fontFamily:'inherit' }}
        >
          Try again
        </button>
        <Link
          href={`/places/${place.id}`}
          className="block w-full py-3.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm text-center hover:bg-white transition-colors"
        >
          Browse {place.name} anyway
        </Link>
      </div>
    </div>
  )
}

// ─── Permission denied state ──────────────────────────────────────────────────

function PermissionDeniedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center animate-fade-up">
      <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center text-4xl">
        🔒
      </div>
      <div>
        <p className="font-display font-bold text-2xl text-gray-900 tracking-tight mb-2">
          Location access needed
        </p>
        <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
          BugBitten needs your location to verify you're nearby. Enable location access in your browser or device settings, then try again.
        </p>
      </div>
      <div className="w-full bg-amber-50 border border-amber-100 rounded-xl p-4 text-left">
        <p className="text-xs font-semibold text-amber-900 mb-2">How to enable:</p>
        <ul className="space-y-1">
          {[
            'iPhone: Settings → Safari → Location → Allow',
            'Android: Site settings → Location → Allow',
            'Chrome: Address bar lock icon → Location',
          ].map(tip => (
            <li key={tip} className="text-xs text-amber-800">{tip}</li>
          ))}
        </ul>
      </div>
      <button
        onClick={onRetry}
        style={{ width:'100%', padding:'12px 20px', borderRadius:10, background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer', fontFamily:'inherit' }}
      >
        Try again
      </button>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ state, onRetry }: { state: CheckInState; onRetry: () => void }) {
  const isMock = state === 'mock_detected'
  return (
    <div className="flex flex-col items-center gap-6 text-center animate-fade-up">
      <div className="text-5xl">{isMock ? '⚠️' : '📡'}</div>
      <div>
        <p className="font-display font-bold text-2xl text-gray-900 tracking-tight mb-2">
          {isMock ? 'Location appears spoofed' : 'GPS signal lost'}
        </p>
        <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
          {isMock
            ? 'We detected a mock location app. Disable it and try again — reviews require a genuine GPS signal.'
            : 'Could not get a GPS fix. Try moving outside, away from tall buildings, and ensure location services are enabled.'}
        </p>
      </div>
      <button onClick={onRetry} style={{ width:'100%', padding:'12px 20px', borderRadius:10, background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
        Try again
      </button>
    </div>
  )
}

// ─── Final success screen (after API confirmation) ────────────────────────────

function SuccessScreen({
  place,
  result,
  onReview,
  onFeed,
}: {
  place:    Place
  result:   GpsResult
  onReview: () => void
  onFeed:   () => void
}) {
  return (
    <main style={{ minHeight:'100vh', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>
      <div style={{ maxWidth:480, width:'100%', background:'#ffffff', border:'1px solid #e5e7eb', borderRadius:16, padding:'32px 26px', textAlign:'center' as const }}>
        <div style={{ fontSize:56, marginBottom:14 }}>🌿</div>
        <h1 style={{ fontFamily:'Georgia, serif', fontSize:28, fontWeight:800, color:'#111827', margin:'0 0 6px', lineHeight:1.2 }}>
          Checked in!
        </h1>
        <div style={{ fontSize:15, fontWeight:600, color:'var(--brand)', margin:'0 0 4px' }}>{place.name}</div>
        <div style={{ fontSize:12, color:'#6b7280', marginBottom:22 }}>
          {(result.distanceMetres / 1000).toFixed(1)} km away · GPS verified
        </div>

        <div style={{ background:'var(--brand-light)', border:'1px solid #99f6e4', borderRadius:12, padding:16, marginBottom:20, textAlign:'left' as const }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ fontSize:22 }}>🕐</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--brand-dark)' }}>72-hour review window open</div>
              <div style={{ fontSize:12, color:'var(--brand)' }}>Write your review anytime in the next 3 days</div>
            </div>
          </div>
          <div style={{ fontSize:12, color:'var(--brand-dark)', lineHeight:1.55 }}>
            Your GPS-verified check-in is saved. You can write a review from anywhere — no need to stay nearby.
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column' as const, gap:10 }}>
          <button onClick={onReview} style={{ padding:'13px 20px', borderRadius:10, background:'var(--brand)', color:'#fff', fontWeight:700, fontSize:14, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            Write a review now
          </button>
          <button onClick={onFeed} style={{ padding:'13px 20px', borderRadius:10, background:'#ffffff', color:'#374151', fontWeight:600, fontSize:14, border:'1px solid #e5e7eb', cursor:'pointer', fontFamily:'inherit' }}>
            Back to feed
          </button>
        </div>
      </div>
    </main>
  )
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

function PinIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function PickPlaceScreen({ onPick, title }: { onPick: (p: { id: string; slug?: string; name: string }) => void; title: string }) {
  const [q, setQ] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [recent, setRecent] = useState<Array<{ id: string; slug: string; name: string; city?: string; country?: string; created_at: string }>>([])
  useEffect(() => {
    fetch('/api/checkins?me=1&limit=5').then(r => r.ok ? r.json() : null).then(d => {
      const uniq: Record<string, any> = {}
      for (const c of (d?.checkins || [])) {
        if (!c.place_slug || uniq[c.place_slug]) continue
        uniq[c.place_slug] = { id: c.place_id, slug: c.place_slug, name: c.place_name, city: c.place_city, country: c.place_country, created_at: c.created_at }
        if (Object.keys(uniq).length >= 5) break
      }
      setRecent(Object.values(uniq))
    }).catch(() => {})
  }, [])
  const submit = async () => {
    if (!q.trim() || submitting) return
    setSubmitting(true); setErr('')
    try {
      const r = await fetch('/api/places/upsert-from-location', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: q.trim() }),
      })
      const d = await r.json()
      if (!r.ok || !d?.place) { setErr(d?.error || 'Place not found'); return }
      onPick({ id: d.place.id, slug: d.place.slug, name: d.place.name })
    } catch { setErr('Network error') } finally { setSubmitting(false) }
  }
  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', padding: '40px 20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 28 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>{title}</h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>Search for a place by name or address — we'll pull it from Google Maps.</p>
        <PlaceAutocomplete value={q} onChange={setQ} placeholder="e.g. The Green Monkey Hostel, Ubud" inputStyle={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', boxSizing:'border-box' as const }} />
        {recent.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 6 }}>Recent</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
              {recent.map(r => (
                <button key={r.slug} onClick={() => onPick({ id: r.id, slug: r.slug, name: r.name })}
                  style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', textAlign: 'left' as const, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, gap: 2, fontFamily: 'inherit' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>📍 {r.name}</span>
                  {(r.city || r.country) && <span style={{ fontSize: 11, color: '#6b7280' }}>{[r.city, r.country].filter(Boolean).join(', ')}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        {err && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 10 }}>{err}</div>}
        <button onClick={submit} disabled={!q.trim() || submitting}
          style={{ marginTop: 14, background: q.trim() ? 'var(--brand)' : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: q.trim() && !submitting ? 'pointer' : 'default', width: '100%' }}>
          {submitting ? 'Loading…' : 'Continue'}
        </button>
      </div>
    </main>
  )
}

export default function CheckInPage() {
  return (<Suspense fallback={null}><CheckInPageInner /></Suspense>)
}
