import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';

// Render per-request instead of pre-generating at build time. During `next build`,
// parallel pre-renders of many /category pages exhausted the Supabase pooler and
// timed out after 180s → whole build failed. At runtime queries are ~160ms and
// LiteSpeed/Apache cache the HTML between hits.
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

// Hard per-query ceiling. The blog_posts query historically did a seq scan via
// `ILIKE ANY` and could breach the upstream proxy's request window. If a query
// overruns, we render what we have instead of hanging the whole SSR.
const QUERY_TIMEOUT_MS = 3000;
function withTimeout<T>(p: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), QUERY_TIMEOUT_MS)),
  ]);
}

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'#0d9488', tealLight:'#f0fdfa' };

interface Props { params: Promise<{ slug: string[] }> }

// Maps legacy WordPress category slugs (incl. nested e.g. "usa/california-usa") onto
// a keyword we can match against blog_posts.category / country / location_name and tours.country.
function slugToLabel(segments: string[]): { title: string; keywords: string[]; countryHint?: string } {
  const last = segments[segments.length - 1] || '';
  const parent = segments.length > 1 ? segments[segments.length - 2] : '';

  // Hand-mapped edge cases from the 404 list
  const map: Record<string, { title: string; keywords: string[]; countryHint?: string }> = {
    'mexico':          { title: 'Mexico',         keywords: ['mexico'], countryHint: 'mexico' },
    'myanmar':         { title: 'Myanmar',        keywords: ['myanmar', 'burma'], countryHint: 'myanmar' },
    'colombia':        { title: 'Colombia',       keywords: ['colombia'], countryHint: 'colombia' },
    'iran':            { title: 'Iran',           keywords: ['iran'], countryHint: 'iran' },
    'alaska':          { title: 'Alaska, USA',    keywords: ['alaska'], countryHint: 'usa' },
    'italy':           { title: 'Italy',          keywords: ['italy'], countryHint: 'italy' },
    'product-reviews': { title: 'Product Reviews',keywords: ['product', 'review', 'gear'] },
    'california-usa':  { title: 'California, USA',keywords: ['california'], countryHint: 'usa' },
    'california':      { title: 'California, USA',keywords: ['california'], countryHint: 'usa' },
    'louisiana':       { title: 'Louisiana, USA', keywords: ['louisiana'], countryHint: 'usa' },
    'blogs':           { title: 'Blogs',          keywords: [] },
    'bangkok':         { title: 'Bangkok, Thailand', keywords: ['bangkok'], countryHint: 'thailand' },
    'stockholm':       { title: 'Stockholm, Sweden', keywords: ['stockholm'], countryHint: 'sweden' },
    'arizona':         { title: 'Arizona, USA',   keywords: ['arizona'], countryHint: 'usa' },
    'sweden':          { title: 'Sweden',         keywords: ['sweden'], countryHint: 'sweden' },
    'usa':             { title: 'USA',            keywords: ['usa', 'united states'], countryHint: 'usa' },
    'india':           { title: 'India',          keywords: ['india'], countryHint: 'india' },
    'south-america':   { title: 'South America',  keywords: ['south america', 'brazil', 'argentina', 'peru', 'chile', 'colombia', 'bolivia'] },
    'arkansas':        { title: 'Arkansas, USA',  keywords: ['arkansas'], countryHint: 'usa' },
    'canada':          { title: 'Canada',         keywords: ['canada'], countryHint: 'canada' },
    'australia':       { title: 'Australia',      keywords: ['australia'], countryHint: 'australia' },
    'bali':            { title: 'Bali',           keywords: ['bali'], countryHint: 'indonesia' },
    'indonesia':       { title: 'Indonesia',      keywords: ['indonesia', 'bali'], countryHint: 'indonesia' },
    'france':          { title: 'France',         keywords: ['france'], countryHint: 'france' },
    'spain':           { title: 'Spain',          keywords: ['spain'], countryHint: 'spain' },
  };
  if (map[last]) return map[last];

  // Fall back: prettify the slug
  const pretty = last.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
  return { title: pretty, keywords: [last.replace(/-/g, ' ')], countryHint: parent || undefined };
}

