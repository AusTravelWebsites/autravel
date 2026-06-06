import type { MetadataRoute } from 'next'
import { getTenant } from '@/lib/get-tenant'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const tenant = await getTenant()
  const SITE_URL = `https://${tenant.host}`
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/admin/',
          '/settings',
          '/messages',
          '/notifications',
          '/onboarding',
          '/check-in',
          '/feed',
          '/favourites',
          '/friends',
          '/my-reviews',
          '/journal-entries',
          '/auto-meetups',
          '/unsubscribe',
          '/user-data',
          '/reviews/new',
          '/trips/new',
          '/meetups/new',
          '/blog/new',
          '/verify',
          '/delete-request',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
