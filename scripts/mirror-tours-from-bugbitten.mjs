// Nightly mirror of public.tours from the shared bugbitten Supabase project
// into the autravel Supabase project.
//
// Background (2026-06-06): autravel was split off the shared Supabase project
// onto its own (iepxkcgbbwucmibmaljp) to escape pool-starvation outages. The
// Rezdy/Viator importer still runs nightly against the bugbitten project's
// public.tours — this script mirrors any new or updated rows from there to
// autravel's public.tours, while preserving autravel-side AI-curated fields
// (summary_ai, highlights_ai, what_to_expect_ai, good_to_know_ai, ai_*).
//
// Order: bugbitten's importer runs at 03:00 AEST, this runs at 03:30 AEST.

import postgres from 'postgres'

const SRC_URL = process.env.BUGBITTEN_TOURS_SOURCE_URL
const DST_URL = process.env.DATABASE_URL_POOL || process.env.DATABASE_URL

if (!SRC_URL) {
  console.error('[mirror-tours] missing BUGBITTEN_TOURS_SOURCE_URL')
  process.exit(2)
}
if (!DST_URL) {
  console.error('[mirror-tours] missing DATABASE_URL_POOL/DATABASE_URL')
  process.exit(2)
}

const src = postgres(SRC_URL, { ssl: 'require', prepare: false, max: 2, idle_timeout: 8, connect_timeout: 15 })
const dst = postgres(DST_URL, { ssl: 'require', prepare: false, max: 2, idle_timeout: 8, connect_timeout: 15 })

const STARTED = Date.now()
const log = (...a) => console.log(`[mirror-tours ${new Date().toISOString()}]`, ...a)

const COLS = [
  'id','source','source_product_code','slug','title','country','country_code','city',
  'duration_min','duration_label','price_from','currency','rating','review_count',
  'cover_image','images','booking_url','tags',
  'summary_ai','highlights_ai','what_to_expect_ai','good_to_know_ai','ai_rewritten_at','ai_model',
  'source_raw','source_fetched_at','active','featured','created_at','updated_at',
  'category','state_code',
  'supplier_id','supplier_alias','supplier_name','supplier_phone','supplier_website','supplier_timezone'
]

// Columns the mirror should NEVER overwrite on the target if a row already exists.
// These are the autravel-side AI-curated fields plus state_code (autravel may set
// state_code via its own classifier).
const PRESERVE_ON_UPDATE = new Set([
  'summary_ai','highlights_ai','what_to_expect_ai','good_to_know_ai','ai_rewritten_at','ai_model',
  'state_code','featured'
])

try {
  // Watermark: max updated_at on the target, with a 24h overlap to catch any
  // rows that were updated late or out of order.
  const [{ since }] = await dst`
    SELECT COALESCE(MAX(updated_at), NOW() - INTERVAL '90 days') - INTERVAL '24 hours' AS since
      FROM public.tours
  `
  log('since', since)

  const rows = await src`
    SELECT ${src(COLS)}
      FROM public.tours
     WHERE updated_at >= ${since}
  `
  log(`fetched ${rows.length} rows from bugbitten`)

  if (rows.length === 0) { log('no changes — done'); await Promise.all([src.end(), dst.end()]); process.exit(0) }

  // Build SET clause that updates everything EXCEPT preserved cols, and only
  // overrides preserved cols when the target row's value is NULL.
  const setExpr = COLS.filter(c => c !== 'id').map(c => {
    if (PRESERVE_ON_UPDATE.has(c)) {
      return `${c} = COALESCE(public.tours.${c}, EXCLUDED.${c})`
    }
    return `${c} = EXCLUDED.${c}`
  }).join(', ')

  // Batch in chunks of 200 to keep memory bounded
  const BATCH = 200
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await dst.unsafe(
      `INSERT INTO public.tours (${COLS.join(',')})
       VALUES ${batch.map((_, j) => `(${COLS.map((_, k) => `$${i*0 + j*COLS.length + k + 1}`).join(',')})`).join(',')}
       ON CONFLICT (id) DO UPDATE SET ${setExpr}`,
      batch.flatMap(r => COLS.map(c => r[c]))
    )
    upserted += batch.length
    log(`upserted ${upserted}/${rows.length}`)
  }

  const tookMs = Date.now() - STARTED
  log(`done — ${upserted} rows in ${(tookMs/1000).toFixed(1)}s`)
} catch (e) {
  console.error('[mirror-tours] FAILED', e)
  process.exit(1)
} finally {
  await Promise.all([src.end({ timeout: 5 }), dst.end({ timeout: 5 })])
}
