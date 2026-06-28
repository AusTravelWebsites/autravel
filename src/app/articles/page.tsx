import { Metadata } from 'next'
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import type { StateCode } from '@/lib/tenants'

export const revalidate = 600
const PER_PAGE = 24

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa' }

type Article = { slug: string; legacy_path: string | null; title: string; excerpt: string | null; cover_image: string | null; published_at: string | null }

const getArticles = (state: StateCode | null) => unstable_cache(
  async () => {
    return await db<Article[]>`
      SELECT slug, legacy_path, title, excerpt, cover_image, published_at
        FROM articles
       WHERE status = 'published' AND (noindex IS NULL OR noindex = false)
         AND (${state}::text IS NULL OR state_code = ${state}::text)
       ORDER BY published_at DESC NULLS LAST, created_at DESC
       LIMIT 600`
  },
  ['articles-index', state ?? 'all'],
  { revalidate: 600, tags: ['home', `home:${state ?? 'all'}`] }
)()

const href = (a: Article) => a.legacy_path || `/articles/${a.slug}/`
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const url = `https://${tenant.host}/articles/`
  const title = `Articles & Guides — ${tenant.name}`
  const description = `Travel articles, guides and stories from ${tenant.name} covering ${scope}.`
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', images: [tenant.ogImage] },
    twitter: { card: 'summary_large_image', title, description, images: [tenant.ogImage] },
  }
}

export default async function ArticlesIndex({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  const all = await getArticles(state).catch(() => [] as Article[])

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE))
  const cur = Math.min(page, totalPages)
  const items = all.slice((cur - 1) * PER_PAGE, cur * PER_PAGE)

  return (
    <main style={{ background: C.bg, minHeight: '100vh' }}>
      <section style={{ background: 'linear-gradient(135deg,#0f2e2a,#145049)', color: '#fff', padding: '40px 20px 34px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <nav style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>
            <Link href="/" style={{ color: '#fff', textDecoration: 'none' }}>Home</Link> &rsaquo; Articles
          </nav>
          <h1 style={{ fontSize: 'clamp(26px,5vw,40px)', fontWeight: 800, margin: '0 0 10px' }}>Articles &amp; Guides</h1>
          <p style={{ fontSize: 'clamp(15px,2.2vw,17px)', opacity: 0.92, maxWidth: 680, margin: 0, lineHeight: 1.5 }}>
            Stories, guides and practical tips for exploring {scope}. {all.length} articles and counting.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 20px 60px' }}>
        {items.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: C.sub }}>No articles yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 }}>
            {items.map(a => (
              <Link key={a.slug} href={href(a)} style={{ textDecoration: 'none', color: 'inherit', background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {a.cover_image
                  ? <img src={a.cover_image} alt={a.title} loading="lazy" style={{ width: '100%', height: 168, objectFit: 'cover', display: 'block' }} />
                  : <div style={{ height: 168, background: 'linear-gradient(135deg,#ecfdf5,#f0f9ff)' }} />}
                <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fmtDate(a.published_at) && <div style={{ fontSize: 12, color: C.teal, fontWeight: 700 }}>{fmtDate(a.published_at)}</div>}
                  <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{a.title}</div>
                  {a.excerpt && <div style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.excerpt}</div>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 30, flexWrap: 'wrap' }}>
            {cur > 1 && <Link href={`/articles/?page=${cur - 1}`} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>← Previous</Link>}
            <span style={{ fontSize: 14, color: C.sub }}>Page {cur} of {totalPages}</span>
            {cur < totalPages && <Link href={`/articles/?page=${cur + 1}`} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${C.teal}`, background: C.tealLight, color: C.teal, textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>Next →</Link>}
          </div>
        )}
      </section>
    </main>
  )
}
