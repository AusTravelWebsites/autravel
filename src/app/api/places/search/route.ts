import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')
  const debug = url.searchParams.get('debug') === '1'
  if (!q || q.length < 2) return NextResponse.json({ predictions: [] })
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not set', predictions: [] }, { status: 500 })
  const types = url.searchParams.get('types') // e.g. 'country', 'cities'
  const typesParam = types ? `&types=${encodeURIComponent(types === 'country' ? '(regions)' : types)}` : ''
  const upstream = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&key=${key}&language=en${typesParam}`
  try {
    const r = await fetch(upstream)
    const d = await r.json()
    if (d.status && d.status !== 'OK' && d.status !== 'ZERO_RESULTS') {
      console.error('[places/search] Google Places error:', d.status, d.error_message)
      if (debug) return NextResponse.json({ predictions: [], google_status: d.status, google_error: d.error_message })
    }
    let predictions = d.predictions || []
    // When caller wants country-only, keep predictions whose types include 'country'
    if (types === 'country') {
      predictions = predictions.filter((p: any) => Array.isArray(p.types) && p.types.includes('country'))
    }
    if (debug) return NextResponse.json({ predictions, google_status: d.status })
    return NextResponse.json({ predictions })
  } catch (e) { console.error('[places/search]', e); return NextResponse.json({ error: 'Lookup failed', predictions: [] }, { status: 500 }) }
}
