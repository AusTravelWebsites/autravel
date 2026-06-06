import type { MetadataRoute } from 'next'
import { getTenant } from '@/lib/get-tenant'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tenant = await getTenant()
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  return {
    name: `${tenant.name} — Tours, caravan parks & destination guides for ${scope}`,
    short_name: tenant.name,
    description: tenant.tagline,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f3f4f6',
    theme_color: '#0d9488',
    lang: 'en-AU',
    categories: ['travel', 'lifestyle'],
    icons: [
      { src: '/brand/logo.webp?v=2', sizes: '192x192', type: 'image/webp', purpose: 'any' },
      { src: '/brand/logo.webp?v=2', sizes: '512x512', type: 'image/webp', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Destinations', short_name: 'Destinations', url: '/destinations/' },
      { name: 'Caravan parks', short_name: 'Parks', url: '/parks/' },
      { name: 'Tours', short_name: 'Tours', url: '/tours/' },
    ],
  }
}
