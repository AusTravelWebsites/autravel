import postgres from 'postgres'

const DB = process.env.DATABASE_URL_POOL || process.env.DATABASE_URL
const sql = postgres(DB, { prepare: false, ssl: 'require', connection: { search_path: 'autravel, public' } })

const ALIASES = {
  'gold-coast': ['surfers paradise', 'coolangatta', 'broadbeach', 'burleigh'],
  'great-barrier-reef': ['barrier reef', 'ribbon reef'],
  'whitsundays': ['hamilton island', 'airlie', 'whitehaven', 'hayman'],
  'fraser-island': ['kgari'],
  'atherton-tablelands': ['tablelands', 'atherton', 'kuranda'],
  'uluru': ['ayers rock', 'ayres rock', 'red centre'],
  'kakadu': ['jabiru'],
  'cradle-mountain': ['lake st clair', 'overland track'],
  'freycinet': ['wineglass bay', 'coles bay'],
  'port-arthur': ['tasman peninsula'],
  'exmouth-ningaloo': ['ningaloo', 'exmouth', 'coral bay'],
  'margaret-river': [],
  'rottnest-island': ['rottnest', 'quokka'],
  'barossa-valley': ['barossa'],
  'kangaroo-island': ['remarkable rocks', 'seal bay'],
  'mornington-peninsula': ['mornington'],
  'yarra-valley': ['healesville'],
  'hunter-valley': ['hunter region'],
  'blue-mountains': ['three sisters', 'katoomba', 'leura'],
  'great-ocean-road': ['twelve apostles'],
  'byron-bay': ['byron'],
  'snowy-mountains': ['thredbo', 'perisher', 'kosciuszko'],
  'jervis-bay': ['hyams beach', 'booderee'],
}

let added = 0
for (const [slug, keywords] of Object.entries(ALIASES)) {
  for (const kw of keywords) {
    const r = await sql`UPDATE articles
      SET destination_slug = ${slug}, updated_at = NOW()
      WHERE destination_slug IS NULL
        AND status = 'published'
        AND state_code IN (SELECT state_code FROM destinations WHERE slug = ${slug})
        AND (title ILIKE '%' || ${kw} || '%' OR excerpt ILIKE '%' || ${kw} || '%')
      RETURNING 1`
    if (r.count) added += r.count
  }
}
console.log('alias-match linked:', added)
const [c] = await sql`SELECT COUNT(*)::int AS n FROM articles WHERE destination_slug IS NOT NULL AND status='published'`
const [t] = await sql`SELECT COUNT(*)::int AS n FROM articles WHERE status='published'`
console.log('total destination-linked:', c.n, '/', t.n, '(' + Math.round(c.n/t.n*100) + '%)')
await sql.end()
