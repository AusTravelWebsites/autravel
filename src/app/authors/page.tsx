import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getTenant, stateFilterValue } from '@/lib/get-tenant'

export const revalidate = 600

type Author = { slug: string; name: string; role: string | null; bio: string | null; avatar_url: string | null }
type CountRow = { slug: string; c: number }

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488' }

async function loadTeam(stateCode: string | null): Promise<Author[]> {
  // Visible-on-this-tenant: state_codes empty (= all) OR state_codes contains our tenant.
  if (!stateCode) {
    return db<Author[]>`SELECT slug, name, role, bio, avatar_url FROM autravel.authors WHERE is_active = true ORDER BY display_order, name`
  }
  return db<Author[]>`
    SELECT slug, name, role, bio, avatar_url FROM autravel.authors
     WHERE is_active = true
       AND (cardinality(state_codes) = 0 OR ${stateCode}::text = ANY(state_codes))
     ORDER BY display_order, name`
}

async function loadCounts(slugs: string[], names: string[], state: string | null): Promise<Record<string, number>> {
  if (slugs.length === 0) return {}
  const rows = await db<CountRow[]>`
    SELECT COALESCE(author_slug, lookup.slug) AS slug, COUNT(*)::int AS c
      FROM articles
      JOIN (SELECT unnest(${slugs}::text[]) AS slug, unnest(${names}::text[]) AS name) AS lookup
        ON (articles.author_slug = lookup.slug OR articles.author = lookup.name)
     WHERE status = 'published'
       AND (${state}::text IS NULL OR state_code = ${state}::text)
     GROUP BY COALESCE(author_slug, lookup.slug)`
  return Object.fromEntries(rows.map(r => [r.slug, r.c]))
}

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()
  const title = `The ${tenant.name} team`
  const desc = `Meet the writers behind ${tenant.name} — the small team picking the tours, parks, destinations and articles you read here.`
  const url = `https://${tenant.host}/authors/`
  return {
    title, description: desc,
    alternates: { canonical: url },
    openGraph: { title, description: desc, type: 'website', url, images: [{ url: tenant.ogImage, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description: desc, images: [tenant.ogImage] },
  }
}

export default async function AuthorsIndex() {
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const team = await loadTeam(state)
  const counts = await loadCounts(team.map(t => t.slug), team.map(t => t.name), state)

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',    item: `https://${tenant.host}/` },
      { '@type': 'ListItem', position: 2, name: 'Authors', item: `https://${tenant.host}/authors/` },
    ],
  }

  return (
    <main style={{ minHeight: '100vh', background: C.bg }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}/>
      <section style={{ background: 'linear-gradient(135deg,#0d9488 0%,#065f46 100%)', padding: '40px 20px 32px', textAlign: 'center' as const }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 10 }}>The team</div>
          <h1 style={{ color: '#fff', fontSize: 'clamp(26px,5vw,38px)', fontWeight: 800, margin: '0 0 10px', fontFamily: 'Georgia, serif' }}>The {tenant.name} team</h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, margin: '0 auto', lineHeight: 1.55, maxWidth: 600 }}>
            Meet the writers behind {tenant.name}.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 60px' }}>
        {team.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32, textAlign: 'center' as const, color: C.sub }}>
            No team members yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {team.map(t => {
              const initials = t.name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
              const articleCount = counts[t.slug] || 0
              return (
                <Link key={t.slug} href={`/authors/${t.slug}/`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '22px 24px', height: '100%' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10 }}>
                      {t.avatar_url ? (
                        <img src={t.avatar_url} alt={t.name} width={56} height={56}
                          style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' as const }} />
                      ) : (
                        <div aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: C.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, fontFamily: 'Georgia, serif' }}>
                          {initials}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>{t.name}</div>
                        {t.role && <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{t.role}</div>}
                      </div>
                    </div>
                    {t.bio && <p style={{ fontSize: 14, color: C.sub, margin: 0, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 4 as any, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{t.bio}</p>}
                    {articleCount > 0 && <div style={{ fontSize: 12, color: C.teal, fontWeight: 700, marginTop: 10 }}>{articleCount} article{articleCount === 1 ? '' : 's'} →</div>}
                  </article>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
