'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LocationsMap } from './LocationsMap';

const C = { bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280', teal: 'var(--brand)', tealLight: 'var(--brand-light)', red: '#ef4444' };

interface Loc {
  id: string;
  user_id: string;
  country_code: string;
  country_name: string;
  place_name: string | null;
  category: string;
  notes: string | null;
  photos: string[] | null;
  is_public: boolean;
  created_at: string;
}

const CATEGORIES = [
  { id: 'all',           label: 'All',           emoji: '🌐' },
  { id: 'accommodation', label: 'Accommodation', emoji: '🛏' },
  { id: 'attraction',    label: 'Attractions',   emoji: '🎯' },
  { id: 'food',          label: 'Food',          emoji: '🍜' },
  { id: 'bar',           label: 'Bars',          emoji: '🍻' },
  { id: 'other',         label: 'Other',         emoji: '📍' },
];

export function LocationsClient({ username, displayName }: { username: string; displayName: string }) {
  const [locations, setLocations] = useState<Loc[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeCountry, setActiveCountry] = useState<{ name: string; code: string } | null>(null);
  const [filter, setFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [fName, setFName] = useState('');
  const [fCategory, setFCategory] = useState('attraction');
  const [fNotes, setFNotes] = useState('');
  const [fPhotos, setFPhotos] = useState<string[]>([]);
  const [fUploading, setFUploading] = useState(false);
  const [fPublic, setFPublic] = useState(true);
  const [fSubmitting, setFSubmitting] = useState(false);
  const [fError, setFError] = useState('');

  const load = () => {
    fetch(`/api/locations?username=${encodeURIComponent(username)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setLocations(d.locations || []); setIsOwner(!!d.is_owner); } setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [username]);

  const visitedSet = useMemo(() => {
    const s = new Set<string>();
    for (const l of locations) {
      s.add((l.country_name || '').toUpperCase());
      if (l.country_code) s.add(l.country_code.toUpperCase());
    }
    return s;
  }, [locations]);

  const visibleLocs = useMemo(() => {
    let list = locations;
    if (activeCountry) list = list.filter(l =>
      l.country_code === activeCountry.code || (l.country_name || '').toUpperCase() === activeCountry.name.toUpperCase()
    );
    if (filter !== 'all') list = list.filter(l => l.category === filter);
    return list;
  }, [locations, activeCountry, filter]);

  const onMapClick = ({ name, code }: { name: string; code: string }) => {
    setActiveCountry({ name, code });
    if (isOwner) setShowAdd(true);
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (fPhotos.length + files.length > 10) { setFError('Max 10 photos'); return; }
    setFUploading(true); setFError('');
    try {
      for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        const fd = new FormData();
        fd.append('file', f);
        fd.append('folder', 'locations');
        const r = await fetch('/api/upload', { method: 'POST', body: fd });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.url) setFPhotos(prev => [...prev, d.url]);
        else setFError(d.error || 'Upload failed');
      }
    } finally { setFUploading(false); }
  };

  const submit = async () => {
    if (!activeCountry) { setFError('Pick a country first'); return; }
    setFSubmitting(true); setFError('');
    try {
      const r = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_code: activeCountry.code,
          country_name: activeCountry.name,
          place_name: fName.trim() || null,
          category: fCategory,
          notes: fNotes.trim() || null,
          photos: fPhotos,
          is_public: fPublic,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setShowAdd(false);
      setFName(''); setFNotes(''); setFPhotos([]); setFCategory('attraction'); setFPublic(true);
      load();
    } catch (e: any) { setFError(e.message); }
    finally { setFSubmitting(false); }
  };

  const removeLoc = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    await fetch(`/api/locations?id=${id}`, { method: 'DELETE' });
    load();
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/${username}/locations` : '';
  const fbShare = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  const onCopyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  // Group visible locations by country for display
  const grouped = useMemo(() => {
    const m: Record<string, Loc[]> = {};
    for (const l of visibleLocs) {
      const k = l.country_name || '—';
      (m[k] = m[k] || []).push(l);
    }
    return m;
  }, [visibleLocs]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
            {isOwner ? 'Your Locations' : `${displayName}'s Locations`}
          </h1>
          <p style={{ color: C.sub, fontSize: 14, margin: 0 }}>
            {visitedSet.size > 0 ? `${visitedSet.size / 2 | 0}+ countries${activeCountry ? ` · viewing ${activeCountry.name}` : ''}` : 'No countries yet'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' as const }}>
            <button onClick={() => setShareOpen(o => !o)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: C.text, cursor: 'pointer' }}>
              Share
            </button>
            {shareOpen && (
              <div style={{ position: 'absolute' as const, top: '100%', right: 0, marginTop: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 30, overflow: 'hidden' as const }}>
                <a href={fbShare} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px 14px', fontSize: 13, color: C.text, textDecoration: 'none', borderBottom: `1px solid ${C.bg}` }}>📘 Share on Facebook</a>
                <button onClick={onCopyLink} style={{ width: '100%', textAlign: 'left' as const, padding: '10px 14px', fontSize: 13, color: C.text, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? '✓ Link copied!' : '🔗 Copy link'}</button>
              </div>
            )}
          </div>
          {isOwner && (
            <button onClick={() => { setShowAdd(true); if (!activeCountry) setActiveCountry({ name: '', code: '' }); }}
              style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + Add location
            </button>
          )}
        </div>
      </div>

      {/* Map */}
      <LocationsMap
        visited={visitedSet}
        onCountryClick={onMapClick}
        selectedCode={activeCountry?.code || null}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 20 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            style={{
              background: filter === c.id ? C.teal : C.card,
              color: filter === c.id ? '#fff' : C.text,
              border: `1px solid ${filter === c.id ? C.teal : C.border}`,
              borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            {c.emoji} {c.label}
          </button>
        ))}
        {activeCountry && (
          <button onClick={() => setActiveCountry(null)} style={{ marginLeft: 8, background: 'transparent', color: C.sub, border: `1px solid ${C.border}`, borderRadius: 999, padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Clear country
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ marginTop: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center' as const, padding: 40, color: C.sub }}>Loading…</div>
        ) : visibleLocs.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center' as const, color: C.sub }}>
            {isOwner ? 'No locations here yet — click a country on the map to add one.' : 'Nothing to show yet.'}
          </div>
        ) : (
          Object.entries(grouped).map(([country, items]) => (
            <div key={country} style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, color: C.text, margin: '0 0 12px' }}>{country} <span style={{ color: C.sub, fontSize: 14, fontWeight: 400 }}>({items.length})</span></h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {items.map(l => (
                  <div key={l.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
                    {l.photos && l.photos.length > 0 && (
                      <div style={{ height: 140, background: C.bg, position: 'relative' as const }}>
                        <img loading="lazy" decoding="async" src={l.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }} />
                        {l.photos.length > 1 && (
                          <span style={{ position: 'absolute' as const, top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>+{l.photos.length - 1}</span>
                        )}
                      </div>
                    )}
                    <div style={{ padding: 14 }}>
                      <div style={{ fontSize: 11, color: C.teal, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 }}>
                        {CATEGORIES.find(c => c.id === l.category)?.emoji} {l.category}
                      </div>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 15, marginBottom: 4 }}>{l.place_name || l.country_name}</div>
                      {l.notes && <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.5 }}>{l.notes}</div>}
                      {isOwner && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.bg}`, display: 'flex', gap: 12, fontSize: 12 }}>
                          <span style={{ color: l.is_public ? C.teal : C.sub }}>{l.is_public ? '🌍 Public' : '🔒 Private'}</span>
                          <button onClick={() => removeLoc(l.id)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: 0 }}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add modal */}
      {showAdd && isOwner && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' as const, zIndex: 1000, padding: 16 }}
          onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' as const }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 16px' }}>
              Add a location
              {activeCountry?.name && <span style={{ display: 'block', fontSize: 14, fontWeight: 400, color: C.sub, marginTop: 4, fontFamily: 'system-ui' }}>in {activeCountry.name}</span>}
            </h2>
            {(!activeCountry || !activeCountry.name) && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', color: '#92400e', fontSize: 13, marginBottom: 16 }}>
                Click a country on the map first to choose where this location is.
              </div>
            )}
            {fError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: C.red, fontSize: 13, marginBottom: 16 }}>{fError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Place name</label>
                <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. Ku De Ta Beach Club"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.text, background: '#fff', boxSizing: 'border-box' as const, outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Category</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 6 }}>
                  {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                    <button key={c.id} onClick={() => setFCategory(c.id)} style={{
                      background: fCategory === c.id ? C.tealLight : C.bg,
                      border: `1px solid ${fCategory === c.id ? C.teal : 'transparent'}`,
                      borderRadius: 8, padding: '10px 8px', fontSize: 13, fontWeight: 600,
                      color: fCategory === c.id ? C.teal : C.text, cursor: 'pointer', fontFamily: 'inherit',
                    }}>{c.emoji} {c.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Notes</label>
                <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Anything memorable…" rows={3}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, color: C.text, background: '#fff', boxSizing: 'border-box' as const, outline: 'none', fontFamily: 'inherit', resize: 'vertical' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Photos (up to 10)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8 }}>
                  {fPhotos.map(url => (
                    <div key={url} style={{ position: 'relative' as const, width: 72, height: 72, borderRadius: 8, overflow: 'hidden' as const, border: `1px solid ${C.border}` }}>
                      <img loading="lazy" decoding="async" src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }} />
                      <button onClick={() => setFPhotos(p => p.filter(u => u !== url))} aria-label="Remove" style={{ position: 'absolute' as const, top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', fontSize: 12, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>
                    </div>
                  ))}
                  {fPhotos.length < 10 && (
                    <label style={{ width: 72, height: 72, borderRadius: 8, border: `2px dashed ${C.border}`, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center' as const, gap: 2, cursor: fUploading ? 'wait' : 'pointer', color: C.sub, fontSize: 11, fontWeight: 600 }}>
                      <span style={{ fontSize: 18 }}>{fUploading ? '…' : '+'}</span>
                      {fUploading ? 'Uploading' : 'Photo'}
                      <input type="file" accept="image/*" multiple disabled={fUploading} onChange={onFiles} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="loc_public" checked={fPublic} onChange={e => setFPublic(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="loc_public" style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}>Public — friends & followers can see this</label>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' as const, marginTop: 4 }}>
                <button onClick={() => setShowAdd(false)} style={{ background: C.bg, border: 'none', borderRadius: 8, padding: '10px 20px', color: C.sub, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={submit} disabled={fSubmitting || !activeCountry?.name} style={{ background: C.teal, border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', fontSize: 14, fontWeight: 700, cursor: fSubmitting ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: fSubmitting || !activeCountry?.name ? 0.6 : 1 }}>
                  {fSubmitting ? 'Saving…' : 'Save location'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
