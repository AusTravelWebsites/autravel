import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'
import { StateCode } from '@/lib/tenants'
import { BookableTours } from '@/components/features/BookableTours'
import { DirectAffiliateCTA } from '@/components/features/DirectAffiliateCTA'
import { ArticleRelated } from '@/components/features/ArticleRelated'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { demoteBodyH1s, processWpShortcodes } from '@/lib/wp-html'

export const revalidate = 600

type Article = {
  id: string
  slug: string
  state_code: string
  legacy_path: string | null
  title: string
  excerpt: string | null
  body_html: string | null
  cover_image: string | null
  categories: string[] | null
  tags: string[] | null
  destination_slug: string | null
  author: string | null
  author_slug: string | null
  published_at: string | null
  noindex: boolean | null
  seo_title: string | null
  seo_description: string | null
  affiliate_links: Record<string, string> | null
}
type AuthorProfile = { slug: string; name: string; role: string | null; bio: string | null; avatar_url: string | null }

async function getArticle(slug: string, state: StateCode | null): Promise<Article | null> {
  try {
    const [row] = await db<Article[]>`
      SELECT * FROM articles
      WHERE slug = ${slug}
        AND status = 'published'
        AND (${state}::text IS NULL OR state_code = ${state}::text)
      LIMIT 1`
    return row || null
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tenant = await getTenant()
  const a = await getArticle(slug, stateFilterValue(tenant))
  if (!a) return { title: 'Article not found' }
  const rawTitle = a.seo_title || a.title
  const title = rawTitle.length > 45 ? rawTitle.slice(0, 42).replace(/\s+\S*$/, '') + '…' : rawTitle
  // Build a meaningful fallback description: excerpt > body sentence > tenant-stub
  const bodyFirstSentence = a.body_html ? String(a.body_html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/).slice(0, 2).join(' ') : ''
  const rawDesc = a.seo_description
    || a.excerpt
    || (bodyFirstSentence && bodyFirstSentence.length > 60 ? bodyFirstSentence : '')
    || `${a.title} — travel guide for ${tenant.stateName} from ${tenant.name}.`
  const desc = rawDesc.length > 155 ? rawDesc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : rawDesc
  const url = `https://${tenant.host}${a.legacy_path || `/articles/${a.slug}/`}`
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    robots: a.noindex ? { index: false, follow: true } : undefined,
    openGraph: { title, description: desc, type: 'article', url, images: a.cover_image ? [a.cover_image] : [] },
    twitter: { card: 'summary_large_image', title, description: desc, images: a.cover_image ? [a.cover_image] : [] },
  }
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488' }

async function getAuthor(slugOrName: { slug: string | null; name: string | null }): Promise<AuthorProfile | null> {
  if (!slugOrName.slug && !slugOrName.name) return null
  try {
    const rows = await db<AuthorProfile[]>`
      SELECT slug, name, role, bio, avatar_url FROM autravel.authors
       WHERE is_active = true AND (slug = ${slugOrName.slug ?? ''} OR name = ${slugOrName.name ?? ''})
       LIMIT 1`
    return rows[0] || null
  } catch { return null }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenant()
  const a = await getArticle(slug, stateFilterValue(tenant))
  if (!a) notFound()
  const author = await getAuthor({ slug: a.author_slug, name: a.author })
  return <ArticleView article={a} tenant={tenant} author={author}/>
}

export function ArticleView({ article: a, tenant, author }: { article: Article; tenant: { host: string; name: string; stateName: string }; author?: AuthorProfile | null }) {
  const canonical = `https://${tenant.host}${a.legacy_path || `/articles/${a.slug}/`}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.excerpt || undefined,
    image: a.cover_image || undefined,
    datePublished: a.published_at || undefined,
    author: a.author ? { '@type': 'Person', name: a.author } : undefined,
    publisher: { '@type': 'Organization', name: tenant.name, logo: { '@type': 'ImageObject', url: `https://${tenant.host}/favicon.ico` } },
    mainEntityOfPage: canonical,
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',     item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Articles', item: `https://${tenant.host}/articles/` },
      { '@type': 'ListItem', position: 3, name: a.title,    item: canonical },
    ],
  }
  const eyebrow = (a.categories || [])[0] || 'Articles'
  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}/>
      <section style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '32px 20px 28px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <Breadcrumbs crumbs={[
              { href: '/', label: 'Home' },
              { href: '/articles/', label: 'Travel articles' },
              { label: a.title.length > 60 ? a.title.slice(0, 57).replace(/\s+\S*$/, '') + '…' : a.title },
            ]}/>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase' as const, fontWeight: 700, marginBottom: 10 }}>{eyebrow}</div>
          <h1 style={{ color: '#fff', fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 'clamp(26px,5vw,40px)', margin: '0 0 10px', lineHeight: 1.15 }}>{a.title}</h1>
          {(a.author || a.published_at) && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
              {a.author && (
                author
                  ? <>By <Link href={`/authors/${author.slug}/`} style={{ color: '#fff', textDecoration: 'underline' }}>{author.name}</Link></>
                  : <>By {a.author}</>
              )}
              {a.author && a.published_at ? ' · ' : ''}
              {a.published_at ? new Date(a.published_at).toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
            </div>
          )}
        </div>
      </section>
      <article style={{ maxWidth: 780, margin: '0 auto', padding: '32px 20px 60px' }}>
        {a.body_html && (
          <div className="article-body" dangerouslySetInnerHTML={{ __html: processWpShortcodes(demoteBodyH1s(a.body_html)) }}/>
        )}
        {a.destination_slug && (
          <div style={{ marginTop: 28, padding: '16px 18px', background: '#f0fdfa', border: '1px solid #a7f3d0', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: '#065f46', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>Destination</div>
            <Link href={`/${a.destination_slug}`} style={{ color: C.teal, fontWeight: 700, textDecoration: 'none', fontSize: 16 }}>
              See the full {a.destination_slug.replace(/-/g, ' ')} guide →
            </Link>
          </div>
        )}

        <DirectAffiliateCTA links={a.affiliate_links}/>
        <BookableTours article={a}/>

        {/* Hub-and-spoke footer: parent destination + sibling articles + parks + tours.
            Renders for EVERY article based on legacy_path / destination_slug, even
            for older WP content that has no structured destination link. */}
        <ArticleRelated article={a}/>

        {(author || a.author) && <AuthorBio author={author} authorName={a.author} tenant={tenant}/>}
      </article>
    </main>
  )
}

