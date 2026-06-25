import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'

export const revalidate = 600

type Author = {
  slug: string; name: string; role: string | null; bio: string | null
  avatar_url: string | null; email: string | null; twitter: string | null
  instagram: string | null; website: string | null
}
type ArticleListing = { slug: string; legacy_path: string | null; title: string; excerpt: string | null; cover_image: string | null; published_at: string | null }

async function loadAuthor(slug: string): Promise<Author | null> {
  const rows = await db<Author[]>`
    SELECT slug, name, role, bio, avatar_url, email, twitter, instagram, website
      FROM autravel.authors WHERE slug = ${slug} AND is_active = true LIMIT 1`
  return rows[0] || null
}

async function loadArticles(slug: string, name: string, state: string | null): Promise<ArticleListing[]> {
  // Match either the structured author_slug FK or the legacy `author` text — so
  // articles bylined before the authors table existed still appear in the list.
  return db<ArticleListing[]>`
    SELECT slug, legacy_path, title, excerpt, cover_image, published_at
      FROM articles
     WHERE status = 'published'
       AND (author_slug = ${slug} OR author = ${name})
       AND (${state}::text IS NULL OR state_code = ${state}::text)
     ORDER BY published_at DESC NULLS LAST LIMIT 30`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const a = await loadAuthor(slug)
  const tenant = await getTenant()
  if (!a) return { title: 'Author not found' }
  const desc = a.bio ? a.bio.slice(0, 160) : `${a.name} writes for ${tenant.name}.`
  const url = `https://${tenant.host}/authors/${slug}/`
  return {
    title: `${a.name} — ${tenant.name}`,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: `${a.name} — ${tenant.name}`, description: desc, url, type: 'profile', images: a.avatar_url ? [a.avatar_url] : [tenant.ogImage] },
    twitter: { card: 'summary_large_image', title: `${a.name} — ${tenant.name}`, description: desc, images: [a.avatar_url || tenant.ogImage] },
  }
}

export default async function AuthorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const a = await loadAuthor(slug)
  if (!a) notFound()
  const articles = await loadArticles(slug, a.name, state)
  const initials = a.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <section style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 20px 28px' }}>
          <Link href="/authors/" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>← Team</Link>
          <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', marginTop: 14, flexWrap: 'wrap' as const }}>
            {a.avatar_url ? (
              <img src={a.avatar_url} alt={a.name} width={120} height={120}
                style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover' as const, border: '3px solid #fff', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }} />
            ) : (
              <div aria-hidden="true"
                style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--brand)', color: '#fff',
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
                         fontSize: 44, fontWeight: 800, fontFamily: 'Georgia, serif',
                         border: '3px solid #fff', boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
                {initials}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 280 }}>
              <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px,4vw,38px)', fontWeight: 800, color: '#111827', margin: '4px 0 6px', lineHeight: 1.15 }}>{a.name}</h1>
              {a.role && <div style={{ color: 'var(--brand)', fontWeight: 700, fontSize: 15 }}>{a.role} · {tenant.name}</div>}
              {a.bio && <p style={{ color: '#374151', fontSize: 16, lineHeight: 1.6, margin: '12px 0 0', maxWidth: 720 }}>{a.bio}</p>}
              <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' as const, fontSize: 14, fontWeight: 600 }}>
                {a.website && <a href={a.website} target="_blank" rel="noopener me" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Website</a>}
                {a.twitter && <a href={`https://twitter.com/${a.twitter.replace(/^@/, '')}`} target="_blank" rel="noopener me" style={{ color: 'var(--brand)', textDecoration: 'none' }}>X / Twitter</a>}
                {a.instagram && <a href={`https://instagram.com/${a.instagram.replace(/^@/, '')}`} target="_blank" rel="noopener me" style={{ color: 'var(--brand)', textDecoration: 'none' }}>Instagram</a>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: '32px 20px 56px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 18px' }}>
            {articles.length === 0 ? `${a.name} hasn't published on ${tenant.name} yet.` : `Articles by ${a.name}`}
          </h2>
          {articles.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
              {articles.map(art => {
                const href = art.legacy_path || `/articles/${art.slug}/`
                return (
                  <Link key={art.slug} href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <article style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' as const, height: '100%' }}>
                      <div style={{ aspectRatio: '16/10', background: '#f1f5f9' }}>
                        {art.cover_image && <img src={art.cover_image} alt={art.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }} />}
                      </div>
                      <div style={{ padding: '12px 14px' }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827', lineHeight: 1.3 }}>{art.title}</h3>
                        {art.excerpt && <p style={{ fontSize: 13, color: '#6b7280', margin: '6px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{art.excerpt.slice(0, 140)}</p>}
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Person',
        name: a.name, jobTitle: a.role || undefined, description: a.bio || undefined,
        image: a.avatar_url || undefined,
        url: `https://${tenant.host}/authors/${slug}/`,
        worksFor: { '@type': 'Organization', name: tenant.name, url: `https://${tenant.host}` },
        sameAs: [a.website, a.twitter ? `https://twitter.com/${a.twitter.replace(/^@/, '')}` : null, a.instagram ? `https://instagram.com/${a.instagram.replace(/^@/, '')}` : null].filter(Boolean),
      }) }} />
    </main>
  )
}
