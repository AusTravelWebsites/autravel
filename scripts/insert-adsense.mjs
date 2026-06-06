import 'dotenv/config'
import postgres from 'postgres'
import { setDefaultResultOrder } from 'dns'

setDefaultResultOrder('ipv4first')

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  ssl: 'require',
  prepare: false,
  connection: { search_path: 'autravel, public' },
})

const SNIPPET = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4240720052276636" crossorigin="anonymous"></script>`
const NAME = 'Google AdSense (pub-4240720052276636)'

const tenants = ['qld', 'nsw', 'vic']

for (const state of tenants) {
  const existing = await sql`
    SELECT id FROM site_snippets
    WHERE state_code = ${state} AND location = 'head' AND name = ${NAME}`
  if (existing.length) {
    await sql`
      UPDATE site_snippets
      SET code = ${SNIPPET}, is_active = true, updated_at = NOW()
      WHERE id = ${existing[0].id}`
    console.log(`updated ${state}: ${existing[0].id}`)
  } else {
    const inserted = await sql`
      INSERT INTO site_snippets (name, state_code, location, code, is_active)
      VALUES (${NAME}, ${state}, 'head', ${SNIPPET}, true)
      RETURNING id`
    console.log(`inserted ${state}: ${inserted[0].id}`)
  }
}

await sql.end()
