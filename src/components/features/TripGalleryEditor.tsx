'use client';
import { useEffect, useRef, useState } from 'react';

interface Props {
  tripId: string;
  ownerId: string;
  tripTitle: string;
  initial: string[];
}

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: '#0d9488', red: '#ef4444' };
const MAX_PHOTOS = 10;

export function TripGalleryEditor({ tripId, ownerId, tripTitle, initial }: Props) {
  const [photos, setPhotos] = useState<string[]>(initial || []);
  const [isOwner, setIsOwner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dragIndex = useRef<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Detect owner
  useEffect(() => {
    fetch('/api/users?me=1').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.user?.id === ownerId) setIsOwner(true);
    }).catch(() => {});
  }, [ownerId]);

  // Persist current order/contents to the server
  const persist = async (next: string[]) => {
    setSaving(true); setError('');
    try {
      const r = await fetch(`/api/trips?id=${tripId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gallery: next }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Save failed');
      }
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`Max ${MAX_PHOTOS} photos`);
      return;
    }
    setUploading(true); setError('');
    const added: string[] = [];
    try {
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        const fd = new FormData();
        fd.append('file', f);
        fd.append('folder', 'trips');
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.url) added.push(d.url);
        else setError(d.error || `Upload failed: ${f.name}`);
      }
      if (added.length) {
        const next = [...photos, ...added];
        setPhotos(next);
        await persist(next);
      }
    } finally { setUploading(false); }
  };

  const remove = async (url: string) => {
    const next = photos.filter(u => u !== url);
    setPhotos(next);
    await persist(next);
  };

  const onDragStart = (i: number) => (e: React.DragEvent) => {
    if (!isOwner) return;
    dragIndex.current = i;
    e.dataTransfer.effectAllowed = 'move';
    // For Firefox compatibility
    try { e.dataTransfer.setData('text/plain', String(i)); } catch {}
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!isOwner) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const onDrop = (i: number) => async (e: React.DragEvent) => {
    if (!isOwner) return;
    e.preventDefault();
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from == null || from === i) return;
    const next = photos.slice();
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    setPhotos(next);
    await persist(next);
  };

  // Non-owners: render the same static grid that was here before, no controls.
  if (!isOwner) {
    if (!photos.length) return null;
    return (
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: 'Georgia', fontSize: 20, margin: '0 0 12px', color: C.text }}>Gallery</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {photos.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden' as const, background: C.bg }}>
              <img src={url} alt={`${tripTitle} photo ${i + 1}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }} />
            </a>
          ))}
        </div>
      </div>
    );
  }

  // Owner view: add button + X on each + drag-to-reorder
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' as const }}>
        <h2 style={{ fontFamily: 'Georgia', fontSize: 20, margin: 0, color: C.text }}>Gallery</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: C.sub }}>{photos.length}/{MAX_PHOTOS}{saving ? ' · saving…' : ''}</span>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading || photos.length >= MAX_PHOTOS}
            style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: (uploading || photos.length >= MAX_PHOTOS) ? 'not-allowed' : 'pointer', opacity: (uploading || photos.length >= MAX_PHOTOS) ? 0.55 : 1, fontFamily: 'inherit' }}>
            {uploading ? 'Uploading…' : '+ Add photos'}
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple disabled={uploading} onChange={onFiles} style={{ display: 'none' }} />
        </div>
      </div>
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: C.red, fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {photos.length === 0 ? (
        <div style={{ background: C.card, border: `2px dashed ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center' as const, color: C.sub, fontSize: 14 }}>
          No photos yet. Click "+ Add photos" to upload up to {MAX_PHOTOS} images.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {photos.map((url, i) => (
              <div
                key={url}
                draggable
                onDragStart={onDragStart(i)}
                onDragOver={onDragOver}
                onDrop={onDrop(i)}
                style={{
                  position: 'relative' as const,
                  aspectRatio: '1 / 1',
                  borderRadius: 10,
                  overflow: 'hidden' as const,
                  background: C.bg,
                  cursor: 'grab',
                }}
              >
                <img src={url} alt={`${tripTitle} photo ${i + 1}`} draggable={false} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block', pointerEvents: 'none' as const }} />
                <button
                  type="button"
                  onClick={() => remove(url)}
                  aria-label="Remove photo"
                  style={{
                    position: 'absolute' as const, top: 6, right: 6,
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                    cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' as const,
                  }}
                >
                  ×
                </button>
                {i === 0 && (
                  <span style={{ position: 'absolute' as const, bottom: 6, left: 6, background: 'rgba(13,148,136,0.92)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Cover</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>Tip: drag photos to reorder — the first one becomes the cover.</div>
        </>
      )}
    </div>
  );
}
