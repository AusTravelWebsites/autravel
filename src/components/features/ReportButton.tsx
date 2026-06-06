'use client';
import { useEffect, useRef, useState } from 'react';

interface Props { targetType: 'post' | 'review' | 'trip' | 'user' | 'image' | 'meetup' | 'blog'; targetId: string }

const REASONS: Record<string, string[]> = {
  post: ['Spam', 'Harassment or bullying', 'Hate speech', 'Misinformation', 'Inappropriate content', 'Other'],
  review: ['Spam', 'Fake review', 'Harassment', 'Inappropriate content', 'Other'],
  trip: ['Spam', 'Inappropriate content', 'Harassment', 'Other'],
  user: ['Impersonation', 'Spam account', 'Harassment', 'Bot account', 'Other'],
  image: ['Inappropriate / NSFW', 'Violence', 'Spam', 'Copyright', 'Other'],
  meetup: ['Spam', 'Unsafe / risky', 'Inappropriate content', 'Scam', 'Other'],
  blog: ['Spam', 'Misinformation', 'Inappropriate content', 'Copyright', 'Other'],
};

export function ReportButton({ targetType, targetId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle'|'sending'|'done'|'error'>('idle');
  const [err, setErr] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const submit = async () => {
    if (!reason) return;
    setStatus('sending'); setErr('');
    try {
      const r = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_type: targetType, target_id: targetId, reason, notes: notes.trim() || undefined }) });
      if (r.status === 401) { setErr('Please sign in to report.'); setStatus('error'); return; }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || 'Failed'); setStatus('error'); return; }
      setStatus('done'); setTimeout(() => { setOpen(false); setReason(''); setNotes(''); setStatus('idle') }, 1500);
    } catch { setErr('Network error'); setStatus('error'); }
  };

  const teal = '#0d9488', sub = '#6b7280', border = '#e5e7eb', red = '#ef4444';
  return (
    <div ref={ref} style={{ position: 'relative' as const, display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: sub, fontSize: 12, cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }} aria-label="Report">Report</button>
      {open && (
        <div style={{ position: 'absolute' as const, right: 0, top: '100%', marginTop: 6, background: '#fff', border: `1px solid ${border}`, borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 50, width: 280, padding: 14 }}>
          {status === 'done' ? (
            <div style={{ color: teal, fontSize: 13, fontWeight: 600, textAlign: 'center' as const, padding: 8 }}>✓ Thanks — we'll review this.</div>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Report {targetType}</div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, marginBottom: 8 }}>
                {(REASONS[targetType] || REASONS.post).map(r => (
                  <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                    {r}
                  </label>
                ))}
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Extra details (optional)" rows={2} maxLength={1000}
                style={{ width: '100%', padding: '6px 10px', border: `1px solid ${border}`, borderRadius: 6, fontSize: 12, resize: 'vertical' as const, fontFamily: 'inherit', boxSizing: 'border-box' as const, outline: 'none', marginBottom: 8 }} />
              {err && <div style={{ color: red, fontSize: 12, marginBottom: 6 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setOpen(false)} style={{ flex: 1, background: '#fff', color: sub, border: `1px solid ${border}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={submit} disabled={!reason || status === 'sending'} style={{ flex: 1, background: reason ? red : '#e5e7eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: reason && status !== 'sending' ? 'pointer' : 'default', fontFamily: 'inherit' }}>{status === 'sending' ? 'Sending…' : 'Report'}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
