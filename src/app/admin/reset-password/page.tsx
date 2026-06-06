'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AdminResetPasswordPage() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords don\'t match'); return }
    if (password.length < 12) { setError('Password must be at least 12 characters'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Reset failed')
      setDone(true)
      setTimeout(() => { window.location.href = '/admin/' }, 1200)
    } catch (e: any) {
      setError(e.message || 'Reset failed')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '64px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '32px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 4 }}>Autravel</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 22px' }}>Set new password</h1>
        {!token ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', color: '#dc2626', fontSize: 14, lineHeight: 1.5 }}>
            Missing reset token. Request a new reset link from the <Link href="/admin/forgot-password/" style={{ color: '#0d9488', fontWeight: 600 }}>forgot password</Link> page.
          </div>
        ) : done ? (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '12px 14px', color: '#065f46', fontSize: 14, lineHeight: 1.5 }}>
            Password updated. Redirecting to the admin dashboard…
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>New password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={12} autoComplete="new-password"
              style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #e5e7eb', color: '#111827', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 12 }} />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Confirm new password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={12} autoComplete="new-password"
              style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #e5e7eb', color: '#111827', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 8 }} />
            <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>Minimum 12 characters.</div>
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <button type="submit" disabled={loading || !password || !confirm}
              style={{ width: '100%', padding: 12, borderRadius: 8, background: '#0d9488', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !password || !confirm ? 0.6 : 1 }}>
              {loading ? 'Updating…' : 'Set password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
