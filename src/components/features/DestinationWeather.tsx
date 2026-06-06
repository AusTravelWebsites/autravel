'use client'
import { useEffect, useState } from 'react'

type Daily = { date: string; tmax: number; tmin: number; rain: number; code: number }

const ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '❄️',
  80: '🌧️', 81: '🌧️', 82: '⛈️', 95: '⛈️', 96: '⛈️', 99: '⛈️',
}
const LABELS: Record<number, string> = {
  0: 'Clear', 1: 'Mostly sunny', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Foggy',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Storms', 96: 'Storms with hail', 99: 'Storms with hail',
}

export function DestinationWeather({ name, lat, lng, timezone = 'Australia/Sydney' }: { name: string; lat: number; lng: number; timezone?: string }) {
  const [days, setDays] = useState<Daily[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=${encodeURIComponent(timezone)}&forecast_days=7`
        const r = await fetch(url, { cache: 'no-store' })
        if (!r.ok) throw new Error('forecast ' + r.status)
        const j = await r.json()
        if (cancelled) return
        const out: Daily[] = []
        for (let i = 0; i < (j.daily?.time?.length || 0); i++) {
          out.push({
            date: j.daily.time[i],
            tmax: j.daily.temperature_2m_max[i],
            tmin: j.daily.temperature_2m_min[i],
            rain: j.daily.precipitation_sum[i],
            code: j.daily.weather_code[i],
          })
        }
        setDays(out)
      } catch (e) { if (!cancelled) setError(true) }
    }
    load()
    return () => { cancelled = true }
  }, [lat, lng, timezone])

  if (error || (days && days.length === 0)) return null
  return (
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '22px 24px', marginBottom: 24 }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 800, fontSize: 22, margin: '0 0 6px', color: '#111827' }}>Next 7 days at {name}</h2>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px', lineHeight: 1.5 }}>Live forecast from Open-Meteo. Updated each time the page loads.</p>
      {!days ? (
        <div style={{ fontSize: 13, color: '#9ca3af', padding: '12px 0' }}>Loading forecast…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6, fontSize: 11 }}>
          {days.map((d) => {
            const dt = new Date(d.date)
            const dow = dt.toLocaleDateString('en-AU', { weekday: 'short' })
            const day = dt.getDate()
            return (
              <div key={d.date} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 4px', textAlign: 'center' as const, lineHeight: 1.3 }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: 12 }}>{dow}</div>
                <div style={{ color: '#6b7280', fontSize: 10 }}>{day}</div>
                <div style={{ fontSize: 22, margin: '6px 0' }} title={LABELS[d.code] || ''}>{ICONS[d.code] || '🌤️'}</div>
                <div style={{ fontSize: 13, color: '#0d9488', fontWeight: 700 }}>{Math.round(d.tmax)}°</div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>{Math.round(d.tmin)}°</div>
                {d.rain > 0 && <div style={{ fontSize: 10, color: '#0284c7', marginTop: 2 }}>💧 {d.rain.toFixed(0)}mm</div>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
