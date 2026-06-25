'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import Link from 'next/link'

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/admin-forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Request failed')
      }
      setSent(true)
    } catch (e: any) {
      setError(e.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '64px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '32px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: 1.5, textTransform: 'uppercase' as const, marginBottom: 4 }}>Autravel</div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Forgot password</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 22px', lineHeight: 1.5 }}>
          Enter the admin email and we&apos;ll send a link to set a new password. The link expires in 30 minutes.
        </p>
        {sent ? (
          <div>
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, padding: '12px 14px', color: 'var(--brand-dark)', fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
              If that email matches the admin account, a reset link has been sent. Check your inbox (and spam folder).
            </div>
            <Link href="/admin/login/" style={{ color: 'var(--brand)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              ← Back to sign-in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' as const }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
              style={{ width: '100%', padding: '11px 13px', borderRadius: 8, border: '1px solid #e5e7eb', color: '#111827', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 16 }} />
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '9px 12px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <button type="submit" disabled={loading || !email}
              style={{ width: '100%', padding: 12, borderRadius: 8, background: 'var(--brand)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !email ? 0.6 : 1 }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link href="/admin/login/" style={{ color: '#6b7280', fontSize: 13, textDecoration: 'none' }}>
                ← Back to sign-in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
