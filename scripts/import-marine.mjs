#!/usr/bin/env node
// import-marine.mjs — for every destination, probe the Open-Meteo Marine API.
// If we get usable wave + sea-temp data, mark coastal and store summer/winter
// sea-temp from a 90-day archive sample. Inland destinations are flagged
// is_coastal=false so we skip them at render time.
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const FORCE = process.argv.includes('--force')

async function fetchMarine(lat, lng) {
  // 14-day forecast for current waves; we'll separately call archive for
  // historical sea-temp. Combined endpoint is sufficient as a probe.
  const url = `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${lat}&longitude=${lng}` +
    `&hourly=wave_height,sea_surface_temperature` +
    `&forecast_days=2&past_days=0`
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'autravel/1.0 (team@growthfactory.com.au)' } })
      if (r.ok) return await r.json()
      if (r.status === 429) { await new Promise(s => setTimeout(s, 5000 * attempt)); continue }
      return null
    } catch (e) {
      if (attempt === 4) return null
      await new Promise(s => setTimeout(s, 2000 * attempt))
    }
  }
  return null
}

// Open-Meteo's archive supports sea_surface_temperature back to 1981 for
// coastal grid cells. We sample the trailing year and aggregate by hemisphere
// season (summer = Dec/Jan/Feb in AU; winter = Jun/Jul/Aug).
async function fetchArchiveSst(lat, lng) {
  const today = new Date()
  const end = today.toISOString().slice(0, 10)
  const startDate = new Date(today)
  startDate.setFullYear(startDate.getFullYear() - 1)
  const start = startDate.toISOString().slice(0, 10)
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${start}&end_date=${end}&daily=sea_surface_temperature_mean&timezone=Australia%2FBrisbane`
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'autravel/1.0' } })
      if (r.ok) return await r.json()
      if (r.status === 429) { await new Promise(s => setTimeout(s, 5000 * attempt)); continue }
      return null
    } catch (e) {
      if (attempt === 4) return null
      await new Promise(s => setTimeout(s, 2000 * attempt))
    }
  }
  return null
}

const dests = await sql`
  SELECT id, slug, name, state_code, lat::text, lng::text FROM destinations
  WHERE active = true AND lat IS NOT NULL AND lng IS NOT NULL
  ORDER BY state_code, name
`
console.log(`destinations: ${dests.length}`)

let coastalN = 0, inlandN = 0, failed = 0
for (const d of dests) {
  if (!FORCE) {
    const [chk] = await sql`SELECT 1 FROM destination_marine WHERE destination_id = ${d.id} AND updated_at > now() - interval '180 days' LIMIT 1`
    if (chk) continue
  }
  try {
    const m = await fetchMarine(Number(d.lat), Number(d.lng))
    const waves = m?.hourly?.wave_height || []
    const sst = m?.hourly?.sea_surface_temperature || []
    const validWaves = waves.filter((v) => typeof v === 'number' && !isNaN(v))
    const validSst = sst.filter((v) => typeof v === 'number' && !isNaN(v))
    const isCoastal = validWaves.length > 0 && validSst.length > 0
    let avgWave = null, summer = null, winter = null
    if (isCoastal) {
      avgWave = validWaves.reduce((a, b) => a + b, 0) / validWaves.length
      // archive-based seasonal sst
      const a = await fetchArchiveSst(Number(d.lat), Number(d.lng))
      if (a?.daily?.sea_surface_temperature_mean && a.daily.time) {
        const summerVals = [], winterVals = []
        for (let i = 0; i < a.daily.time.length; i++) {
          const month = parseInt(a.daily.time[i].slice(5, 7), 10)
          const v = a.daily.sea_surface_temperature_mean[i]
          if (typeof v !== 'number' || isNaN(v)) continue
          if ([12, 1, 2].includes(month)) summerVals.push(v)
          else if ([6, 7, 8].includes(month)) winterVals.push(v)
        }
        if (summerVals.length) summer = +(summerVals.reduce((a, b) => a + b, 0) / summerVals.length).toFixed(1)
        if (winterVals.length) winter = +(winterVals.reduce((a, b) => a + b, 0) / winterVals.length).toFixed(1)
      }
      coastalN++
    } else {
      inlandN++
    }
    await sql`
      INSERT INTO destination_marine (destination_id, is_coastal, sea_temp_summer, sea_temp_winter, avg_wave_height_m, sample_at, updated_at)
      VALUES (${d.id}, ${isCoastal}, ${summer}, ${winter}, ${avgWave?.toFixed(2) ?? null}, now(), now())
      ON CONFLICT (destination_id) DO UPDATE SET
        is_coastal = EXCLUDED.is_coastal,
        sea_temp_summer = EXCLUDED.sea_temp_summer,
        sea_temp_winter = EXCLUDED.sea_temp_winter,
        avg_wave_height_m = EXCLUDED.avg_wave_height_m,
        sample_at = EXCLUDED.sample_at,
        updated_at = now()
    `
    if ((coastalN + inlandN) % 20 === 0) console.log(`  ${coastalN + inlandN} done (coastal: ${coastalN}, inland: ${inlandN})`)
    await new Promise(r => setTimeout(r, 2500)) // polite to free marine API
  } catch (e) {
    failed++
    console.log(`  ✗ ${d.state_code}/${d.slug} — ${e.message}`)
  }
}
console.log(`\ncoastal: ${coastalN}, inland: ${inlandN}, failed: ${failed}`)
await sql.end()
