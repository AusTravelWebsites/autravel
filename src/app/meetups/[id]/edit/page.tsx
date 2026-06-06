'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete';

const CATS = ['food','hiking','nightlife','culture','adventure','wellness','tour','other'] as const;
const SCOPES = [
  { id: 'public', label: '🌍 Anyone (verified profiles only)' },
  { id: 'verified_only', label: '✓ Verified travellers only' },
  { id: 'friends_of_friends', label: '👥 Friends of friends' },
  { id: 'friends_only', label: '🤝 My friends only' },
] as const;

function dtLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditMeetupPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState<any>({
    title: '', description: '', location_name: '', meetup_date: '',
    max_attendees: '20', cover_image: '', category: 'food',
    scope: 'friends_of_friends', women_only: false, host_approval_required: false, min_age: '', recurrence: '',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/meetups/${id}`).then(r => {
      if (r.status === 404) { setNotFound(true); return null; }
      return r.ok ? r.json() : null;
    }).then(d => {
      const m = d?.meetup;
      if (!m) { setLoading(false); return; }
      setForm({
        title: m.title || '',
        description: m.description || '',
        location_name: m.location_name || '',
        meetup_date: dtLocal(m.meetup_date),
        max_attendees: String(m.max_attendees || 20),
        cover_image: m.cover_image || '',
        category: m.category || 'food',
        scope: m.scope || 'friends_of_friends',
        women_only: !!m.women_only,
        recurrence: m.recurrence || '',
        host_approval_required: !!m.host_approval_required,
        min_age: m.min_age ? String(m.min_age) : '',
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { setError('Title required'); return; }
    if (!form.meetup_date) { setError('Date & time required'); return; }
    setSubmitting(true); setError('');
    try {
      const r = await fetch('/api/meetups', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, ...form,
          max_attendees: parseInt(form.max_attendees) || 20,
          min_age: form.min_age ? parseInt(form.min_age) : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save');
      router.push(`/meetups/${id}`);
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  };

  if (notFound) return <div style={{ padding: 40, textAlign: 'center' }}>Meetup not found.</div>;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading…</div>;

  const inp = { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 14, background: '#fff', boxSizing: 'border-box' as const, outline: 'none' };
  const lbl = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 14, cursor: 'pointer', marginBottom: 20, padding: 0 }}>← Back</button>
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>Edit meetup</h1>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 18 }}>
            <div>
              <label style={lbl}>Cover image</label>
              {form.cover_image ? (
                <div style={{ position: 'relative' as const }}>
                  <img loading="lazy" decoding="async" src={form.cover_image} alt="" style={{ width: '100%', height: 180, objectFit: 'cover' as const, borderRadius: 10, border: '1px solid #e5e7eb' }} />
                  <button type="button" onClick={() => set('cover_image', '')}
                    style={{ position: 'absolute' as const, top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Remove</button>
                </div>
              ) : (
                <label style={{ display: 'block', border: '2px dashed #d1d5db', borderRadius: 10, padding: 24, textAlign: 'center' as const, cursor: 'pointer', color: '#6b7280', fontSize: 13 }}>
                  {uploading ? 'Uploading…' : 'Click to upload (recommended 1200×630)'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setUploading(true);
                    const fd = new FormData(); fd.append('file', f); fd.append('folder', 'meetup');
                    const r = await fetch('/api/upload', { method: 'POST', body: fd });
                    const d = await r.json(); setUploading(false);
                    if (d.url) set('cover_image', d.url); else setError(d.error || 'Upload failed');
                  }} />
                </label>
              )}
            </div>

            <div>
              <label style={lbl}>Category</label>
              <select style={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label style={lbl}>Title *</label>
              <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} />
            </div>

            <div>
              <label style={lbl}>Description</label>
              <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' as const }} value={form.description} onChange={e => set('description', e.target.value)} />
            </div>

            <div>
              <label style={lbl}>Location</label>
              <PlaceAutocomplete value={form.location_name} onChange={v => set('location_name', v)} placeholder="Venue or area" inputStyle={inp} />
            </div>

            <div>
              <label style={lbl}>Date & Time *</label>
              <input type="datetime-local" style={inp} value={form.meetup_date} onChange={e => set('meetup_date', e.target.value)} />
            </div>

            <div>
              <label style={lbl}>Max Attendees</label>
              <input type="number" min="2" max="500" style={inp} value={form.max_attendees} onChange={e => set('max_attendees', e.target.value)} />
            </div>

            <div>
              <label style={lbl}>Who can see and join?</label>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {SCOPES.map(o => (
                  <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1.5px solid ${form.scope === o.id ? '#0d9488' : '#e5e7eb'}`, borderRadius: 8, cursor: 'pointer', background: form.scope === o.id ? '#f0fdfa' : '#fff', fontSize: 13 }}>
                    <input type="radio" name="scope" checked={form.scope === o.id} onChange={() => set('scope', o.id)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="wo" checked={form.women_only} onChange={e => set('women_only', e.target.checked)} />
              <label htmlFor="wo" style={{ fontSize: 14, color: '#374151' }}>Women only</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="ap" checked={form.host_approval_required} onChange={e => set('host_approval_required', e.target.checked)} />
              <label htmlFor="ap" style={{ fontSize: 14, color: '#374151' }}>Approve attendees before confirming</label>
            </div>

            <div>
              <label style={lbl}>Minimum age (optional)</label>
              <input type="number" min="13" max="99" style={inp} value={form.min_age} onChange={e => set('min_age', e.target.value)} />
            </div>

            <div>
              <label style={lbl}>Repeat</label>
              <select style={inp} value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
                <option value="">One-off meetup</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <button onClick={save} disabled={submitting}
              style={{ background: submitting ? '#6b7280' : '#0d9488', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 15, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer', marginTop: 4 }}>
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