// Prerender every mapped slug at build time. Static HTML means category pages
// keep serving even when the Next process is restarting or cold — the single
// biggest cause of the old 500s on /category/australia.
export function generateStaticParams() {
  return [
    ['mexico'], ['myanmar'], ['colombia'], ['iran'], ['alaska'], ['italy'],
    ['product-reviews'], ['california-usa'], ['california'], ['louisiana'],
    ['blogs'], ['bangkok'], ['stockholm'], ['arizona'], ['sweden'], ['usa'],
    ['india'], ['south-america'], ['arkansas'], ['canada'], ['australia'],
    ['bali'], ['indonesia'], ['france'], ['spain'],
    ['usa', 'california'], ['usa', 'california-usa'], ['usa', 'alaska'],
    ['usa', 'louisiana'], ['usa', 'arizona'], ['usa', 'arkansas'],
    ['asia', 'myanmar'], ['asia', 'iran'], ['asia', 'bangkok'],
  ].map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { getTenant, stateFilterValue } = await import('@/lib/get-tenant')
  const tenant = await getTenant()
  const state = stateFilterValue(tenant)
  const path = '/category/' + slug.join('/') + '/'
  const noSlashPath = '/category/' + slug.join('/')
  // Article metadata first (if a migrated WP article lives at this URL)
  try {
    const rows = await db`
      SELECT slug, legacy_path, title, excerpt, cover_image, seo_title, seo_description, noindex
      FROM articles
      WHERE status = 'published'
        AND (${state}::text IS NULL OR state_code = ${state}::text)
        AND legacy_path = ANY(${[path, noSlashPath]}::text[])
      LIMIT 1`
    if (rows[0]) {
      const a = rows[0] as any
      const t = a.seo_title || a.title
      const d = (a.seo_description || a.excerpt || a.title).slice(0, 200)
      return {
        title: t, description: d,
        alternates: { canonical: `https://${tenant.host}${a.legacy_path}` },
        robots: a.noindex ? { index: false, follow: true } : undefined,
        openGraph: { title: t, description: d, type: 'article' as const, images: a.cover_image ? [a.cover_image] : [] },
      }
    }
  } catch {}
  const { title } = slugToLabel(slug)
  const scope = tenant.aggregator ? 'Australia' : tenant.stateName
  return {
    title: `${title} — Travel guides & tours in ${scope}`,
    description: `Travel blog posts, stories and tours about ${title} in ${scope}.`,
    alternates: { canonical: `https://${tenant.host}${path}` },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  // autravel: try the legacy article catch-all first. Migrated WP sites often
  // have /category/<slug>/ pages as first-class articles. Only fall through
  // to the bugbitten-style category aggregator if no article matches.
  {
    const { getTenant, stateFilterValue } = await import('@/lib/get-tenant')
    const { ArticleView } = await import('@/app/articles/[slug]/page')
    const tenant = await getTenant()
    const state = stateFilterValue(tenant)
    const path = '/category/' + slug.join('/') + '/'
    const noSlashPath = '/category/' + slug.join('/')
    try {
      const rows = await db`
        SELECT * FROM articles
        WHERE status = 'published'
          AND (${state}::text IS NULL OR state_code = ${state}::text)
          AND legacy_path = ANY(${[path, noSlashPath]}::text[])
        LIMIT 1`
      if (rows[0]) return <ArticleView article={rows[0] as any} tenant={tenant as any}/>
    } catch {}
  }

  const { title, keywords, countryHint } = slugToLabel(slug);

  // Title-case the hint so both b.country and tours.country can use their btree
  // indexes with exact `=` (sub-200ms) instead of ILIKE substring matching
  // (~1.5s seq scan on blog_posts). This is the main permanent fix.
  const countryExact = countryHint ? countryHint.split(/[\s-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null
  const likePatterns = keywords.length ? keywords.map(k => `%${k}%`) : ['%'];

  // Primary posts query: prefer exact country match (indexed) when we have a
  // mapped countryHint. Only fall back to ILIKE for unmapped slugs, where the
  // table is small enough (~60 posts today) that seq scan is still fine.
  const postsPromise = countryExact
    ? db`
        SELECT b.slug, b.title, b.excerpt, b.featured_image, b.featured_image_alt, b.category,
               b.location_name, b.country, b.published_at, b.reading_minutes,
               u.username, u.display_name
        FROM blog_posts b
        LEFT JOIN users u ON u.id::text = b.user_id
        WHERE b.status = 'published' AND b.country = ${countryExact}
        ORDER BY COALESCE(b.published_at, b.created_at) DESC
        LIMIT 24`.catch(() => [] as any[])
    : db`
        SELECT b.slug, b.title, b.excerpt, b.featured_image, b.featured_image_alt, b.category,
               b.location_name, b.country, b.published_at, b.reading_minutes,
               u.username, u.display_name
        FROM blog_posts b
        LEFT JOIN users u ON u.id::text = b.user_id
        WHERE b.status = 'published'
          AND (
            b.category ILIKE ANY(${likePatterns}::text[])
            OR b.country ILIKE ANY(${likePatterns}::text[])
            OR b.location_name ILIKE ANY(${likePatterns}::text[])
            OR b.title ILIKE ANY(${likePatterns}::text[])
          )
        ORDER BY COALESCE(b.published_at, b.created_at) DESC
        LIMIT 24`.catch(() => [] as any[]);

  const toursPromise = countryExact
    ? db`
        SELECT slug, title, country, city, cover_image, rating, review_count, price_from, currency, duration_label
        FROM tours
        WHERE country = ${countryExact}
        ORDER BY featured DESC, rating DESC NULLS LAST, review_count DESC NULLS LAST
        LIMIT 12`.catch(() => [] as any[])
    : Promise.resolve([] as any[]);

  const fallbackPromise = db`
    SELECT b.slug, b.title, b.excerpt, b.featured_image, b.featured_image_alt, b.category,
           b.location_name, b.country, b.published_at,
           u.username
    FROM blog_posts b
    LEFT JOIN users u ON u.id::text = b.user_id
    WHERE b.status = 'published'
    ORDER BY COALESCE(b.published_at, b.created_at) DESC
    LIMIT 12`.catch(() => [] as any[]);

  const [posts, tours, fallback] = await Promise.all([
    withTimeout(postsPromise, [] as any[]),
    withTimeout(toursPromise, [] as any[]),
    withTimeout(fallbackPromise, [] as any[]),
  ]);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' }) : '';

  const shown = (posts as any[]).length ? (posts as any[]) : (fallback as any[]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: 'linear-gradient(160deg,#0d9488 0%,#0f766e 100%)', padding: '40px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ color: '#cbd5e1', fontSize: 13, marginBottom: 6 }}>
            <Link href="/blog" style={{ color: '#cbd5e1', textDecoration: 'none' }}>Blog</Link> › Category
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>{title}</h1>
          <p style={{ color: '#cbd5e1', margin: 0, fontSize: 15 }}>
            {(posts as any[]).length
              ? `${(posts as any[]).length} post${(posts as any[]).length === 1 ? '' : 's'} about ${title}.`
              : `We're still writing about ${title}. In the meantime, explore the latest from around the world.`}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px' }}>
        {shown.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: 'center' as const, color: C.sub }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>No posts yet for {title}</div>
            <Link href="/blog" style={{ color: C.teal, fontWeight: 600, textDecoration: 'none' }}>Browse all posts →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {shown.map((p: any) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: 'none' }}>
                <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' as const, height: '100%', display: 'flex', flexDirection: 'column' as const }}>
                  {p.featured_image && <img src={p.featured_image} alt={p.featured_image_alt || p.title} loading="lazy" style={{ width: '100%', height: 160, objectFit: 'cover' as const, display: 'block' }} />}
                  <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column' as const }}>
                    {p.category && <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 4 }}>{p.category}</div>}
                    <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: C.text, margin: '0 0 6px', lineHeight: 1.3 }}>{p.title}</h2>
                    {p.excerpt && <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, margin: '0 0 10px', display: '-webkit-box' as any, WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{p.excerpt}</p>}
                    <div style={{ marginTop: 'auto', fontSize: 12, color: C.sub, display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                      {p.username && <><span style={{ color: C.teal, fontWeight: 600 }}>@{p.username}</span><span>·</span></>}
                      <span>{fmt(p.published_at)}</span>
                      {p.location_name && <><span>·</span><span>{p.location_name}</span></>}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {(tours as any[]).length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 14px' }}>Tours & experiences in {title}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {(tours as any[]).map((t: any) => (
                <Link key={t.slug} href={`/tours/${t.slug}`} style={{ textDecoration: 'none' }}>
                  <article style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
                    {t.cover_image && <img src={t.cover_image} alt={t.title} loading="lazy" style={{ width: '100%', height: 140, objectFit: 'cover' as const }} />}
                    <div style={{ padding: '10px 12px' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 6px', lineHeight: 1.3, display: '-webkit-box' as any, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' as const }}>{t.title}</h3>
                      <div style={{ fontSize: 12, color: C.sub }}>
                        {t.city ? `${t.city} · ` : ''}{t.duration_label || ''}
                      </div>
                      {t.price_from && <div style={{ fontSize: 13, color: C.teal, fontWeight: 700, marginTop: 4 }}>From {t.currency || 'USD'} {t.price_from}</div>}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <Link href={`/tours?country=${encodeURIComponent(countryHint || '')}`} style={{ color: C.teal, fontWeight: 600, textDecoration: 'none' }}>See all tours in {title} →</Link>
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, padding: '20px 24px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, display: 'flex', gap: 18, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          <div style={{ fontSize: 14, color: C.sub, flex: '1 1 240px' }}>Looking for something specific? Browse the full blog or explore destinations.</div>
          <Link href="/blog" style={{ background: C.teal, color: '#fff', padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>All posts</Link>
          <Link href="/trips" style={{ background: '#fff', color: C.teal, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none', border: `1.5px solid ${C.teal}` }}>Traveller trips</Link>
        </div>
      </div>
    </div>
  );
}
