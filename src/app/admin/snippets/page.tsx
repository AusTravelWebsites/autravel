'use client'
import { useEffect, useState } from 'react'

type Snippet = { id: string; name: string; location: string; code: string; is_active: boolean; created_at: string }
const blank = { name: '', location: 'head', code: '', is_active: true }
const S = {
  page: { padding: 32 } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 13, color: '#6b7280', margin: '0 0 24px' } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', marginBottom: 16 } as React.CSSProperties,
  row: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block' } as React.CSSProperties,
  input: { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
  textarea: { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', minHeight: 120, outline: 'none', boxSizing: 'border-box', resize: 'vertical' } as React.CSSProperties,
  select: { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none' } as React.CSSProperties,
  btn: { padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none' } as React.CSSProperties,
  tag: { display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600 } as React.CSSProperties,
}

const locationLabels: Record<string, string> = { head: ' <head>', body_start: ' <body> start', body_end: ' <body> end' }

export default function SnippetsPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [form, setForm] = useState<typeof blank & { id?: string }>(blank)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/snippets')
    setSnippets(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    const method = form.id ? 'PUT' : 'POST'
    await fetch('/api/admin/snippets', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setForm(blank); setEditing(false); await load()
    setSaving(false)
  }

  async function toggle(s: Snippet) {
    await fetch('/api/admin/snippets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...s, is_active: !s.is_active }) })
    await load()
  }

  async function del(id: string) {
    if (!confirm('Delete this snippet?')) return
    await fetch('/api/admin/snippets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    await load()
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Header / Footer Code Injection</h1>
      <p style={S.sub}>Single source of truth for tags (GA4, Meta Pixel, Clarity, etc.). Active snippets are injected into every page of BugBitten. Consent Mode defaults run first automatically, so tags respect the cookie banner. Changes propagate instantly (no redeploy).</p>

      {/* Add/Edit form */}
      <div style={S.card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{editing ? ' Edit Snippet' : ' Add New Snippet'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.label}>Name (e.g. "Google Analytics")</label>
            <input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Google Analytics" />
          </div>
          <div>
            <label style={S.label}>Location</label>
            <select style={{ ...S.select, width: '100%' }} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}>
              <option value="head">In &lt;head&gt;  for analytics, meta tags</option>
              <option value="body_start">Body start  after &lt;body&gt;</option>
              <option value="body_end">Body end  before &lt;/body&gt;</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>Code (HTML / script tags)</label>
          <textarea style={S.textarea} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder={'<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX"></script>'} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active (inject on every page)
          </label>
          <div style={{ flex: 1 }} />
          {editing && <button style={{ ...S.btn, background: '#f3f4f6', color: '#374151' }} onClick={() => { setForm(blank); setEditing(false) }}>Cancel</button>}
          <button style={{ ...S.btn, background: '#1a2332', color: '#fff' }} onClick={save} disabled={saving || !form.name || !form.code}>
            {saving ? 'Saving' : form.id ? 'Update Snippet' : 'Add Snippet'}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? <div style={{ color: '#6b7280', fontSize: 13 }}>Loading</div> : snippets.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#9ca3af', padding: 40 }}>No snippets yet. Add your first one above.</div>
      ) : snippets.map(s => (
        <div key={s.id} style={{ ...S.card, borderLeft: `4px solid ${s.is_active ? '#10b981' : '#d1d5db'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>{s.name}</div>
            <span style={{ ...S.tag, background: s.is_active ? '#d1fae5' : '#f3f4f6', color: s.is_active ? 'var(--brand-dark)' : '#6b7280' }}>{s.is_active ? 'Active' : 'Inactive'}</span>
            <span style={{ ...S.tag, background: '#eff6ff', color: '#1d4ed8' }}>{locationLabels[s.location]}</span>
            <div style={{ flex: 1 }} />
            <button style={{ ...S.btn, background: s.is_active ? '#fef3c7' : '#d1fae5', color: s.is_active ? '#92400e' : 'var(--brand-dark)', padding: '4px 10px' }} onClick={() => toggle(s)}>{s.is_active ? 'Disable' : 'Enable'}</button>
            <button style={{ ...S.btn, background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px' }} onClick={() => { setForm({ ...s }); setEditing(true); window.scrollTo(0, 0) }}>Edit</button>
            <button style={{ ...S.btn, background: '#fef2f2', color: '#dc2626', padding: '4px 10px' }} onClick={() => del(s.id)}>Delete</button>
          </div>
          <pre style={{ fontSize: 11, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', margin: 0, overflow: 'auto', maxHeight: 80, color: '#374151' }}>{s.code.slice(0, 300)}{s.code.length > 300 ? '' : ''}</pre>
        </div>
      ))}
    </div>
  )
}
