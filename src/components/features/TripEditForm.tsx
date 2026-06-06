'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete';

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', tealLight: '#f0fdfa', red: '#ef4444' };
const MAX_PHOTOS = 10;

interface TaggedUser { id: string; username: string; display_name: string; avatar_url?: string | null }

interface Props { id: string; backHref?: string; afterSaveHref?: string }

export function TripEditForm({ id, backHref, afterSaveHref }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [title, setTitle] = useState('');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [coverEmoji, setCoverEmoji] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [tagged, setTagged] = useState<TaggedUser[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Tag autocomplete
  const [tagQ, setTagQ] = useState('');
  const [tagResults, setTagResults] = useState<TaggedUser[]>([]);
  const [tagOpen, setTagOpen] = useState(false);
  const tagWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meR = await fetch('/api/users?me=1');
        if (!meR.ok) { router.push('/login'); return; }
        const meD = await meR.json();
        const tR = await fetch(`/api/trips?id=${id}`);
        if (!tR.ok) { setError('Trip not found'); setLoading(false); return; }
        const tD = await tR.json();
        const t = tD.trip;
        if (cancelled) return;
        if (meD.user.id !== t.user_id) {
          setError('Only the trip owner can edit this');
          setLoading(false); return;
        }
        setAllowed(true);
        setTitle(t.title || '');
        setLocationName(t.location_name || '');
        setDescription(t.description || '');
        setStartDate((t.start_date || t.started_at || '').slice(0, 10));
        setEndDate((t.end_date || t.ended_at || '').slice(0, 10));
        setCoverEmoji(t.cover_emoji || '');
        setIsPublic(t.is_public !== false);
        setPhotos(Array.isArray(t.gallery) ? t.gallery : []);

        // Resolve already-tagged users to chip metadata
        if (Array.isArray(t.tagged_user_ids) && t.tagged_user_ids.length > 0) {
          try {
            const resolved: TaggedUser[] = [];
            for (const uid of t.tagged_user_ids.slice(0, 30)) {
              const ur = await fetch('/api/users/search?q=' + encodeURIComponent(uid));
              if (!ur.ok) continue;
              const ud = await ur.json();
              const found = (ud.users || []).find((u: any) => u.id === uid);
              if (found) resolved.push(found);
            }
            if (!cancelled) setTagged(resolved);
          } catch {}
        }
        setLoading(false);
      } catch { setError('Failed to load'); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, router]);

  // User-tag autocomplete
  useEffect(() => {
    const t = setTimeout(async () => {
      const q = tagQ.trim();
      if (q.length < 1) { setTagResults([]); return; }
      try {
        const r = await fetch('/api/users/search?q=' + encodeURIComponent(q));
        if (!r.ok) return;
        const d = await r.json();
        const have = new Set(tagged.map(u => u.id));
        setTagResults((d.users || []).filter((u: any) => !have.has(u.id)));
        setTagOpen(true);
      } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [tagQ, tagged]);

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (tagWrap.current && !tagWrap.current.contains(e.target as Node)) setTagOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const addTag = (u: TaggedUser) => { setTagged(prev => [...prev, u]); setTagQ(''); setTagResults([]); setTagOpen(false); };
  const removeTag = (uid: string) => setTagged(prev => prev.filter(u => u.id !== uid));

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) { setError(`Max ${MAX_PHOTOS} photos`); return; }
    setUploading(true); setError('');
    try {
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        const fd = new FormData();
        fd.append('file', f);
        fd.append('folder', 'trips');
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.url) setPhotos(prev => [...prev, d.url]);
        else setError(d.error || `Upload failed: ${f.name}`);
      }
    } finally { setUploading(false); }
  };

  const removePhoto = (url: string) => setPhotos(prev => prev.filter(u => u !== url));

  const submit = async () => {
    if (!title.trim()) { setError('Title required'); return; }
    if (!locationName.trim()) { setError('Location required'); return; }
    setSubmitting(true); setError('');
    try {
      const r = await fetch(`/api/trips?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          location_name: locationName.trim(),
          description: description.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          cover_emoji: coverEmoji || null,
          is_public: isPublic,
          tagged_user_ids: tagged.map(u => u.id),
          gallery: photos,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      router.push(afterSaveHref || `/trips/${id}`);
    } catch (e: any) { setError(e.message); setSubmitting(false); }
  };

  const inp = { width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.text, background: '#fff', boxSizing: 'border-box' as const, outline: 'none' };
  const label = { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 };

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, padding: 80, textAlign: 'center' as const, color: C.sub }}>Loading…</div>;
  if (!allowed) return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: 80, textAlign: 'center' as const }}>
      <p style={{ color: C.red, fontSize: 14, marginBottom: 16 }}>{error || 'Not authorized'}</p>
      <Link href={backHref || `/trips/${id}`} style={{ color: C.teal, fontWeight: 600 }}>← Back to trip</Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
        <Link href={backHref || `/trips/${id}`} style={{ color: C.sub, fontSize: 14, textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>← Back to trip</Link>
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 24px' }}>Edit trip</h1>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 18 }}>
            <div>
              <label style={label}>Title *</label>
              <input style={inp} value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <label style={label}>Location *</label>
              <PlaceAutocomplete
                value={locationName}
                onChange={setLocationName}
                placeholder="e.g. Bali, Indonesia"
                inputStyle={inp}
              />
              <div style={{ color: C.sub, fontSize: 11, marginTop: 4 }}>Pick a place from Google — this is the main destination for your trip.</div>
            </div>
            <div>
              <label style={label}>Description</label>
              <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' as const }} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Start date</label>
                <input type="date" style={inp} value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>End date</label>
                <input type="date" style={inp} value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={label}>Cover emoji</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 64, height: 64, borderRadius: 12, background: C.tealLight, border: `1px solid #99f6e4`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, flexShrink: 0 }}>
                  {coverEmoji || '🌏'}
                </div>
                <input
                  style={{ ...inp, maxWidth: 140 }}
                  value={coverEmoji}
                  onChange={e => setCoverEmoji(e.target.value)}
                  placeholder="Type or pick"
                  maxLength={8}
                />
                {coverEmoji && (
                  <button type="button" onClick={() => setCoverEmoji('')} style={{ background: 'none', border: 'none', color: C.sub, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 6, padding: 10, background: '#f9fafb', borderRadius: 10, border: `1px solid ${C.border}` }}>
                {['🌏','✈️','🏔️','🏖️','🏝️','🏕️','🗺️','🏛️','🍜','📸','🚴','🎒'].map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setCoverEmoji(em)}
                    aria-label={`Use ${em}`}
                    style={{
                      fontSize: 22,
                      padding: 6,
                      background: coverEmoji === em ? C.tealLight : '#fff',
                      border: `1px solid ${coverEmoji === em ? '#99f6e4' : C.border}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      lineHeight: 1,
                      fontFamily: 'inherit',
                    }}
                  >{em}</button>
                ))}
              </div>
            </div>

            {/* Tag friends */}
            <div ref={tagWrap} style={{ position: 'relative' as const }}>
              <label style={label}>Tag friends you met or travelled with</label>
              {tagged.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap' as const, gap:6, marginBottom:8 }}>
                  {tagged.map(u => (
                    <span key={u.id} style={{ display:'inline-flex', alignItems:'center', gap:6, background:C.tealLight, color:C.teal, border:'1px solid #99f6e4', borderRadius:99, padding:'4px 10px 4px 4px', fontSize:13, fontWeight:600 }}>
                      {u.avatar_url
                        ? <img loading="lazy" decoding="async" src={u.avatar_url} alt="" style={{ width:20, height:20, borderRadius:'50%', objectFit:'cover' as const }} />
                        : <span style={{ width:20, height:20, borderRadius:'50%', background:C.teal, color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>{(u.display_name || u.username)[0].toUpperCase()}</span>}
                      @{u.username}
                      <button type="button" onClick={() => removeTag(u.id)} aria-label={`Remove ${u.username}`} style={{ background:'none', border:'none', color:C.teal, cursor:'pointer', padding:0, fontSize:16, lineHeight:1 }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <input style={inp} placeholder="Search by username or display name…" value={tagQ} onChange={e => setTagQ(e.target.value)} onFocus={() => tagResults.length > 0 && setTagOpen(true)} />
              {tagOpen && tagResults.length > 0 && (
                <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', zIndex: 40, maxHeight: 240, overflowY: 'auto' as const }}>
                  {tagResults.map(u => (
                    <button key={u.id} type="button" onClick={() => addTag(u)} style={{ width:'100%', textAlign:'left' as const, display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'none', border:'none', borderBottom:`1px solid ${C.bg}`, cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>
                      {u.avatar_url
                        ? <img loading="lazy" decoding="async" src={u.avatar_url} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' as const }} />
                        : <span style={{ width:28, height:28, borderRadius:'50%', background:C.teal, color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 }}>{(u.display_name || u.username || '?')[0].toUpperCase()}</span>}
                      <span style={{ fontWeight:600, color:C.text }}>{u.display_name || u.username}</span>
                      <span style={{ color:C.sub, fontSize:12 }}>@{u.username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Photo gallery */}
            <div>
              <label style={label}>Photo gallery (up to {MAX_PHOTOS})</label>
              <div style={{ display:'flex', flexWrap:'wrap' as const, gap:8 }}>
                {photos.map(url => (
                  <div key={url} style={{ position:'relative' as const, width:84, height:84, borderRadius:8, overflow:'hidden' as const, border:`1px solid ${C.border}` }}>
                    <img loading="lazy" decoding="async" src={url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' as const }} />
                    <button type="button" onClick={() => removePhoto(url)} aria-label="Remove" style={{ position:'absolute' as const, top:4, right:4, width:20, height:20, borderRadius:'50%', background:'rgba(0,0,0,0.7)', color:'#fff', border:'none', cursor:'pointer', fontSize:12, lineHeight:'18px', padding:0 }}>×</button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label style={{ width:84, height:84, borderRadius:8, border:`2px dashed ${C.border}`, display:'flex', flexDirection:'column' as const, alignItems:'center', justifyContent:'center' as const, gap:4, cursor: uploading ? 'wait' : 'pointer', color:C.sub, fontSize:11, fontWeight:600 }}>
                    <span style={{ fontSize:20, lineHeight:1 }}>{uploading ? '…' : '+'}</span>
                    <span>{uploading ? 'Uploading' : 'Photo'}</span>
                    <input type="file" accept="image/*" multiple disabled={uploading} onChange={onFiles} style={{ display:'none' }} />
                  </label>
                )}
              </div>
              <div style={{ color:C.sub, fontSize:11, marginTop:6 }}>{photos.length}/{MAX_PHOTOS} added · resized to 1280px WebP, stored on Cloudflare R2</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="is_public" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="is_public" style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}>Public trip (visible to everyone)</label>
            </div>
            <button onClick={submit} disabled={submitting} style={{ background: submitting ? C.sub : C.teal, color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', marginTop: 4 }}>
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
