import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api-errors'
import { getAdminAuth } from '@/lib/firebase-admin'
import { db } from '@/lib/db'
import { stripExternalLinks } from '@/lib/sanitize'

const CATS = ['accommodation', 'attraction', 'food', 'bar', 'other'] as const

async function getUser(req: NextRequest) {
  const session = req.cookies.get('__session')?.value
  if (!session) return null
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true)
    const [u] = await db`SELECT id, is_banned FROM users WHERE firebase_uid = ${decoded.uid} LIMIT 1`
    return u || null
  } catch { return null }
}

// GET /api/locations?username=craig — list a user's locations.
// Auth required (per Craig's spec: viewers must register).
export async function GET(req: NextRequest) {
  const me = await getUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const username = url.searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 })
  try {
    const [target] = await db`SELECT id FROM users WHERE username = ${username} LIMIT 1`
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    const isOwner = target.id === me.id
    const rows = await db`
      SELECT id, user_id, country_code, country_name, place_name, category, notes, lat, lng, photos, is_public, created_at, updated_at
      FROM user_locations
      WHERE user_id = ${target.id} AND (${isOwner} OR is_public = true)
      ORDER BY country_name ASC, created_at DESC`
    return NextResponse.json({ locations: rows, is_owner: isOwner })
  } catch (e: any) {
    console.error('[locations GET]', e)
    return serverError(e, 'locations', req)
  }
}

export async function POST(req: NextRequest) {
  const me = await getUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (me.is_banned) return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
  const body = await req.json().catch(() => ({} as any))
  const country_code = (body.country_code || '').toString().toUpperCase().slice(0, 3)
  const country_name = stripExternalLinks(body.country_name) || ''
  const place_name   = stripExternalLinks(body.place_name) || null
  const category     = CATS.includes(body.category) ? body.category : 'other'
  const notes        = stripExternalLinks(body.notes) || null
  const photos       = Array.isArray(body.photos) ? body.photos.filter((u: any) => typeof u === 'string').slice(0, 20) : []
  const lat          = body.lat == null ? null : Number(body.lat)
  const lng          = body.lng == null ? null : Number(body.lng)
  const is_public    = body.is_public !== false
  if (!country_code || !country_name) {
    return NextResponse.json({ error: 'country_code and country_name required' }, { status: 400 })
  }
  try {
    const [row] = await db`
      INSERT INTO user_locations (user_id, country_code, country_name, place_name, category, notes, photos, lat, lng, is_public)
      VALUES (${me.id}, ${country_code}, ${country_name}, ${place_name}, ${category}, ${notes}, ${photos as any}, ${lat}, ${lng}, ${is_public})
      RETURNING *`
    return NextResponse.json({ location: row }, { status: 201 })
  } catch (e: any) {
    console.error('[locations POST]', e)
    return serverError(e, 'locations', req)
  }
}

export async function PATCH(req: NextRequest) {
  const me = await getUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const body = await req.json().catch(() => ({} as any))
  try {
    const [existing] = await db`SELECT user_id FROM user_locations WHERE id = ${id} LIMIT 1`
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.user_id !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const place_name = body.place_name === undefined ? undefined : (stripExternalLinks(body.place_name) || null)
    const category   = body.category && CATS.includes(body.category) ? body.category : undefined
    const notes      = body.notes === undefined ? undefined : (stripExternalLinks(body.notes) || null)
    const photos     = Array.isArray(body.photos) ? body.photos.filter((u: any) => typeof u === 'string').slice(0, 20) : undefined
    const is_public  = typeof body.is_public === 'boolean' ? body.is_public : undefined
    const [row] = await db`
      UPDATE user_locations SET
        place_name = COALESCE(${place_name === undefined ? null : place_name}, place_name),
        category   = COALESCE(${category ?? null}, category),
        notes      = COALESCE(${notes === undefined ? null : notes}, notes),
        photos     = COALESCE(${(photos ?? null) as any}, photos),
        is_public  = COALESCE(${is_public ?? null}, is_public),
        updated_at = NOW()
      WHERE id = ${id} RETURNING *`
    return NextResponse.json({ location: row })
  } catch (e: any) {
    console.error('[locations PATCH]', e)
    return serverError(e, 'locations', req)
  }
}

export async function DELETE(req: NextRequest) {
  const me = await getUser(req)
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  try {
    const [existing] = await db`SELECT user_id FROM user_locations WHERE id = ${id} LIMIT 1`
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.user_id !== me.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await db`DELETE FROM user_locations WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[locations DELETE]', e)
    return serverError(e, 'locations', req)
  }
}
