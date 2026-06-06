import { setDefaultResultOrder } from 'node:dns'; setDefaultResultOrder('ipv4first')
import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL, { prepare:false, max:2, connection:{ search_path:'autravel, public' } })
// WP featured images come through as bare upload-relative paths
// ("2026/05/foo.webp"). The wp-content route serves them at
// /wp-content/uploads/<path>, so prefix them. Leave http(s) + already-absolute alone.
const r = await sql`UPDATE articles
  SET cover_image = '/wp-content/uploads/' || cover_image
  WHERE state_code='uk' AND cover_image IS NOT NULL
    AND cover_image NOT LIKE 'http%' AND cover_image NOT LIKE '/%'`
console.log('covers prefixed:', r.count)
const chk = await sql`SELECT count(*) FILTER (WHERE cover_image LIKE '/wp-content/%')::int fixed, count(*) FILTER (WHERE cover_image LIKE 'http%')::int httpc, count(*) FILTER (WHERE cover_image IS NULL)::int nullc FROM articles WHERE state_code='uk'`
console.log(chk[0])
await sql.end()
