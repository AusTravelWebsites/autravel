'use client'
import { useEffect, useState } from 'react'

const STATES = [
  { code: 'qld',  label: 'QLD Travel' },
  { code: 'nsw',  label: 'NSW Travel' },
  { code: 'vic',  label: 'VIC Travel' },
  { code: 'wa',   label: 'WA Travel' },
  { code: 'sa',   label: 'SA Travel' },
  { code: 'tas',  label: 'TAS Travel' },
  { code: 'nt',   label: 'NT Travel' },
  { code: 'aunz', label: 'AU & NZ Travel (aggregator)' },
]

// Canonical keys that show in the UI with descriptions; admins can add custom
// keys too via the "Raw" tab below.
const KEYS = [
  { key: 'ga4_id',           label: 'Google Analytics 4 measurement ID', hint: 'e.g. G-XXXXXXXXXX' },
  { key: 'tagline',          label: 'Homepage tagline',                    hint: 'Overrides the default tagline in tenants.ts' },
  { key: 'hero_image',       label: 'Hero / OG image URL',                 hint: 'Used on homepage + social-share cards' },
  { key: 'contact_email',    label: 'Public contact email',                hint: 'Shown in footer + privacy page' },
  { key: 'support_phone',    label: 'Support phone',                       hint: 'Optional — hidden if empty' },
  { key: 'facebook_url',     label: 'Facebook page URL',                   hint: '' },
  { key: 'instagram_url',    label: 'Instagram handle URL',                hint: '' },
  { key: 'twitter_url',      label: 'X / Twitter URL',                     hint: '' },
  { key: 'maintenance_mode', label: 'Maintenance mode',                    hint: 'Set to 1 to show a maintenance page' },
  { key: 'booking_affiliate_footer', label: 'Booking affiliate footer text', hint: 'Shown under tour detail pages' },
]

const S = {
  page: { padding: 24, maxWidth: 1000, margin: '0 auto' } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 13, color: '#6b7280', margin: '0 0 20px' } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e5e7eb', marginBottom: 14 } as React.CSSProperties,
  input: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' } as React.CSSProperties,
  btn: { padding: '8px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 2, display: 'block', textTransform: 'uppercase' as const, letterSpacing: 0.5 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 3 } as React.CSSProperties,
  chip: (active: boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: active ? '#0d9488' : '#fff', color: active ? '#fff' : '#374151', border: active ? '1px solid #0d9488' : '1px solid #e5e7eb', cursor: 'pointer' }),
}

export default function SettingsAdmin() {
  const [state, setState] = useState('qld')
  const [values, setValues] = useState<Record<string, string>>({})
  const [rawRows, setRawRows] = useState<{ key: string; value: string; updated_at: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/settings?state=' + state)
    const j = await r.json()
    setValues(j.settings || {}); setRawRows(j.rows || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [state])

  async function save(settings: Record<string, string>) {
    setSaving(true)
    const r = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state_code: state, settings }) })
    if (!r.ok) alert('Save failed: ' + (await r.text()))
    setSaving(false); load()
  }
  async function saveAll() {
    await save(values)
  }
  async function addCustom() {
    if (!newKey.trim()) return
    await save({ [newKey.trim()]: newVal })
    setNewKey(''); setNewVal('')
  }
  async function delKey(key: string) {
    if (!confirm(`Delete setting "${key}"?`)) return
    await fetch(`/api/admin/settings?state=${state}&key=${encodeURIComponent(key)}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Site settings</h1>
      <p style={S.sub}>Per-tenant configuration (GA4, social links, contact, maintenance mode, custom keys).</p>

      <div style={S.card}>
        <div style={S.label}>Tenant</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {STATES.map(s => (
            <button key={s.code} onClick={() => setState(s.code)} style={S.chip(state === s.code)}>{s.label}</button>
          ))}
        </div>
      </div>

      {loading
        ? <div style={S.card}>Loading…</div>
        : <div style={S.card}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {KEYS.map(k => (
                <div key={k.key}>
                  <label style={S.label}>{k.label}</label>
                  <input value={values[k.key] || ''} onChange={e => setValues({ ...values, [k.key]: e.target.value })} placeholder={k.hint} style={S.input}/>
                  {k.hint && <div style={S.hint}>{k.hint}</div>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
              <button onClick={saveAll} disabled={saving} style={{ ...S.btn, background: '#0d9488', color: '#fff', opacity: saving ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save settings'}</button>
            </div>
          </div>}

      <details style={S.card}>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Raw key/value store ({rawRows.length} keys)</summary>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 6, marginBottom: 10 }}>
            <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="custom_key" style={S.input}/>
            <input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="value" style={S.input}/>
            <button onClick={addCustom} style={{ ...S.btn, background: '#0d9488', color: '#fff' }}>Add / Update</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
            <thead><tr><th style={{ textAlign: 'left' as const, padding: '6px 8px', background: '#f9fafb' }}>Key</th><th style={{ textAlign: 'left' as const, padding: '6px 8px', background: '#f9fafb' }}>Value</th><th></th></tr></thead>
            <tbody>
              {rawRows.map(r => (
                <tr key={r.key}>
                  <td style={{ padding: '6px 8px' }}><code>{r.key}</code></td>
                  <td style={{ padding: '6px 8px', color: '#374151' }}>{r.value}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' as const }}>
                    <button onClick={() => delKey(r.key)} style={{ ...S.btn, background: '#fee2e2', color: '#991b1b' }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
