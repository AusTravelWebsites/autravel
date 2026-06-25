'use client';
import { useEffect, useRef, useState } from 'react';

const C = { card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)' };

interface Props { meetupId: string; hostId: string; initialGallery: string[] }

export function MeetupGallery({ meetupId, hostId, initialGallery }: Props) {
  const [gallery, setGallery] = useState<string[]>(initialGallery || []);
  const [me, setMe] = useState<any>(null);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => {
      setMe(d?.user || null);
      if (d?.user) {
        fetch(`/api/meetups/${meetupId}`).then(r => r.ok ? r.json() : null).then(x => {
          if (x?.mine) setMyStatus(x.mine.status);
        });
      }
    });
  }, [meetupId]);

  const canUpload = !!me && (me.id === hostId || myStatus === 'going');
  const isHost = !!me && me.id === hostId;

  const onFile = async (file: File) => {
    setUploading(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'meetup-gallery');
      const ur = await fetch('/api/upload', { method: 'POST', body: fd });
      const ud = await ur.json();
      if (!ur.ok || !ud?.url) { setErr(ud?.error || 'Upload failed'); return; }
      const r = await fetch(`/api/meetups/${meetupId}/gallery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: ud.url }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || 'Failed'); return; }
      setGallery(d.gallery || []);
    } finally { setUploading(false); }
  };

  const remove = async (url: string) => {
    if (!confirm('Remove this photo?')) return;
    const r = await fetch(`/api/meetups/${meetupId}/gallery?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
    const d = await r.json();
    if (r.ok) setGallery(d.gallery || []);
  };

  if (!canUpload && gallery.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: C.text }}>Photos {gallery.length > 0 && <span style={{ color: C.sub, fontWeight: 500 }}>({gallery.length})</span>}</h2>
        {canUpload && gallery.length < 30 && (
          <>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? 'Uploading…' : '+ Add photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          </>
        )}
      </div>
      {err && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{err}</div>}
      {gallery.length === 0 ? (
        <div style={{ color: C.sub, fontSize: 13 }}>No photos yet. {canUpload ? 'Add one above.' : ''}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6 }}>
          {gallery.map(url => (
            <div key={url} style={{ position: 'relative' as const, aspectRatio: '1 / 1', background: '#e5e7eb', borderRadius: 8, overflow: 'hidden' as const, cursor: 'pointer' }}>
              <img loading="lazy" decoding="async" src={url} alt="" onClick={() => setLightbox(url)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }} />
              {isHost && (
                <button onClick={() => remove(url)} aria-label="Remove"
                  style={{ position: 'absolute' as const, top: 4, right: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 12, width: 24, height: 24, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}>×</button>
              )}
            </div>
          ))}
        </div>
      )}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, zIndex: 1000, cursor: 'zoom-out' as const, padding: 20 }}>
          <img loading="lazy" decoding="async" src={lightbox} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const }} />
        </div>
      )}
    </div>
  );
}
