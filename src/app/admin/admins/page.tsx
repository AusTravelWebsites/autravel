'use client'
import { useEffect, useState } from 'react'

type AdminAccount = { email: string; updatedAt: string | null; bootstrap: boolean }

const S = {
  page: { padding: 24, maxWidth: 820, margin: '0 auto' } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 800, margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 13, color: '#6b7280', margin: '0 0 20px' } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 12, padding: 18, border: '1px solid #e5e7eb', marginBottom: 14 } as React.CSSProperties,
  input: { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' } as React.CSSProperties,
  btn: { padding: '8px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 2, display: 'block', textTransform: 'uppercase' as const, letterSpacing: 0.5 } as React.CSSProperties,
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 3 } as React.CSSProperties,
  th: { textAlign: 'left' as const, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: 0.5, padding: '8px 10px', borderBottom: '1px solid #e5e7eb' } as React.CSSProperties,
  td: { fontSize: 13, color: '#111827', padding: '10px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' as const } as React.CSSProperties,
  badge: (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: bg, color: fg, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.4 }),
}

export default function AdminsAdmin() {
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [me, setMe] = useState('')
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/admins')
      const j = await r.json()
      setAdmins(j.admins || [])
      setMe((j.me || '').toLowerCase())
    } catch { setMsg({ kind: 'err', text: 'Could not load admin accounts' }) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const existing = admins.some(a => a.email === email.trim().toLowerCase())

  function generatePassword() {
    const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*'
    const buf = new Uint32Array(20)
    crypto.getRandomValues(buf)
    setPassword(Array.from(buf, n => chars[n % chars.length]).join(''))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setSaving(true)
    try {
      const r = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const j = await r.json()
      if (!r.ok) { setMsg({ kind: 'err', text: j.error || 'Failed to save' }); setSaving(false); return }
      setMsg({ kind: 'ok', text: `${existing ? 'Password reset for' : 'Added'} ${email.trim().toLowerCase()}. They can sign in at /admin/login with this password.` })
      setEmail(''); setPassword('')
      await load()
    } catch { setMsg({ kind: 'err', text: 'Network error' }) }
    setSaving(false)
  }

  async function remove(target: string) {
    if (!confirm(`Remove admin access for ${target}? They will no longer be able to sign in.`)) return
    setMsg(null)
    try {
      const r = await fetch('/api/admin/admins?email=' + encodeURIComponent(target), { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) { setMsg({ kind: 'err', text: j.error || 'Failed to remove' }); return }
      setMsg({ kind: 'ok', text: `Removed ${target}` })
      await load()
    } catch { setMsg({ kind: 'err', text: 'Network error' }) }
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Admin accounts</h1>
      <p style={S.sub}>
        Anyone listed here can sign in to this admin at <code>/admin/login</code> for every autravel site.
        Adding an existing email just resets that account&rsquo;s password.
      </p>

      {msg && (
        <div style={{ ...S.card, background: msg.kind === 'ok' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${msg.kind === 'ok' ? '#a7f3d0' : '#fecaca'}`, color: msg.kind === 'ok' ? '#065f46' : '#991b1b', fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      <div style={S.card}>
        <form onSubmit={save}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={S.label}>Email</label>
              <input style={S.input} type="email" value={email} autoComplete="off"
                onChange={e => setEmail(e.target.value)} placeholder="person@example.com" required />
              {existing && <div style={{ ...S.hint, color: '#b45309' }}>Already an admin — this will reset their password.</div>}
            </div>
            <div>
              <label style={S.label}>Password</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={S.input} type="text" value={password} autoComplete="new-password"
                  onChange={e => setPassword(e.target.value)} placeholder="min 12 characters" required minLength={12} />
                <button type="button" onClick={generatePassword} style={{ ...S.btn, background: '#f3f4f6', color: '#374151', flexShrink: 0 }}>Generate</button>
              </div>
              <div style={S.hint}>Shown in clear text so you can copy and hand it over. Min 12 characters.</div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="submit" disabled={saving} style={{ ...S.btn, background: 'var(--brand)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : existing ? 'Reset password' : 'Add admin'}
            </button>
          </div>
        </form>
      </div>

      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr>
              <th style={S.th}>Email</th>
              <th style={S.th}>Password set</th>
              <th style={{ ...S.th, textAlign: 'right' as const }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td style={S.td} colSpan={3}>Loading…</td></tr>
            ) : admins.length === 0 ? (
              <tr><td style={S.td} colSpan={3}>No admin accounts.</td></tr>
            ) : admins.map(a => (
              <tr key={a.email}>
                <td style={S.td}>
                  {a.email}
                  {a.bootstrap && <span style={S.badge('#eef2ff', '#3730a3')}>Primary</span>}
                  {a.email === me && <span style={S.badge('#ecfdf5', '#065f46')}>You</span>}
                </td>
                <td style={{ ...S.td, color: '#6b7280' }}>
                  {a.updatedAt ? new Date(a.updatedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '— (env bootstrap)'}
                </td>
                <td style={{ ...S.td, textAlign: 'right' as const }}>
                  <button
                    onClick={() => remove(a.email)}
                    disabled={a.bootstrap || a.email === me}
                    title={a.bootstrap ? 'The primary account cannot be removed' : a.email === me ? 'You cannot remove your own account' : 'Remove admin'}
                    style={{ ...S.btn, background: (a.bootstrap || a.email === me) ? '#f3f4f6' : '#fef2f2', color: (a.bootstrap || a.email === me) ? '#9ca3af' : '#dc2626', cursor: (a.bootstrap || a.email === me) ? 'not-allowed' : 'pointer', padding: '5px 11px' }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
