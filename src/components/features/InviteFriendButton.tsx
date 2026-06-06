'use client';
import { useEffect, useState } from 'react';

interface Props { username?: string; displayName?: string; variant?: 'primary' | 'inline' }

const C = { teal: '#0d9488', tealLight: '#f0fdfa', text: '#111827', sub: '#6b7280', border: '#e5e7eb', card: '#fff', red: '#ef4444' };

export function InviteFriendButton({ username, displayName, variant = 'primary' }: Props) {
  const [open, setOpen] = useState(false);
  const buttonStyle: React.CSSProperties = variant === 'primary'
    ? { display: 'block', width: '100%', background: C.teal, color: '#fff', borderRadius: 8, padding: '9px 16px', textAlign: 'center', fontWeight: 700, fontSize: 14, border: `1px solid ${C.teal}`, marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit' }
    : { background: 'none', border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
  return (
    <>
      <button onClick={() => setOpen(true)} style={buttonStyle}>+ Invite a friend</button>
      {open && <InviteModal username={username} displayName={displayName} onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteModal({ username, displayName, onClose }: { username?: string; displayName?: string; onClose: () => void }) {
  const [emails, setEmails] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [sent, setSent] = useState(0);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasNative, setHasNative] = useState(false);
  useEffect(() => { setHasNative(typeof navigator !== 'undefined' && 'share' in navigator); }, []);

  const inviteUrl = `https://bugbitten.com/signup${username ? `?ref=${encodeURIComponent(username)}` : ''}`;
  const shareText = `Join me on BugBitten — the GPS-verified travel journal. Come along: ${inviteUrl}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=4&color=0d9488&data=${encodeURIComponent(inviteUrl)}`;

  const parseEmails = (s: string) =>
    s.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean).filter(x => /.+@.+\..+/.test(x));

  const sendEmails = async () => {
    const list = parseEmails(emails);
    if (!list.length) { setErr('Please enter at least one valid email.'); return; }
    setStatus('sending'); setErr('');
    try {
      const r = await fetch('/api/invites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails: list, context: 'friends' }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Failed to send');
      setSent(list.length); setStatus('done'); setEmails('');
    } catch (e: any) { setStatus('error'); setErr(e.message || 'Failed'); }
  };

  const copy = async () => { try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} };

  const nativeShare = async () => {
    try { await (navigator as any).share({ url: inviteUrl, text: shareText, title: 'Join me on BugBitten' }); } catch {}
  };

  const open = (url: string) => window.open(url, '_blank', 'noopener,width=600,height=500');

  const shareUrls = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`,
    messenger: `https://www.facebook.com/dialog/send?link=${encodeURIComponent(inviteUrl)}&app_id=140586622674265&redirect_uri=${encodeURIComponent(inviteUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    sms: `sms:?body=${encodeURIComponent(shareText)}`,
    email: `mailto:?subject=${encodeURIComponent('Join me on BugBitten')}&body=${encodeURIComponent(shareText)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(inviteUrl)}`,
  };

  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, background: '#fff', boxSizing: 'border-box' as const, outline: 'none', fontFamily: 'inherit' };
  const tile: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${C.border}`, background: '#fff', color: C.text, textDecoration: 'none', fontFamily: 'inherit' };

  return (
    <div role="dialog" aria-label="Invite a friend" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 540, width: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 800, color: C.text }}>Invite a friend</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: C.sub, lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ padding: 22, overflowY: 'auto' as const, flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 18 }}>

          {/* Native Web Share — best UX on mobile */}
          {hasNative && (
            <button onClick={nativeShare} style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 10, padding: '12px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              📱 Share via your phone
            </button>
          )}

          {/* QR code — best for travellers meeting in person */}
          <div style={{ background: '#f9fafb', border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
            <img loading="lazy" decoding="async" src={qrUrl} alt="Invite QR code" width={120} height={120} style={{ background: '#fff', borderRadius: 8, padding: 4, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>Scan in person</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 2, lineHeight: 1.5 }}>Best for travellers you meet on the road — they scan with their camera and land on a signup page connected to {displayName ? `you (${displayName})` : 'you'}.</div>
            </div>
          </div>

          {/* Email */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Email</div>
            <textarea value={emails} onChange={e => setEmails(e.target.value)} rows={2} placeholder="friend@example.com, another@example.com" style={{ ...inp, resize: 'vertical' as const, minHeight: 56 }} />
            {status === 'done' && <div style={{ color: C.teal, fontSize: 12, marginTop: 6, fontWeight: 700 }}>✓ Sent to {sent}</div>}
            {err && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{err}</div>}
            <button onClick={sendEmails} disabled={status === 'sending'} style={{ marginTop: 8, background: status === 'sending' ? C.sub : C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: status === 'sending' ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{status === 'sending' ? 'Sending…' : 'Send invites'}</button>
          </div>

          {/* Social tiles */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Share on</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              <a href="#" onClick={e => { e.preventDefault(); open(shareUrls.facebook) }} style={{ ...tile, background: '#1877F2', color: '#fff', borderColor: '#1877F2' }}>Ⓕ Facebook</a>
              <a href="#" onClick={e => { e.preventDefault(); open(shareUrls.messenger) }} style={{ ...tile, background: '#0084FF', color: '#fff', borderColor: '#0084FF' }}>💬 Messenger</a>
              <a href="#" onClick={e => { e.preventDefault(); open(shareUrls.whatsapp) }} style={{ ...tile, background: '#25D366', color: '#fff', borderColor: '#25D366' }}>WhatsApp</a>
              <a href="#" onClick={e => { e.preventDefault(); open(shareUrls.x) }} style={{ ...tile, background: '#000', color: '#fff', borderColor: '#000' }}>𝕏 Post on X</a>
              <a href={shareUrls.sms} style={tile}>✉️ SMS</a>
              <a href={shareUrls.email} style={tile}>📧 Email app</a>
              <a href="#" onClick={e => { e.preventDefault(); open(shareUrls.linkedin) }} style={tile}>in LinkedIn</a>
            </div>
          </div>

          {/* Copy link */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Personal invite link</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={inviteUrl} onFocus={e => e.currentTarget.select()} style={{ ...inp, fontFamily: 'monospace', fontSize: 12, background: '#f9fafb' }} />
              <button onClick={copy} style={{ background: copied ? '#10b981' : C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>{copied ? '✓ Copied' : 'Copy'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
