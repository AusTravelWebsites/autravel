'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Author = {
  id: string; slug: string; name: string; role: string | null; bio: string | null
  avatar_url: string | null; state_codes: string[]; email: string | null
  twitter: string | null; instagram: string | null; website: string | null
  is_active: boolean; display_order: number
}

const STATES = ['qld', 'nsw', 'nt', 'wa', 'sa', 'tas', 'vic', 'aunz']
const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', red: '#dc2626' }

export default function AdminAuthorsPage() {
  const [rows, setRows] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Author | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function load() {
    setLoading(true)
    const r = await fetch('/api/admin/authors')
    const j = await r.json()
    setRows(j.authors || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setBusy(true); setErr('')
    try {
      const url = '/api/admin/authors'
      const opts: RequestInit = {
        method: editing.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      }
      const r = await fetch(url, opts)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Save failed')
      setEditing(null); load()
    } catch (e: any) { setErr(e.message) }
    finally { setBusy(false) }
  }

  async function toggleActive(a: Author) {
    await fetch('/api/admin/authors', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, is_active: !a.is_active }),
    })
    load()
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, gap: 10, flexWrap: 'wrap' as const }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Authors</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin" style={btnSecondary}>← Admin</Link>
          <button onClick={() => setEditing({
            id: '', slug: '', name: '', role: '', bio: '', avatar_url: '',
            state_codes: [], email: '', twitter: '', instagram: '', website: '',
            is_active: true, display_order: 100,
          })} style={btnPrimary}>+ New author</button>
        </div>
      </div>

      <p style={{ color: C.sub, fontSize: 13, margin: '0 0 16px' }}>
        Authors appear in the article editor dropdown and on public <code>/author/&lt;slug&gt;/</code> profile pages.
        Leave <strong>State codes</strong> empty to make an author available on every tenant.
      </p>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
          <thead><tr style={{ background: '#f9fafb', textAlign: 'left' as const }}>
            <th style={th}>Name</th><th style={th}>Slug</th><th style={th}>Role</th><th style={th}>Tenants</th><th style={th}>Active</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center' as const, color: C.sub }}>Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} style={{ padding: 16, textAlign: 'center' as const, color: C.sub }}>No authors yet — click "New author" to add one.</td></tr>
              : rows.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}`, opacity: a.is_active ? 1 : 0.5 }}>
                  <td style={td}>
                    <a href={`/author/${a.slug}/`} target="_blank" rel="noopener" style={{ color: C.teal, fontWeight: 600, textDecoration: 'none' }}>{a.name}</a>
                    <div style={{ fontSize: 11, color: C.sub }}>order {a.display_order}</div>
                  </td>
                  <td style={td}><code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{a.slug}</code></td>
                  <td style={td}>{a.role || '—'}</td>
                  <td style={td}>{a.state_codes.length === 0 ? <em style={{ color: C.sub }}>all</em> : a.state_codes.join(', ')}</td>
                  <td style={td}>{a.is_active ? '✓' : '—'}</td>
                  <td style={td}>
                    <button onClick={() => setEditing({ ...a })} style={btnSmall}>Edit</button>
                    <button onClick={() => toggleActive(a)} style={btnSmall}>{a.is_active ? 'Hide' : 'Show'}</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div onClick={() => setEditing(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflow: 'auto' as const }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.card, borderRadius: 14, maxWidth: 600, width: '100%', padding: 24, marginTop: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 18px' }}>{editing.id ? 'Edit author' : 'New author'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              <Field label="Name"><input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} style={inp} /></Field>
              <Field label="Slug (url-safe, lowercase)">
                <input value={editing.slug} onChange={e => setEditing({ ...editing, slug: e.target.value })} placeholder="e.g. mick-harper" style={inp} disabled={!!editing.id} />
                {editing.id && <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>Slug can't be changed after creation (would break profile URLs).</div>}
              </Field>
              <Field label="Role / title"><input value={editing.role || ''} onChange={e => setEditing({ ...editing, role: e.target.value })} placeholder="e.g. Tours & experiences editor" style={inp} /></Field>
              <Field label="Bio"><textarea value={editing.bio || ''} onChange={e => setEditing({ ...editing, bio: e.target.value })} rows={5} style={{ ...inp, resize: 'vertical' as const }} /></Field>
              <Field label="Avatar URL"><input value={editing.avatar_url || ''} onChange={e => setEditing({ ...editing, avatar_url: e.target.value })} placeholder="https://… (or leave blank for initials avatar)" style={inp} /></Field>
              <Field label="Visible on tenants (empty = all)">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 4 }}>
                  {STATES.map(s => {
                    const on = editing.state_codes.includes(s)
                    return (
                      <button key={s} type="button" onClick={() => setEditing({ ...editing, state_codes: on ? editing.state_codes.filter(x => x !== s) : [...editing.state_codes, s] })}
                        style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                 border: `1px solid ${on ? C.teal : C.border}`,
                                 background: on ? C.teal : '#fff', color: on ? '#fff' : C.text }}>{s.toUpperCase()}</button>
                    )
                  })}
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Email"><input value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} style={inp} /></Field>
                <Field label="Website"><input value={editing.website || ''} onChange={e => setEditing({ ...editing, website: e.target.value })} style={inp} /></Field>
                <Field label="X / Twitter handle"><input value={editing.twitter || ''} onChange={e => setEditing({ ...editing, twitter: e.target.value })} placeholder="@handle" style={inp} /></Field>
                <Field label="Instagram handle"><input value={editing.instagram || ''} onChange={e => setEditing({ ...editing, instagram: e.target.value })} placeholder="@handle" style={inp} /></Field>
              </div>
              <Field label="Display order (lower = first)"><input type="number" value={editing.display_order} onChange={e => setEditing({ ...editing, display_order: Number(e.target.value) || 100 })} style={inp} /></Field>
            </div>
            {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, color: C.red, fontSize: 13, marginTop: 14 }}>{err}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end' as const, gap: 8, marginTop: 18 }}>
              <button onClick={() => setEditing(null)} style={btnSecondary}>Cancel</button>
              <button onClick={save} disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: '#374151' }
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' as const }
const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.text, background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }
const btnPrimary: React.CSSProperties = { background: C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }
const btnSecondary: React.CSSProperties = { background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }
const btnSmall: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', marginRight: 4 }