function AuthorBio({ author, authorName, tenant }: { author?: AuthorProfile | null; authorName: string | null; tenant: { name: string; stateName: string } }) {
  const name = author?.name || authorName || ''
  const role = author?.role || `${tenant.name} editorial`
  const bio = author?.bio || `${name} writes for ${tenant.name}, covering travel across ${tenant.stateName}.`
  const slug = author?.slug
  const avatar = author?.avatar_url
  const initials = name.split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <aside style={{ marginTop: 32, padding: '20px 22px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {avatar ? (
        <img src={avatar} alt={name} width={56} height={56}
          style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: '#0d9488', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, fontFamily: 'Georgia, serif' }}>
          {initials}
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        {slug ? (
          <Link href={`/authors/${slug}/`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{name}</div>
            <div style={{ fontSize: 12, color: '#0d9488', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>{role}</div>
          </Link>
        ) : (
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{name}</div>
            <div style={{ fontSize: 12, color: '#0d9488', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 }}>{role}</div>
          </div>
        )}
        <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>{bio}</p>
        {slug && (
          <Link href={`/authors/${slug}/`} style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: '#0d9488', fontWeight: 700, textDecoration: 'none' }}>
            More from {name.split(' ')[0]} →
          </Link>
        )}
      </div>
    </aside>
  )
}
