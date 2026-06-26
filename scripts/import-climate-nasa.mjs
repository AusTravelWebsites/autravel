#!/usr/bin/env node
// import-climate-nasa.mjs — fallback climate filler using NASA POWER
// (free, unlimited, no key). Fills any destination missing climate normals
// from Open-Meteo's rate-limited archive API.
//
// NASA POWER returns monthly climatological means directly:
//   T2M_MAX   — daily max temp (°C)
//   T2M_MIN   — daily min temp (°C)
//   PRECTOTCORR — precipitation (mm/day)        → ×30 for monthly mm
//   ALLSKY_SFC_SW_DWN — solar irradiance (kWh/m²/day) → ÷6 ≈ sunny-day proxy
import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config({ path: '/var/www/autravel/.env.local' })

const sql = postgres(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL, {
  prepare: false, ssl: /@(127\.0\.0\.1|localhost)\b/.test(process.env.DATABASE_URL_POOL || process.env.DATABASE_URL || '') ? false : 'require', max: 2, connection: { search_path: 'autravel, public' }
})

const FORCE = process.argv.includes('--force')
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const DAYS_IN = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

async function fetchPower(lat, lng) {
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=RE&longitude=${lng}&latitude=${lat}&format=JSON`
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'autravel/1.0 (team@growthfactory.com.au)' } })
      if (r.ok) return await r.json()
      if (r.status >= 500 || r.status === 429) {
        await new Promise(s => setTimeout(s, 2000 * attempt))
        continue
      }
      return null
    } catch (e) {
      if (attempt === 4) return null
      await new Promise(s => setTimeout(s, 1500 * attempt))
    }
  }
  return null
}

// Find destinations missing climate
const missing = await sql`
  SELECT d.id, d.slug, d.name, d.state_code, d.lat::text, d.lng::text
  FROM destinations d
  LEFT JOIN destination_climate c ON c.destination_id = d.id
  WHERE d.active AND d.lat IS NOT NULL AND d.lng IS NOT NULL
    AND c.destination_id IS NULL
  ORDER BY d.state_code, d.name
`
console.log(`destinations missing climate: ${missing.length}`)

let processed = 0, failed = 0
for (const d of missing) {
  try {
    const data = await fetchPower(Number(d.lat), Number(d.lng))
    const params = data?.properties?.parameter
    if (!params) { failed++; console.log(`  ✗ ${d.state_code}/${d.slug} — no data`); continue }
    const tmax = params.T2M_MAX, tmin = params.T2M_MIN, rain = params.PRECTOTCORR, sun = params.ALLSKY_SFC_SW_DWN
    if (!tmax || !tmin || !rain) { failed++; console.log(`  ✗ ${d.state_code}/${d.slug} — partial`); continue }

    await sql`DELETE FROM destination_climate WHERE destination_id = ${d.id}`
    for (let m = 0; m < 12; m++) {
      const code = MONTHS[m]
      const tx = tmax[code], tn = tmin[code], rn = rain[code], sn = sun?.[code]
      // skip months with sentinel -999 values (NASA POWER missing-data marker)
      if (tx <= -100 || tn <= -100 || rn < 0) continue
      const monthlyRainMm = +(rn * DAYS_IN[m]).toFixed(1)
      // very rough: rain-days = clamp(monthlyRain / 4mm-per-rainday, 0..days)
      const rainDays = Math.min(DAYS_IN[m], Math.max(0, +(monthlyRainMm / 4).toFixed(1)))
      // sunny-days proxy: assume sun ≥6 kWh/m²/day → mostly sunny
      let sunnyDays = null
      if (typeof sn === 'number' && sn > 0) {
        // map 0-8 kWh range to 0-Days, with 6+ kWh ≈ full sunny days
        sunnyDays = +Math.min(DAYS_IN[m], DAYS_IN[m] * (sn / 7)).toFixed(1)
      }
      await sql`
        INSERT INTO destination_climate (destination_id, month, temp_max_mean, temp_min_mean, rain_mm, rain_days, sunny_days, sample_years)
        VALUES (${d.id}, ${m + 1}, ${tx.toFixed(2)}, ${tn.toFixed(2)}, ${monthlyRainMm}, ${rainDays}, ${sunnyDays}, 30)
      `
    }
    processed++
    if (processed % 10 === 0) console.log(`  ${processed} done…`)
    await new Promise(r => setTimeout(r, 250))
  } catch (e) {
    failed++
    console.log(`  ✗ ${d.state_code}/${d.slug} — ${e.message}`)
  }
}
console.log(`\n${processed} processed, ${failed} failed`)
await sql.end()
