import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'

export const revalidate = 600

function esc(s: string | null | undefined): string {
  return (s || '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!))
}

export async function GET() {
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const SITE = `https://${tenant.host}`
  const now = new Date().toUTCString()

  let rows: any[] = []
  try {
    rows = await db`
      SELECT slug, legacy_path, title, excerpt, cover_image,
             COALESCE(published_at, created_at) AS published
      FROM articles
      WHERE status = 'published'
        AND (noindex IS NULL OR noindex = false)
        AND (${state}::text IS NULL OR state_code = ${state}::text)
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT 50`
  } catch {}

  const items = rows.map((r: any) => {
    const path = r.legacy_path || `/articles/${r.slug}/`
    const link = `${SITE}${path}`
    const pubDate = r.published ? new Date(r.published).toUTCString() : now
    const desc = r.excerpt || r.title || ''
    return `
    <item>
      <title>${esc(r.title)}</title>
      <link>${esc(link)}</link>
      <guid>${esc(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${esc(desc)}</description>
      ${r.cover_image ? `<enclosure url="${esc(r.cover_image)}" type="image/webp"/>` : ''}
    </item>`
  }).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(tenant.name)} — Recent travel articles</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(tenant.tagline)}</description>
    <language>en-AU</language>
    <lastBuildDate>${now}</lastBuildDate>
    ${items}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  })
}
