'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSignInWithEmailLink(auth, window.location.href)) {
      setMagicLoading(true);
      let savedEmail = window.localStorage.getItem('bugbitten_magic_email') || '';
      if (!savedEmail) savedEmail = window.prompt('Enter your email to confirm') || '';
      signInWithEmailLink(auth, savedEmail, window.location.href)
        .then(async (result) => {
          const idToken = await result.user.getIdToken();
          await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
          await fetch('/api/auth/upsert', { method: 'POST' });
          window.localStorage.removeItem('bugbitten_magic_email');
          router.push('/feed');
        })
        .catch((e) => { setError(e.message); setMagicLoading(false); });
    }
  }, []);

  async function handleSocial(provider: 'google' | 'facebook') {
    setLoading(true); setError('');
    try {
      const p = provider === 'google' ? new GoogleAuthProvider() : new FacebookAuthProvider();
      const result = await signInWithPopup(auth, p);
      const idToken = await result.user.getIdToken();
      await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
      await fetch('/api/auth/upsert', { method: 'POST' });
      router.push('/feed');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/magic-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send link');
      window.localStorage.setItem('bugbitten_magic_email', email);
      setSent(true);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  if (magicLoading) return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 16 }}>✓</div><p>Signing you in...</p></div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '32px 16px 64px', overflowX: 'hidden' as const, width: '100%', boxSizing: 'border-box' as const }}>
      <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: '32px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', boxSizing: 'border-box' as const }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'block', textAlign: 'center', marginBottom: 24 }}>
          <img loading="lazy" decoding="async" src="/brand/logo.webp?v=2" alt="Logo" style={{ height: 80, width: 'auto', display: 'inline-block' }} />
        </Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 6, textAlign: 'center' as const }}>Sign in</h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 28, textAlign: 'center' as const }}>
          No account? <Link href="/signup" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>Join free</Link>
        </p>

        <button onClick={() => handleSocial('google')} disabled={loading}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
          Continue with Google
        </button>

        <button onClick={() => handleSocial('facebook')} disabled={loading}
          style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: '#1877f2', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
          Continue with Facebook
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
          <span style={{ fontSize: 13, color: '#9ca3af' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>

        {sent ? (
          <div style={{ background: 'var(--brand-light)', border: '1px solid #99f6e4', borderRadius: 12, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <h3 style={{ color: 'var(--brand)', fontWeight: 700, marginBottom: 8 }}>Check your email</h3>
            <p style={{ color: '#374151', fontSize: 14, lineHeight: 1.6 }}>We sent a sign-in link to <strong style={{ color: '#111827' }}>{email}</strong>. Click it to sign in.</p>
            <button onClick={() => { setSent(false); setEmail(''); }} style={{ marginTop: 16, background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb', color: '#111827', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, marginBottom: 12 }} />
            {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button type="submit" disabled={loading || !email}
              style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--brand)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading || !email ? 0.6 : 1 }}>
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', fontSize: 13, color: '#9ca3af', marginTop: 24 }}>
          New here? <Link href="/signup" style={{ color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}>Create a free account</Link>
        </p>
      </div>
    </div>
  );
}