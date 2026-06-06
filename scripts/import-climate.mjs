#!/usr/bin/env node
// import-climate.mjs — fetch 1991–2020 monthly climate normals for every
// active destination from Open-Meteo's archive API and store in destination_climate.
// One call per destination, ~30s for ~100 destinations. Idempotent — skip rows
// updated within the last 90 days unless --force is passed.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const FORCE = process.argv.includes('--force')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || null
const START = '1991-01-01'
const END = '2020-12-31'
const STATE_TZ = {
  qld: 'Australia/Brisbane', nsw: 'Australia/Sydney', vic: 'Australia/Melbourne',
  wa: 'Australia/Perth', sa: 'Australia/Adelaide', tas: 'Australia/Hobart',
  nt: 'Australia/Darwin', aunz: 'Australia/Sydney',
}

async function fetchClimate(lat, lng, tz) {
  const url = `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${lat}&longitude=${lng}` +
    `&start_date=${START}&end_date=${END}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,sunshine_duration` +
    `&timezone=${encodeURIComponent(tz)}`
  let lastErr = null
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const r = await fetch(url)
      if (r.ok) return await r.json()
      if (r.status === 429) {
        lastErr = new Error('429 rate limit')
        // exponential back-off: 5s, 15s, 35s, 75s
        await new Promise(r => setTimeout(r, 5000 * Math.pow(2, attempt - 1) - 5000 + 5000))
        continue
      }
      lastErr = new Error(`open-meteo ${r.status}`)
      if (r.status >= 500) { await new Promise(r => setTimeout(r, 3000 * attempt)); continue }
      throw lastErr
    } catch (e) {
      lastErr = e
      if (attempt === 5) throw lastErr
      await new Promise(r => setTimeout(r, 2000 * attempt))
    }
  }
  throw lastErr || new Error('unknown fetch error')
}

function aggregate(daily) {
  // daily.time: ISO date strings; reduce to per-month means / sums averaged across years.
  const buckets = Array.from({ length: 12 }, () => ({
    tmaxSum: 0, tmaxN: 0, tminSum: 0, tminN: 0,
    rainSum: 0, rainN: 0, rainDays: 0, sunSecSum: 0, sunN: 0,
  }))
  // also track per-(year,month) totals to compute rain-days / sunshine-mean
  const ym = {}
  for (let i = 0; i < daily.time.length; i++) {
    const d = daily.time[i]
    const m = parseInt(d.slice(5, 7), 10) - 1
    const y = parseInt(d.slice(0, 4), 10)
    const tmax = daily.temperature_2m_max[i]
    const tmin = daily.temperature_2m_min[i]
    const rain = daily.precipitation_sum[i]
    const sun = daily.sunshine_duration[i]
    const k = `${y}-${m}`
    ym[k] ||= { rainDays: 0, rainSum: 0, sunSec: 0, sunDays: 0 }
    if (tmax !== null && !isNaN(tmax)) { buckets[m].tmaxSum += tmax; buckets[m].tmaxN++ }
    if (tmin !== null && !isNaN(tmin)) { buckets[m].tminSum += tmin; buckets[m].tminN++ }
    if (rain !== null && !isNaN(rain)) {
      ym[k].rainSum += rain
      if (rain >= 1.0) ym[k].rainDays++ // count rain-day if ≥1mm
    }
    if (sun !== null && !isNaN(sun)) {
      ym[k].sunSec += sun
      if (sun >= 6 * 3600) ym[k].sunDays++ // count sunny-day if ≥6h direct sunshine
    }
  }
  // collapse ym → month
  const monthRain = Array.from({ length: 12 }, () => ({ sum: 0, days: 0, n: 0 }))
  const monthSun = Array.from({ length: 12 }, () => ({ sumSec: 0, days: 0, n: 0 }))
  for (const k of Object.keys(ym)) {
    const m = parseInt(k.split('-')[1], 10)
    monthRain[m].sum += ym[k].rainSum
    monthRain[m].days += ym[k].rainDays
    monthRain[m].n++
    monthSun[m].sumSec += ym[k].sunSec
    monthSun[m].days += ym[k].sunDays
    monthSun[m].n++
  }
  return Array.from({ length: 12 }, (_, m) => {
    const b = buckets[m]
    const r = monthRain[m]
    const s = monthSun[m]
    return {
      month: m + 1,
      temp_max_mean: b.tmaxN ? +(b.tmaxSum / b.tmaxN).toFixed(2) : null,
      temp_min_mean: b.tminN ? +(b.tminSum / b.tminN).toFixed(2) : null,
      rain_mm:       r.n    ? +(r.sum / r.n).toFixed(1)        : null,
      rain_days:     r.n    ? +(r.days / r.n).toFixed(1)       : null,
      sunny_days:    s.n    ? +(s.days / s.n).toFixed(1)       : null,
      sample_years:  r.n,
    }
  })
}

const dests = await sql`
  SELECT id, slug, name, state_code, lat, lng FROM destinations
  WHERE active = true AND lat IS NOT NULL AND lng IS NOT NULL
  ORDER BY state_code, name
`
console.log(`destinations: ${dests.length}`)

let processed = 0, skipped = 0, failed = 0
for (const d of dests) {
  if (LIMIT && processed >= LIMIT) break
  if (!FORCE) {
    const [chk] = await sql`SELECT 1 FROM destination_climate WHERE destination_id = ${d.id} AND updated_at > now() - interval '90 days' LIMIT 1`
    if (chk) { skipped++; continue }
  }
  const tz = STATE_TZ[d.state_code] || 'Australia/Sydney'
  try {
    const data = await fetchClimate(d.lat, d.lng, tz)
    const months = aggregate(data.daily)
    await sql`DELETE FROM destination_climate WHERE destination_id = ${d.id}`
    for (const m of months) {
      await sql`
        INSERT INTO destination_climate
          (destination_id, month, temp_max_mean, temp_min_mean, rain_mm, rain_days, sunny_days, sample_years)
        VALUES (${d.id}, ${m.month}, ${m.temp_max_mean}, ${m.temp_min_mean}, ${m.rain_mm}, ${m.rain_days}, ${m.sunny_days}, ${m.sample_years})
      `
    }
    processed++
    if (processed % 10 === 0) console.log(`  ${processed} done…`)
    await new Promise(r => setTimeout(r, 1500)) // be polite to free API (avoids 429s on bulk runs)
  } catch (e) {
    failed++
    console.log(`  ✗ ${d.state_code}/${d.slug} — ${e.message}`)
  }
}

console.log(`\n${processed} processed, ${skipped} skipped (cached), ${failed} failed`)
await sql.end()
