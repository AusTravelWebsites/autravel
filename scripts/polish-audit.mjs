#!/usr/bin/env node
// polish-audit.mjs — crawl every tenant's key routes and report UX/SEO issues.
import * as cheerio from 'cheerio'

const TENANTS = [
  'qldtravel.com.au',  'nswtravel.com.au',  'victravel.com.au',  'nttravel.com.au',
  'watravel.com.au',   'satravel.net.au',   'tastravel.net.au',  'aunztravel.com.au',
]
const ROUTES = ['/', '/destinations/', '/parks/', '/tours/', '/about/', '/privacy/', '/terms/', '/cookies/']

async function check(url) {
  try {
    const r = await fetch(url, { redirect: 'follow' })
    const text = await r.text()
    const $ = cheerio.load(text)
    const issues = []
    if (r.status !== 200) issues.push('status=' + r.status)
    if (!$('title').text()) issues.push('no <title>')
    if (!$('meta[name="description"]').attr('content')) issues.push('no meta desc')
    if (!$('link[rel="canonical"]').attr('href')) issues.push('no canonical')
    if (!$('meta[property="og:image"]').attr('content')) issues.push('no og:image')
    if (!$('h1').first().text()) issues.push('no h1')
    if (text.length < 10000) issues.push('tiny=' + text.length)
    const bodyText = $('body').text()
    const bb = (bodyText.match(/BugBitten/g) || []).length
    if (bb > 0) issues.push('BugBitten×' + bb)
    // Images count
    const imgs = $('img').toArray().map(e => $(e).attr('src')).filter(Boolean)
    // Relative/broken image heuristic
    const suspicious = imgs.filter(s => !/^https?:\/\//i.test(s) && !s.startsWith('/') && !s.startsWith('data:'))
    if (suspicious.length) issues.push('rel-imgs=' + suspicious.length)
    return { status: r.status, title: $('title').text().trim(), h1: $('h1').first().text().trim(), size: text.length, imgs: imgs.length, issues }
  } catch (e) { return { error: e.message } }
}

for (const host of TENANTS) {
  console.log('\n== ' + host + ' ==')
  for (const path of ROUTES) {
    const res = await check('https://' + host + path)
    if (res.error) { console.log('  ERR ' + path + ': ' + res.error); continue }
    const mark = res.issues.length === 0 ? '✓' : '⚠'
    const note = res.issues.length ? ' [' + res.issues.join(', ') + ']' : ''
    console.log('  ' + mark + ' ' + res.status + ' ' + path.padEnd(18) + ' imgs=' + String(res.imgs).padStart(2) + note)
  }
}
