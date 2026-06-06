'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete';

export default function NewMeetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    location_name: '',
    meetup_date: '',
    max_attendees: '20',
    is_public: true,
    cover_image: '',
    category: 'food',
    scope: 'friends_of_friends' as 'public' | 'verified_only' | 'friends_only' | 'friends_of_friends',
    women_only: false,
    host_approval_required: false,
    min_age: '',
    recurrence: '' as '' | 'weekly' | 'monthly',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string | boolean) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) { setError('Please add a title'); return; }
    if (!form.meetup_date) { setError('Please set a date and time'); return; }
    if (new Date(form.meetup_date) < new Date()) { setError('Meetup must be in the future'); return; }
    setSubmitting(true);
    setError('');
    try {
      const resp = await fetch('/api/meetups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          max_attendees: parseInt(form.max_attendees) || 20,
          min_age: form.min_age ? parseInt(form.min_age) : null,
          recurrence: form.recurrence || null,
        })
      });
      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error || 'Failed to create meetup');
      router.push('/meetups');
    } catch(e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    border: '1px solid #e5e7eb', fontSize: '14px', color: '#111827',
    background: '#fff', boxSizing: 'border-box' as const,
    outline: 'none',
  };
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6' }}>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 16px' }}>
        {/* Back */}
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '14px', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
          ← Back
        </button>

        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 24px' }}>🤝 Create a Meetup</h1>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>Cover image</label>
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
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="food">🍽️ Food & drinks</option>
                <option value="hiking">🥾 Hiking & outdoors</option>
                <option value="nightlife">🌃 Nightlife</option>
                <option value="culture">🏛️ Culture</option>
                <option value="adventure">🚀 Adventure</option>
                <option value="wellness">🧘 Wellness</option>
                <option value="tour">🗺️ Tour</option>
                <option value="other">✨ Other</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Title *</label>
              <input style={inputStyle} placeholder="e.g. Bali Travellers Sunset Drinks" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }}
                placeholder="What's the vibe? What will you do?"
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </div>

            <div>
              <label style={labelStyle}>Location</label>
              <PlaceAutocomplete
                value={form.location_name}
                onChange={v => set('location_name', v)}
                placeholder="e.g. Ku De Ta, Seminyak Bali"
                inputStyle={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Date & Time *</label>
              <input type="datetime-local" style={inputStyle} value={form.meetup_date} onChange={e => set('meetup_date', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Max Attendees</label>
              <input type="number" min="2" max="500" style={inputStyle} value={form.max_attendees} onChange={e => set('max_attendees', e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>Who can see and join?</label>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                {[
                  { id: 'public', label: '🌍 Anyone (open to strangers — verified profiles only)' },
                  { id: 'verified_only', label: '✓ Verified travellers only' },
                  { id: 'friends_of_friends', label: '👥 Friends of friends (mutual followers)' },
                  { id: 'friends_only', label: '🤝 My friends only' },
                ].map(o => (
                  <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: `1.5px solid ${form.scope === o.id ? '#0d9488' : '#e5e7eb'}`, borderRadius: 8, cursor: 'pointer', background: form.scope === o.id ? '#f0fdfa' : '#fff', fontSize: 13 }}>
                    <input type="radio" name="scope" value={o.id} checked={form.scope === o.id} onChange={() => set('scope', o.id)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="women_only" checked={form.women_only} onChange={e => set('women_only', e.target.checked)} />
              <label htmlFor="women_only" style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}>Women only</label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="approval" checked={form.host_approval_required} onChange={e => set('host_approval_required', e.target.checked)} />
              <label htmlFor="approval" style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}>I want to approve attendees before they're confirmed</label>
            </div>

            <div>
              <label style={labelStyle}>Minimum age (optional)</label>
              <input type="number" min="13" max="99" style={inputStyle} value={form.min_age} onChange={e => set('min_age', e.target.value)} placeholder="e.g. 18" />
            </div>

            <div>
              <label style={labelStyle}>Repeat</label>
              <select style={inputStyle} value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
                <option value="">One-off meetup</option>
                <option value="weekly">Weekly — same day / time</option>
                <option value="monthly">Monthly — same day of month</option>
              </select>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Recurring meetups auto-clone for the next cycle once the previous one passes.</div>
            </div>

            <button
              onClick={submit}
              disabled={submitting}
              style={{
                background: submitting ? '#6b7280' : '#0d9488', color: '#fff', border: 'none',
                borderRadius: '10px', padding: '12px', fontSize: '15px', fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '4px'
              }}
            >
              {submitting ? 'Creating...' : 'Create Meetup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
