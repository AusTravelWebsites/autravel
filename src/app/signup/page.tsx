'use client';
export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSocial(provider: 'google' | 'facebook') {
    setLoading(true); setError('');
    try {
      const p = provider === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      const result = await signInWithPopup(auth, p);
      const idToken = await result.user.getIdToken();
      await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
      await fetch('/api/auth/upsert', { method: 'POST' });
      router.push('/onboarding');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send link');
      window.localStorage.setItem('bugbitten_magic_email', email);
      setSent(true);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px 64px', overflowX: 'hidden' as const, width: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '32px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', boxSizing: 'border-box' as const }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'block', textAlign: 'center', marginBottom: 24 }}>
          <img loading="lazy" decoding="async" src="/brand/logo.webp?v=2" alt="Logo" style={{ height: 80, width: 'auto', display: 'inline-block' }} />
        </Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 6, textAlign: 'center' as const }}>Create your account</h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 28, textAlign: 'center' as const }}>
          Already have one? <Link href="/login" style={{ color: '#0d9488', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
        </p>
        <button onClick={() => handleSocial('google')} disabled={loading}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}>
          Continue with Google
        </button>
        <button onClick={() => handleSocial('facebook')} disabled={loading}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: '#1877f2', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginBottom: 24 }}>
          Continue with Facebook
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ fontSize: 13, color: '#9ca3af' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>
        {sent ? (
          <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <h3 style={{ color: '#0d9488', fontWeight: 700, marginBottom: 8 }}>Check your email</h3>
            <p style={{ color: '#374151', fontSize: 14 }}>We sent a sign-up link to <strong style={{ color: '#111827' }}>{email}</strong>.</p>
            <button onClick={() => { setSent(false); setEmail(''); }}
              style={{ marginTop: 16, background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb', color: '#111827', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 12 }} />
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 13, borderRadius: 10, background: '#0d9488', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Sending...' : 'Send sign-up link'}
            </button>
          </form>
        )}
        <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 24 }}>
          By joining you agree to our <Link href="/terms" style={{ color: '#0d9488', textDecoration: 'none' }}>Terms</Link> and <Link href="/privacy" style={{ color: '#0d9488', textDecoration: 'none' }}>Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
