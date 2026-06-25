'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Login failed')
      window.location.href = '/admin/'
    } catch (e: any) {
      setError(e.message || 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '64px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '32px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 4 }}>Autravel</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 24px' }}>Admin sign-in</h1>
        <form onSubmit={onSubmit}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
            style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #e5e7eb', color: '#111827', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 14 }} />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
            style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #e5e7eb', color: '#111827', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 16 }} />
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{error}</div>}
          <button type="submit" disabled={loading || !email || !password}
            style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--brand)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !email || !password ? 0.6 : 1 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <Link href="/admin/forgot-password/" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
