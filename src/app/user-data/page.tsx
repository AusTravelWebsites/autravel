'use client'
import { useState } from 'react'

export default function UserDataPage() {
  const [form, setForm] = useState({ name: '', email: '', platform: '', userId: '', reason: '' })
  const [status, setStatus] = useState<'idle'|'sending'|'done'|'error'>('idle')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    setStatus('sending')
    try {
      const r = await fetch('/api/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      setStatus(r.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        :root{--ink:#0f0e0c;--rust:#c8440a;--sage:#3d5a3e;--cream:#faf7f2;--paper:#f5f0e8;--red:#dc2626}
        body{background:var(--cream);color:var(--ink);font-family:'Georgia',serif;line-height:1.8}
        nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:1.25rem 3rem;backdrop-filter:blur(12px);background:rgba(250,247,242,0.92);border-bottom:1px solid rgba(15,14,12,0.08)}
        .logo{font-family:'Georgia',serif;font-size:1.4rem;font-weight:700;color:var(--ink);text-decoration:none}
        .logo span{color:var(--rust)}
        .nav-btn{background:var(--ink);color:var(--cream);padding:0.55rem 1.4rem;border-radius:2rem;font-size:0.875rem;text-decoration:none}
        .wrap{max-width:760px;margin:0 auto;padding:8rem 2rem 6rem}
        .chip{display:inline-block;background:var(--paper);border:1px solid rgba(15,14,12,0.12);border-radius:2rem;padding:0.3rem 0.9rem;font-size:0.78rem;font-family:sans-serif;color:var(--sage);margin-bottom:1.5rem}
        h1{font-size:2.4rem;font-weight:700;letter-spacing:-0.02em;margin-bottom:0.5rem;line-height:1.15}
        .meta{font-family:sans-serif;font-size:0.85rem;color:rgba(15,14,12,0.5);margin-bottom:3rem;padding-bottom:2rem;border-bottom:1px solid rgba(15,14,12,0.1)}
        h2{font-size:1.25rem;font-weight:700;margin:2.5rem 0 0.75rem;font-family:sans-serif}
        h3{font-size:1.05rem;font-weight:600;margin:1.75rem 0 0.5rem;font-family:sans-serif;color:var(--sage)}
        p{margin-bottom:1rem;font-size:1rem;color:rgba(15,14,12,0.82)}
        ul{margin:0.5rem 0 1rem 1.5rem}
        li{margin-bottom:0.4rem;font-size:1rem;color:rgba(15,14,12,0.82)}
        a{color:var(--rust);text-decoration:none}
        a:hover{text-decoration:underline}
        .platforms{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;margin:1.25rem 0 2rem}
        .plat{background:var(--paper);border:1px solid rgba(15,14,12,0.1);border-radius:0.6rem;padding:0.85rem 1rem;font-family:sans-serif;font-size:0.88rem;display:flex;align-items:center;gap:0.6rem}
        .plat-dot{width:8px;height:8px;border-radius:50%;background:var(--sage);flex-shrink:0}
        .timeline{display:flex;flex-direction:column;gap:0;margin:1.25rem 0 2rem}
        .tl-item{display:flex;gap:1.25rem;align-items:flex-start;padding-bottom:1.5rem;position:relative}
        .tl-item:not(:last-child)::before{content:'';position:absolute;left:14px;top:32px;bottom:0;width:2px;background:rgba(15,14,12,0.08)}
        .tl-num{width:28px;height:28px;border-radius:50%;background:var(--rust);color:#fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:0.75rem;font-weight:700;flex-shrink:0;margin-top:2px}
        .tl-body h3{margin:0 0 0.2rem;font-size:0.95rem}
        .tl-body p{margin:0;font-size:0.88rem;color:rgba(15,14,12,0.6)}
        .form-card{background:var(--paper);border:1px solid rgba(15,14,12,0.1);border-radius:1rem;padding:2.5rem;margin-top:1rem}
        .form-card h2{margin-top:0}
        .field{margin-bottom:1.25rem}
        label{display:block;font-family:sans-serif;font-size:0.82rem;font-weight:600;color:rgba(15,14,12,0.65);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem}
        .req{color:var(--rust)}
        input,select,textarea{width:100%;padding:0.75rem 1rem;border:1.5px solid rgba(15,14,12,0.15);border-radius:0.5rem;font-size:0.95rem;font-family:sans-serif;background:#fff;color:var(--ink);outline:none;transition:border-color 0.2s}
        input:focus,select:focus,textarea:focus{border-color:var(--rust)}
        textarea{resize:vertical;min-height:110px;line-height:1.6}
        .hint{font-family:sans-serif;font-size:0.78rem;color:rgba(15,14,12,0.45);margin-top:0.3rem}
        .row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
        .submit-btn{background:var(--rust);color:#fff;border:none;padding:0.9rem 2.5rem;border-radius:3rem;font-size:1rem;font-family:sans-serif;font-weight:600;cursor:pointer;margin-top:0.5rem;transition:opacity 0.2s}
        .submit-btn:hover{opacity:0.88}
        .submit-btn:disabled{opacity:0.5;cursor:not-allowed}
        .success-box{background:#f0fdf4;border:1.5px solid #86efac;border-radius:0.75rem;padding:1.5rem 2rem;margin-top:1rem;font-family:sans-serif}
        .success-box h3{color:#166534;font-size:1.05rem;margin-bottom:0.4rem}
        .success-box p{color:#166534;font-size:0.9rem;margin:0}
        .error-box{background:#fef2f2;border:1.5px solid #fca5a5;border-radius:0.75rem;padding:1rem 1.5rem;margin-top:0.75rem;font-family:sans-serif;font-size:0.88rem;color:#991b1b}
        .notice{background:#fff7ed;border:1.5px solid #fed7aa;border-radius:0.75rem;padding:1.25rem 1.5rem;margin:2rem 0;font-family:sans-serif;font-size:0.9rem;color:#9a3412}
        .notice strong{display:block;margin-bottom:0.25rem;font-size:0.95rem}
        footer{background:var(--ink);color:rgba(245,240,232,0.4);padding:2rem 3rem;display:flex;align-items:center;justify-content:space-between;font-size:0.85rem;font-family:sans-serif}
        .fl{font-family:'Georgia',serif;font-size:1.1rem;font-weight:700;color:#f5f0e8;text-decoration:none}
        .fl span{color:var(--rust)}
        .fli{display:flex;gap:2rem}
        .fli a{color:rgba(245,240,232,0.4);text-decoration:none}
        .fli a:hover{color:#f5f0e8}
        @media(max-width:640px){.wrap{padding:7rem 1.25rem 4rem}.row{grid-template-columns:1fr}.platforms{grid-template-columns:1fr 1fr}nav{padding:1rem 1.25rem}h1{font-size:1.9rem}.form-card{padding:1.5rem}footer{flex-direction:column;gap:1rem;padding:1.5rem}}
      `}</style>
      <nav>
        <a href="/" className="logo">Bug<span>Bitten</span></a>
        <a href="/login" className="nav-btn">Sign in</a>
      </nav>
      <div className="wrap">
        <div className="chip">Your Rights</div>
        <h1>User Data &amp; Deletion</h1>
        <p className="meta">Last updated: April 12, 2026</p>

        <p>BugBitten is committed to protecting your privacy and respecting your right to control your personal data. This page explains what data we hold, how to request deletion, and how we comply with the data deletion policies of Meta (Facebook &amp; Instagram), Google, Apple, and other platforms.</p>

        <h2>What Data We Hold</h2>
        <p>When you create a BugBitten account or sign in via a social platform, we may store:</p>
        <ul>
          <li>Your name, email address, and profile photo</li>
          <li>Trip journals, reviews, check-ins, comments, and photos you have posted</li>
          <li>GPS-verified place names associated with your check-ins (precise coordinates are never stored)</li>
          <li>Your follow relationships and notification preferences</li>
          <li>Login provider information (e.g. &ldquo;signed in with Google&rdquo;)</li>
        </ul>

        <h2>Platform Compliance</h2>
        <p>We comply with the data deletion requirements of the following platforms and regulatory frameworks:</p>
        <div className="platforms">
          <div className="plat"><span className="plat-dot"/><span>Meta (Facebook &amp; Instagram)</span></div>
          <div className="plat"><span className="plat-dot"/><span>Google Sign-In</span></div>
          <div className="plat"><span className="plat-dot"/><span>Apple Sign-In</span></div>
          <div className="plat"><span className="plat-dot"/><span>GDPR (EU / UK)</span></div>
          <div className="plat"><span className="plat-dot"/><span>CCPA (California)</span></div>
          <div className="plat"><span className="plat-dot"/><span>Privacy Act (Australia)</span></div>
        </div>

        <p>If you used a social login to create your BugBitten account, you can also manage connected app permissions directly from that platform (e.g. Facebook Settings &rarr; Apps and Websites, or Google Account &rarr; Third-party apps with account access). Revoking access there will prevent future sign-ins but will not automatically delete your BugBitten data &mdash; please submit the form below to request full deletion.</p>

        <div className="notice">
          <strong>Meta Data Deletion Callback</strong>
          If you connected BugBitten via Facebook Login and request deletion through Facebook&apos;s platform, we receive an automated notification and will process your deletion within 30 days. You can also use the form below to request deletion directly at any time.
        </div>

        <h2>How Deletion Works</h2>
        <div className="timeline">
          <div className="tl-item">
            <div className="tl-num">1</div>
            <div className="tl-body"><h3>Submit a request</h3><p>Fill out the contact form below with your name, email, and any relevant details.</p></div>
          </div>
          <div className="tl-item">
            <div className="tl-num">2</div>
            <div className="tl-body"><h3>We verify your identity</h3><p>We will send a confirmation email to the address provided to verify the request is genuine.</p></div>
          </div>
          <div className="tl-item">
            <div className="tl-num">3</div>
            <div className="tl-body"><h3>Data is deleted</h3><p>All personal data associated with your account is permanently deleted within <strong>30 days</strong> of verification. You will receive a confirmation email when complete.</p></div>
          </div>
          <div className="tl-item">
            <div className="tl-num">4</div>
            <div className="tl-body"><h3>What is retained</h3><p>We may retain anonymised, aggregated data (e.g. total review counts) and any information required by law for fraud prevention or legal obligations.</p></div>
          </div>
        </div>

        <div className="form-card" id="request-form">
          {status === 'done' ? (
            <div className="success-box">
              <h3>Request received</h3>
              <p>Thank you, {form.name}. We have received your data deletion request and will send a confirmation to <strong>{form.email}</strong> within 24 hours. Your data will be permanently deleted within 30 days of verification.</p>
            </div>
          ) : (
            <>
              <h2>Request Data Deletion</h2>
              <p style={{fontFamily:'sans-serif',fontSize:'0.9rem',color:'rgba(15,14,12,0.6)',marginBottom:'1.75rem'}}>Fields marked <span style={{color:'var(--rust)'}}>*</span> are required. We will respond within 24 hours.</p>
              <div className="row">
                <div className="field">
                  <label>Full Name <span className="req">*</span></label>
                  <input type="text" placeholder="Jane Smith" value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="field">
                  <label>Email Address <span className="req">*</span></label>
                  <input type="email" placeholder="jane@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
                  <p className="hint">Must match the email on your BugBitten account</p>
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label>Platform used to sign in</label>
                  <select value={form.platform} onChange={e => set('platform', e.target.value)}>
                    <option value="">Select platform</option>
                    <option>Email and password</option>
                    <option>Google</option>
                    <option>Facebook</option>
                    <option>Apple</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="field">
                  <label>BugBitten username or user ID</label>
                  <input type="text" placeholder="@yourusername" value={form.userId} onChange={e => set('userId', e.target.value)} />
                  <p className="hint">Optional but helps us locate your account faster</p>
                </div>
              </div>
              <div className="field">
                <label>Reason for deletion</label>
                <textarea placeholder="e.g. I no longer use the service and want my data removed." value={form.reason} onChange={e => set('reason', e.target.value)} />
                <p className="hint">Optional  you are not required to give a reason</p>
              </div>
              {status === 'error' && <div className="error-box">Something went wrong. Please try again or email us directly at <a href="mailto:privacy@bugbitten.com">privacy@bugbitten.com</a>.</div>}
              <button className="submit-btn" disabled={status === 'sending' || !form.name.trim() || !form.email.trim()} onClick={submit}>
                {status === 'sending' ? 'Sending...' : 'Submit deletion request'}
              </button>
            </>
          )}
        </div>

        <h2>Alternative Contact Methods</h2>
        <p>If you prefer not to use the form above, you can also request deletion by emailing us directly:</p>
        <ul>
          <li>Email: <a href="mailto:privacy@bugbitten.com">privacy@bugbitten.com</a></li>
          <li>Subject line: <strong>Data Deletion Request</strong></li>
          <li>Include your full name, account email address, and (if known) your BugBitten username</li>
        </ul>
        <p>We will acknowledge your request within 24 hours and complete the deletion within 30 days.</p>

        <h2>Further Information</h2>
        <p>For more detail on how we collect and use your data, please read our <a href="/privacy">Privacy Policy</a>. If you have concerns about how your data has been handled, you also have the right to lodge a complaint with your local data protection authority.</p>
      </div>
      <footer>
        <a href="/" className="fl">Bug<span>Bitten</span></a>
        <div className="fli">
          <a href="/privacy">Privacy</a>
          <a href="/user-data">User Data</a>
          <a href="/terms">Terms</a>
          <a href="/about">About</a>
        </div>
        <span>2026 BugBitten</span>
      </footer>
    </>
  )
}
