#!/usr/bin/env node
// polish-audit-sitemap.mjs — sample-checks 200/page from each tenant's sitemap.xml
// to catch routes that 500/404 in the wild.
import * as cheerio from 'cheerio'

const TENANT_HOSTS = [
  'qldtravel.com.au', 'nswtravel.com.au', 'victravel.com.au',
  'watravel.com.au', 'tastravel.net.au', 'nttravel.com.au',
  'satravel.net.au', 'aunztravel.com.au',
]

const SAMPLE_PER_HOST = 60
const CONCURRENCY = 8

async function getStatus(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    return r.status
  } catch { return 0 }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const summary = []
for (const host of TENANT_HOSTS) {
  const xml = await fetch(`https://${host}/sitemap.xml`).then(r => r.text()).catch(() => '')
  const $ = cheerio.load(xml, { xmlMode: true })
  const locs = []
  $('url > loc').each((_, el) => locs.push($(el).text().trim()))
  if (locs.length === 0) {
    console.log(`  ✗ ${host}  no <loc> in sitemap`)
    continue
  }
  const sample = shuffle(locs).slice(0, SAMPLE_PER_HOST)
  const queue = [...sample]
  const fails = []
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const u = queue.shift()
      const s = await getStatus(u)
      if (s === 0 || s >= 400) fails.push({ url: u, status: s })
    }
  }))
  const ok = sample.length - fails.length
  summary.push({ host, total: locs.length, sampled: sample.length, ok, fails })
  console.log(`  ${fails.length === 0 ? '✓' : '⚠'} ${host}  total=${locs.length}  sampled=${sample.length}  ok=${ok}  fail=${fails.length}`)
  for (const f of fails.slice(0, 8)) console.log(`    ⚠ ${f.status}  ${f.url}`)
}

const grandTotal = summary.reduce((a, s) => a + s.sampled, 0)
const grandFails = summary.reduce((a, s) => a + s.fails.length, 0)
console.log(`\n=== ${grandTotal - grandFails}/${grandTotal} sitemap URLs return 200 across all tenants ===`)
