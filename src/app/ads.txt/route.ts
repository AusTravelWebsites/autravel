// Serve ads.txt for Google AdSense (and other ad-tech verifiers) across every
// tenant. The same publisher ID is used on all sites, but if we ever split,
// switch on `tenant.state_code` here. Cache headers are essential — AdSense
// re-fetches frequently and a 404 here disables monetisation for ~24h.
import { NextResponse } from 'next/server'

export const dynamic = 'force-static'
export const revalidate = 86400

const ADS_TXT = `google.com, pub-4240720052276636, DIRECT, f08c47fec0942fa0
`

export function GET() {
  return new NextResponse(ADS_TXT, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  })
}
