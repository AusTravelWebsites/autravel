import { NextRequest, NextResponse } from 'next/server'
export async function GET(req: NextRequest) {
  const place_id = new URL(req.url).searchParams.get('place_id')
  if (!place_id) return NextResponse.json({ error: 'place_id required' }, { status: 400 })
  const key = process.env.GOOGLE_PLACES_API_KEY
  const fields = 'place_id,name,formatted_address,geometry,types,rating,photos,url'
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${key}`
  try {
    const r = await fetch(url)
    const d = await r.json()
    return NextResponse.json({ result: d.result || null })
  } catch (e) { console.error('[places/details]', e); return NextResponse.json({ error: 'Lookup failed' }, { status: 500 }) }
}
