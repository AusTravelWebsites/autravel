#!/usr/bin/env node
/**
 * Daily 404 monitor for qldtravel.com.au.
 *
 * Queries autravel.redirect_404s for hits in the last 24 hours, filters out
 * noise, tests each surviving path against the live site, and writes:
 *   - One detailed report per run:   /root/qld-404-monitor/YYYY-MM-DD.md
 *   - A one-line rolling summary:    /root/qld-404-monitor/summary.log
 *
 * Self-stops after END_DATE — script exits silently past that point so the
 * cron entry can be left inert until cleanup.
 */
import postgres from 'postgres'
import { config as dotenv } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'

const END_DATE = '2026-06-17' // 30 days from 2026-05-18; auto-stop after this
const TENANT_HOST = 'www.qldtravel.com.au'
const REPORT_DIR = '/root/qld-404-monitor'

const now = new Date()
const today = now.toISOString().slice(0, 10)

if (today > END_DATE) {
  // Past the monitoring window — exit silently. Cron entry can be removed.
  process.exit(0)
}

dotenv({ path: resolve('/var/www/autravel/.env.local') })
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' })

mkdirSync(REPORT_DIR, { recursive: true })
const reportPath = `${REPORT_DIR}/${today}.md`
const summaryPath = `${REPORT_DIR}/summary.log`

// Filter patterns — bot scanning / system probes, not real content backlinks.
const noiseRegex = /^(\/_next|\/wp-admin|\/wp-login|\/\.env|\/\.well-known|\/login|\/xmlrpc|\/cgi-bin|\/api\/|\/[a-z0-9-]+\.php)/i

const rows = await sql`
  SELECT path, hit_count, referrer, last_seen_at
  FROM autravel.redirect_404s
  WHERE state_code='qld'
    AND last_seen_at >= now() - interval '24 hours'
  ORDER BY hit_count DESC
  LIMIT 500
`

// Filter noise + already-resolving paths.
const candidates = rows.filter((r) => !noiseRegex.test(r.path))

const tested = []
for (const r of candidates) {
  try {
    const res = await fetch(`https://${TENANT_HOST}${r.path}`, { redirect: 'follow', signal: AbortSignal.timeout(8000) })
    tested.push({ ...r, status: res.status, finalUrl: res.url })
  } catch (e) {
    tested.push({ ...r, status: 0, finalUrl: '', error: String(e.message || e) })
  }
}

const stillBroken = tested.filter((t) => t.status >= 400 || t.status === 0)
const newFixes = tested.filter((t) => t.status === 200) // were 404, now resolve — historical accumulator
const highPriority = stillBroken.filter((t) => t.hit_count >= 3)
const top10Broken = stillBroken.slice(0, 10)

// Build report
let report = `# qldtravel 404 monitor — ${today}\n\n`
report += `**Run at:** ${now.toISOString()}\n`
report += `**Window:** last 24h\n`
report += `**Total paths logged:** ${rows.length} (after noise filter: ${candidates.length})\n`
report += `**Still 404:** ${stillBroken.length}\n`
report += `**Now resolving:** ${newFixes.length} (historical 404s that have since been fixed)\n\n`

if (highPriority.length) {
  report += `## High priority — still 404 with ≥3 hits\n\n`
  report += `| Path | Hits | Last seen | Referrer |\n|---|---|---|---|\n`
  for (const r of highPriority) {
    const ref = (r.referrer || '').slice(0, 80).replace(/\|/g, '\\|')
    report += `| \`${r.path}\` | ${r.hit_count} | ${r.last_seen_at.toISOString().slice(0,16).replace('T',' ')} | ${ref} |\n`
  }
  report += `\n`
} else {
  report += `## High priority\n\nNone — no still-404 paths with ≥3 hits in last 24h.\n\n`
}

if (top10Broken.length) {
  report += `## Top still-404 paths (last 24h)\n\n`
  report += `| # | Path | Hits | Status |\n|---|---|---|---|\n`
  top10Broken.forEach((r, i) => {
    report += `| ${i+1} | \`${r.path}\` | ${r.hit_count} | ${r.status} |\n`
  })
  report += `\n`
}

if (rows.length === 0) {
  report += `## No 404s logged in last 24h\n\nEither traffic is low or all paths are resolving. Nothing to do.\n`
}

writeFileSync(reportPath, report)

// One-line summary for the rolling log
const summary = `${today}  logged=${rows.length}  candidates=${candidates.length}  still_404=${stillBroken.length}  high_priority=${highPriority.length}`
appendFileSync(summaryPath, summary + '\n')

console.log(summary)
console.log(`Report: ${reportPath}`)

await sql.end()
