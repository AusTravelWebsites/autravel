'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlaceAutocomplete } from '@/components/features/PlaceAutocomplete';

const C = { bg:'#f3f4f6', card:'#fff', border:'#e5e7eb', text:'#111827', sub:'#6b7280', teal:'var(--brand)', tealLight:'var(--brand-light)', red:'#ef4444' };

interface Props { slug?: string }

export function BlogEditor({ slug: existingSlug }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [body, setBody] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [category, setCategory] = useState<'blog' | 'review' | 'story'>('blog');
  const [location, setLocation] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [featuredAlt, setFeaturedAlt] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(!!existingSlug);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!existingSlug) return;
    fetch(`/api/blog/${existingSlug}`).then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.post) return;
      const p = d.post;
      setTitle(p.title || '');
      setSubtitle(p.subtitle || '');
      setBody(p.body || '');
      setExcerpt(p.excerpt || '');
      setCategory(p.category || 'blog');
      setLocation(p.location_name || '');
      setTagsText((p.tags || []).join(', '));
      setFeaturedImage(p.featured_image || '');
      setFeaturedAlt(p.featured_image_alt || '');
      setMetaTitle(p.meta_title || '');
      setMetaDescription(p.meta_description || '');
      setStatus(p.status === 'draft' ? 'draft' : 'published');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [existingSlug]);

  const uploadFeatured = async (file: File) => {
    setUploading(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'blog');
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) throw new Error(d.error || 'Upload failed');
      setFeaturedImage(d.url);
    } catch (e: any) { setErr(e.message); }
    finally { setUploading(false); }
  };

  const submit = async (publishOverride?: 'draft' | 'published') => {
    const finalStatus = publishOverride || status;
    if (!title.trim()) { setErr('Title is required.'); return; }
    if (!body.trim() || body.trim().length < 40) { setErr('Body must be at least 40 characters.'); return; }
    if (!featuredImage) { setErr('Please upload a featured image.'); return; }
    if (!location.trim()) { setErr('Location is required.'); return; }
    setSaving(true); setErr('');
    const tags = tagsText.split(',').map(s => s.trim()).filter(Boolean);
    try {
      const payload = { title, subtitle, body, excerpt, category, location_name: location, tags, featured_image: featuredImage, featured_image_alt: featuredAlt, meta_title: metaTitle, meta_description: metaDescription, status: finalStatus };
      const r = existingSlug
        ? await fetch(`/api/blog/${existingSlug}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/blog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Save failed');
      const newSlug = d.post?.slug || existingSlug;
      router.push(finalStatus === 'draft' ? '/blog?mine=1' : `/blog/${newSlug}`);
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const label: React.CSSProperties = { fontSize: 12, color: '#374151', fontWeight: 700, marginBottom: 6, display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.04em' };
  const inp: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, color: C.text, background: '#fff', boxSizing: 'border-box' as const, outline: 'none', fontFamily: 'inherit' };

  if (loading) return <div style={{ padding: 60, textAlign: 'center' as const, color: C.sub }}>Loading…</div>;

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 16px' }}>
        <Link href="/blog" style={{ color: C.sub, fontSize: 14, textDecoration: 'none' }}>← Back to blog</Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 800, color: C.text, margin: '12px 0 20px' }}>{existingSlug ? 'Edit post' : 'Write a post'}</h1>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column' as const, gap: 18 }}>

          {/* Category */}
          <div>
            <label style={label}>Category *</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {(['blog', 'review', 'story'] as const).map(k => (
                <button key={k} type="button" onClick={() => setCategory(k)} style={{ padding: '8px 18px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: category === k ? C.teal : '#fff', color: category === k ? '#fff' : C.sub, boxShadow: category === k ? 'none' : `0 0 0 1px ${C.border}`, textTransform: 'capitalize' as const, fontFamily: 'inherit' }}>{k}</button>
              ))}
            </div>
          </div>

          {/* Featured image */}
          <div>
            <label style={label}>Featured image *</label>
            {featuredImage ? (
              <div style={{ position: 'relative' as const, marginBottom: 10 }}>
                <img loading="lazy" decoding="async" src={featuredImage} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover' as const, borderRadius: 10, border: `1px solid ${C.border}` }} />
                <button type="button" onClick={() => setFeaturedImage('')} style={{ position: 'absolute' as const, top: 8, right: 8, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
              </div>
            ) : (
              <label style={{ ...inp, display: 'flex', alignItems: 'center', justifyContent: 'center' as const, padding: '32px 20px', border: `2px dashed ${C.border}`, cursor: uploading ? 'wait' : 'pointer', color: C.sub, flexDirection: 'column' as const, gap: 6 }}>
                <div style={{ fontSize: 28 }}>{uploading ? '⏳' : '📷'}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{uploading ? 'Uploading…' : 'Click to upload featured image'}</div>
                <div style={{ fontSize: 11 }}>Resized to 1280px WebP · shown as 1.91:1 cover</div>
                <input ref={fileRef} type="file" accept="image/*" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFeatured(f); e.target.value = '' }} style={{ display: 'none' }} />
              </label>
            )}
            {featuredImage && (
              <input value={featuredAlt} onChange={e => setFeaturedAlt(e.target.value)} placeholder="Alt text for accessibility + SEO (recommended)" maxLength={200} style={{ ...inp, marginTop: 8 }} />
            )}
          </div>

          {/* Title */}
          <div>
            <label style={label}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your post a clear, scannable title" maxLength={200} style={{ ...inp, fontSize: 18, fontWeight: 700 }} />
          </div>

          {/* Subtitle */}
          <div>
            <label style={label}>Subtitle <span style={{ color: C.sub, fontWeight: 400, textTransform: 'none' as const }}>(optional — one-liner under the title)</span></label>
            <input value={subtitle} onChange={e => setSubtitle(e.target.value)} maxLength={200} style={inp} />
          </div>

          {/* Location */}
          <div>
            <label style={label}>Location *</label>
            <PlaceAutocomplete value={location} onChange={setLocation} placeholder="Where is this post about?" inputStyle={inp} />
            <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>Pick from Google. Required so readers nearby can discover it.</div>
          </div>

          {/* Body */}
          <div>
            <label style={label}>Body *</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={14} placeholder="Write your post… Paragraphs are separated by blank lines." style={{ ...inp, minHeight: 260, resize: 'vertical' as const, lineHeight: 1.7, fontSize: 15 }} />
            <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{body.trim().split(/\s+/).filter(Boolean).length} words · ~{Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 200))} min read</div>
          </div>

          {/* Tags */}
          <div>
            <label style={label}>Tags <span style={{ color: C.sub, fontWeight: 400, textTransform: 'none' as const }}>(comma separated, max 10)</span></label>
            <input value={tagsText} onChange={e => setTagsText(e.target.value)} placeholder="hiking, solo, budget" style={inp} />
          </div>

          {/* SEO details */}
          <details style={{ background: '#f9fafb', padding: 14, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, color: C.text }}>SEO (optional)</summary>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              <div>
                <label style={label}>Excerpt</label>
                <input value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Short teaser — shown in lists & social cards" maxLength={220} style={inp} />
              </div>
              <div>
                <label style={label}>Meta title override</label>
                <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder="Leave blank to use post title" maxLength={70} style={inp} />
                <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{metaTitle.length}/70</div>
              </div>
              <div>
                <label style={label}>Meta description</label>
                <textarea value={metaDescription} onChange={e => setMetaDescription(e.target.value)} rows={2} placeholder="155 characters for Google result snippet. Leave blank to auto-generate from excerpt." maxLength={160} style={{ ...inp, resize: 'vertical' as const }} />
                <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{metaDescription.length}/160</div>
              </div>
            </div>
          </details>

          {err && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, color: C.red, fontSize: 13 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' as const, alignItems: 'center', flexWrap: 'wrap' as const, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
            <button type="button" disabled={saving} onClick={() => submit('draft')} style={{ background: '#fff', color: C.sub, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>Save as draft</button>
            <button type="button" disabled={saving} onClick={() => submit('published')} style={{ background: saving ? C.sub : C.teal, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{saving ? 'Saving…' : existingSlug ? 'Update' : 'Publish'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
