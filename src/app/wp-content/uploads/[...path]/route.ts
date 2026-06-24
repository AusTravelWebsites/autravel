import { NextRequest } from 'next/server'
import { tenantForHost } from '@/lib/tenants'
import { createReadStream, promises as fsp } from 'fs'
import { join, resolve, extname } from 'path'
import { Readable } from 'stream'

export const dynamic = 'force-dynamic'

// Legacy WordPress media. Every autravel tenant was migrated from a WP site;
// the migrated articles still reference images at <tenant>/wp-content/uploads/*.
// The WP installs are headless (not public) but their upload dirs still live
// on disk, so we serve them straight through here. Cloudflare caches the
// response, so origin only touches each file once.
const UPLOAD_DIRS: Record<string, string> = {
  qld:  '/home/qldtravel/public_html/wp-content/uploads',
  nsw:  '/home/nswtravel/public_html/wp-content/uploads',
  nt:   '/home/nttravel/public_html/wp-content/uploads',
  wa:   '/home/western/public_html/wp-content/uploads',
  sa:   '/home/satravel/public_html/wp-content/uploads',
  tas:  '/home/tastravel/public_html/wp-content/uploads',
  vic:  '/home/victravel/public_html/wp-content/uploads',
  aunz: '/home/aunztravelcom/public_html/wp-content/uploads',
  // New Forest: the WP *application* is removed at cut-over but the cPanel
  // account + wp-content/uploads dir is deliberately preserved on disk so the
  // 3k migrated blog/listing images keep serving at their original URLs.
  uk:   '/home/newforest/public_html/wp-content/uploads',
  // Perth Tourism: same as New Forest — WP app removed at cut-over, but the
  // cPanel account + wp-content/uploads dir stays on disk so every migrated
  // blog image keeps serving at its original /wp-content/uploads/... URL.
  perth: '/home/perth/public_html/wp-content/uploads',
}

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.bmp': 'image/bmp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
  '.json': 'application/json', '.txt': 'text/plain',
}

function notFound() {
  return new Response('Not found', { status: 404 })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const tenant = tenantForHost(req.headers.get('host'))
  const baseDir = UPLOAD_DIRS[tenant.state_code]
  if (!baseDir) return notFound()

  const { path } = await ctx.params
  if (!path?.length) return notFound()

  // Resolve and confine to the tenant's upload dir — no path traversal.
  const rel = path.map(seg => decodeURIComponent(seg)).join('/')
  const full = resolve(join(baseDir, rel))
  if (full !== baseDir && !full.startsWith(baseDir + '/')) return notFound()

  let stat
  try {
    stat = await fsp.stat(full)
  } catch {
    return notFound()
  }
  if (!stat.isFile()) return notFound()

  const type = MIME[extname(full).toLowerCase()] || 'application/octet-stream'
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(stat.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Last-Modified': stat.mtime.toUTCString(),
    },
  })
}
