'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { sanitizeForEditor } from '@/lib/wp-html'
import {
  EditorLinkDialog, type LinkSpec,
  findAnchorAtSelection, saveSelection, restoreSelection, linkHtml, updateAnchor, unwrapAnchor,
} from '@/components/features/EditorLinkDialog'

type Tour = {
  id: string
  source: string | null
  source_product_code: string | null
  slug: string
  title: string
  country: string | null
  country_code: string | null
  city: string | null
  duration_min: number | null
  duration_label: string | null
  price_from: number | null
  currency: string | null
  rating: number | null
  review_count: number | null
  cover_image: string | null
  images: any
  booking_url: string | null
  tags: string[] | null
  summary_ai: string | null
  highlights_ai: any
  what_to_expect_ai: string | null
  good_to_know_ai: string | null
  category: string | null
  state_code: string | null
  active: boolean
  featured: boolean
}

const C = {
  bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280',
  teal: 'var(--brand)', tealDark: 'var(--brand-dark)', red: '#dc2626', amber: '#f59e0b',
}

export default function AdminTourEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [t, setT] = useState<Tour | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showHtml, setShowHtml] = useState(false)
  // Three rich-text fields the operator typically rewrites: summary, what to
  // expect, good to know. Each gets its own contentEditable editor.
  const summaryRef = useRef<HTMLDivElement>(null)
  const expectRef = useRef<HTMLDivElement>(null)
  const knowRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Link dialog state — shared across all three contentEditable areas.
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkInitial, setLinkInitial] = useState<LinkSpec>({ url: '', text: '', newTab: true })
  const [editingAnchor, setEditingAnchor] = useState<HTMLAnchorElement | null>(null)
  const [activeTarget, setActiveTarget] = useState<'summary' | 'expect' | 'know'>('summary')
  const savedRange = useRef<Range | null>(null)
  const refFor = (target: 'summary' | 'expect' | 'know') =>
    target === 'summary' ? summaryRef : target === 'expect' ? expectRef : knowRef

  // Load tour
  useEffect(() => {
    if (!id) return
    fetch(`/api/admin/tours/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setT(d.tour); setLoading(false) })
      .catch(e => { setError(`Failed to load tour (${e})`); setLoading(false) })
  }, [id])

  // Sync rich-text editors when the tour loads or showHtml flips back. We
  // sanitise each AI-generated field so any stray <script>/<style>/MS-Word
  // cruft never shows as raw code in the editor.
  useEffect(() => {
    if (!t || showHtml) return
    const summaryHtml = sanitizeForEditor(t.summary_ai || '')
    const expectHtml  = sanitizeForEditor(t.what_to_expect_ai || '')
    const knowHtml    = sanitizeForEditor(t.good_to_know_ai || '')
    if (summaryRef.current && summaryRef.current.innerHTML !== summaryHtml)
      summaryRef.current.innerHTML = summaryHtml
    if (expectRef.current && expectRef.current.innerHTML !== expectHtml)
      expectRef.current.innerHTML = expectHtml
    if (knowRef.current && knowRef.current.innerHTML !== knowHtml)
      knowRef.current.innerHTML = knowHtml
  }, [t, showHtml, loading])

  // Unsaved-changes guard
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  function setField<K extends keyof Tour>(k: K, v: Tour[K]) {
    if (!t) return
    setT({ ...t, [k]: v })
    setDirty(true)
  }

  // Toolbar exec
  function exec(target: 'summary' | 'expect' | 'know', cmd: string, val?: string) {
    const ref = target === 'summary' ? summaryRef : target === 'expect' ? expectRef : knowRef
    if (!ref.current) return
    ref.current.focus()
    document.execCommand(cmd, false, val)
    setDirty(true)
  }
  function openLinkDialog(target: 'summary' | 'expect' | 'know') {
    const ref = refFor(target)
    if (!ref.current) return
    ref.current.focus()
    setActiveTarget(target)
    savedRange.current = saveSelection()
    const anchor = findAnchorAtSelection(ref.current)
    if (anchor) {
      setEditingAnchor(anchor.node)
      setLinkInitial({ url: anchor.url, text: anchor.text, newTab: anchor.newTab })
    } else {
      const sel = window.getSelection()?.toString() || ''
      setEditingAnchor(null)
      setLinkInitial({ url: '', text: sel, newTab: true })
    }
    setLinkOpen(true)
  }
  function applyLinkSpec(spec: LinkSpec) {
    const ref = refFor(activeTarget)
    if (!ref.current) return
    ref.current.focus()
    restoreSelection(savedRange.current)
    if (editingAnchor) {
      updateAnchor(editingAnchor, spec)
    } else {
      document.execCommand('insertHTML', false, linkHtml(spec))
    }
    setLinkOpen(false); setEditingAnchor(null); setDirty(true)
  }
  function removeLinkSpec() {
    if (!editingAnchor) return
    unwrapAnchor(editingAnchor)
    setLinkOpen(false); setEditingAnchor(null); setDirty(true)
  }
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (e.shiftKey) return
    const html = e.clipboardData?.getData('text/html')
    const text = e.clipboardData?.getData('text/plain')
    if (html) {
      e.preventDefault()
      document.execCommand('insertHTML', false, sanitizeForEditor(html))
      setDirty(true)
      return
    }
    if (!text) return
    e.preventDefault()
    document.execCommand('insertText', false, text)
    setDirty(true)
  }

  async function uploadCover(file: File) {
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('folder', 'blog')
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) throw new Error(d.error || 'Upload failed')
      setField('cover_image', d.url)
    } catch (e: any) { alert(`Cover upload failed: ${e.message}`) }
  }

  async function save(opts: { newActive?: boolean; newFeatured?: boolean } = {}) {
    if (!t) return
    setSaving(true); setError('')
    try {
      const payload: any = {
        title: t.title,
        slug: t.slug,
        country: t.country,
        country_code: t.country_code,
        city: t.city,
        duration_min: t.duration_min,
        duration_label: t.duration_label,
        price_from: t.price_from,
        currency: t.currency,
        rating: t.rating,
        review_count: t.review_count,
        cover_image: t.cover_image,
        booking_url: t.booking_url,
        tags: t.tags || [],
        summary_ai: summaryRef.current?.innerHTML ?? t.summary_ai,
        what_to_expect_ai: expectRef.current?.innerHTML ?? t.what_to_expect_ai,
        good_to_know_ai: knowRef.current?.innerHTML ?? t.good_to_know_ai,
        category: t.category,
        state_code: t.state_code,
        active: opts.newActive ?? t.active,
        featured: opts.newFeatured ?? t.featured,
      }
      const r = await fetch(`/api/admin/tours/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || `Save failed (${r.status})`)
      }
      if (opts.newActive !== undefined) setT({ ...t, active: opts.newActive })
      if (opts.newFeatured !== undefined) setT({ ...t, featured: opts.newFeatured })
      setDirty(false)
      setSavedAt(new Date())
    } catch (e: any) { setError(e.message || 'Save failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.sub }}>Loading tour…</div>
  if (error && !t) return <div style={{ padding: 60, textAlign: 'center', color: C.red }}>{error}</div>
  if (!t) return null

  const liveUrl = `/tours/${t.slug}/`

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '16px 20px' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>

        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' as const }}>
          <Link href={`/admin/tours/?state=${t.state_code || ''}`} style={{ color: C.sub, fontSize: 13, textDecoration: 'none' }}>← Tours</Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
              {(t.state_code || '?').toUpperCase()} · {t.source || 'manual'} · {t.active ? 'active' : 'inactive'}{t.featured ? ' · featured' : ''}
            </div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600, whiteSpace: 'nowrap' as const, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const }}>{t.title}</div>
          </div>
          {savedAt && !dirty && <span style={{ fontSize: 12, color: '#16a34a' }}>✓ Saved {timeAgo(savedAt)}</span>}
          {dirty && <span style={{ fontSize: 12, color: C.amber }}>● Unsaved</span>}
          <a href={liveUrl} target="_blank" rel="noopener" style={secondaryBtn}>View live ↗</a>
          {t.booking_url && <a href={t.booking_url} target="_blank" rel="noopener" style={secondaryBtn}>Booking URL ↗</a>}
          <button disabled={saving} onClick={() => save({ newActive: !t.active })} style={secondaryBtn}>{t.active ? 'Deactivate' : 'Activate'}</button>
          <button disabled={saving} onClick={() => save({ newFeatured: !t.featured })} style={secondaryBtn}>{t.featured ? 'Unfeature' : 'Feature'}</button>
          <button disabled={saving || !dirty} onClick={() => save()} style={{ ...primaryBtn, opacity: !dirty || saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div className="ed-grid">
          {/* Editor column */}
          <div>
            {/* Title */}
            <input
              value={t.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="Tour title"
              style={{
                width: '100%', fontSize: 26, fontFamily: 'Georgia, serif', fontWeight: 800,
                color: C.text, padding: '12px 16px', borderRadius: 12, border: `1px solid ${C.border}`,
                background: C.card, marginBottom: 10, boxSizing: 'border-box' as const, outline: 'none',
              }}
            />

            {/* Summary editor */}
            <SectionCard title="Summary" subtitle="The short tagline shown on tour cards + tour-detail page header.">
              <RichToolbar onCmd={(c, v) => exec('summary', c, v)} onLink={() => openLinkDialog('summary')} />
              <div
                ref={summaryRef}
                contentEditable suppressContentEditableWarning
                onInput={() => setDirty(true)}
                onPaste={handlePaste}
                onClick={e => { if ((e.target as HTMLElement).closest('a')) e.preventDefault() }}
                style={richStyle(140)}
              />
            </SectionCard>

            {/* What to expect */}
            <SectionCard title="What to expect" subtitle="The detailed body — what guests will see, do and experience on the tour.">
              <RichToolbar onCmd={(c, v) => exec('expect', c, v)} onLink={() => openLinkDialog('expect')} />
              <div
                ref={expectRef}
                contentEditable suppressContentEditableWarning
                onInput={() => setDirty(true)}
                onPaste={handlePaste}
                onClick={e => { if ((e.target as HTMLElement).closest('a')) e.preventDefault() }}
                style={richStyle(320)}
              />
            </SectionCard>

            {/* Good to know */}
            <SectionCard title="Good to know" subtitle="Practical details — what to bring, restrictions, cancellation, meeting point.">
              <RichToolbar onCmd={(c, v) => exec('know', c, v)} onLink={() => openLinkDialog('know')} />
              <div
                ref={knowRef}
                contentEditable suppressContentEditableWarning
                onInput={() => setDirty(true)}
                onPaste={handlePaste}
                onClick={e => { if ((e.target as HTMLElement).closest('a')) e.preventDefault() }}
                style={richStyle(220)}
              />
            </SectionCard>

            <style jsx global>{`
              .ed-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; }
              @media (max-width: 920px) { .ed-grid { grid-template-columns: 1fr; } }
              [contenteditable]:empty::before { content: 'Start writing…'; color: #9ca3af; }
              [contenteditable] h2, [contenteditable] h3 { font-family: Georgia, serif; font-weight: 800; color: #111827; margin: 1.2em 0 0.4em; }
              [contenteditable] h2 { font-size: 22px; }
              [contenteditable] h3 { font-size: 18px; }
              [contenteditable] p { margin: 0 0 0.8em; }
              [contenteditable] ul, [contenteditable] ol { margin: 0 0 1em 1.4em; padding: 0; }
              [contenteditable] a { color: var(--brand); text-decoration: underline; }
              [contenteditable] blockquote { border-left: 4px solid var(--brand); padding: 8px 14px; color: #374151; background: var(--brand-light); margin: 0 0 1em; font-style: italic; }
            `}</style>
          </div>

          {/* Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            <Section title="Status">
              <Row label="Active"><Toggle on={t.active} onChange={v => setField('active', v)}/></Row>
              <Row label="Featured"><Toggle on={t.featured} onChange={v => setField('featured', v)}/></Row>
              <Row label="State"><input value={t.state_code || ''} onChange={e => setField('state_code', e.target.value || null)} style={inp} maxLength={6}/></Row>
            </Section>

            <Section title="Cover image">
              {t.cover_image ? (
                <div style={{ position: 'relative' as const }}>
                  <img src={t.cover_image} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }}/>
                  <button onClick={() => setField('cover_image', null)} style={{ position: 'absolute' as const, top: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                </div>
              ) : null}
              <label style={{ display: 'block', marginTop: 8, padding: '10px 12px', border: `1px dashed ${C.border}`, borderRadius: 8, textAlign: 'center' as const, cursor: 'pointer', color: C.sub, fontSize: 13 }}>
                📷 {t.cover_image ? 'Replace cover' : 'Upload cover'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = '' }}/>
              </label>
              <input value={t.cover_image || ''} onChange={e => setField('cover_image', e.target.value || null)} placeholder="…or paste image URL" style={{ ...inp, marginTop: 8, fontSize: 11 }}/>
            </Section>

            <Section title="Booking + price">
              <Row label="Booking URL"><input value={t.booking_url || ''} onChange={e => setField('booking_url', e.target.value || null)} placeholder="https://operator.example/book" style={inp}/></Row>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                <Row label="From price"><input type="number" step="0.01" value={t.price_from ?? ''} onChange={e => setField('price_from', e.target.value === '' ? null : Number(e.target.value))} style={inp}/></Row>
                <Row label="Currency"><input value={t.currency || ''} onChange={e => setField('currency', e.target.value || null)} style={inp} maxLength={4}/></Row>
              </div>
              <Row label="Duration label"><input value={t.duration_label || ''} onChange={e => setField('duration_label', e.target.value || null)} placeholder="e.g. 3 days, 8 hours" style={inp}/></Row>
              <Row label="Duration (minutes)"><input type="number" value={t.duration_min ?? ''} onChange={e => setField('duration_min', e.target.value === '' ? null : Number(e.target.value))} style={inp}/></Row>
            </Section>

            <Section title="Location">
              <Row label="Country"><input value={t.country || ''} onChange={e => setField('country', e.target.value || null)} style={inp}/></Row>
              <Row label="Country code"><input value={t.country_code || ''} onChange={e => setField('country_code', e.target.value || null)} style={inp} maxLength={2}/></Row>
              <Row label="City"><input value={t.city || ''} onChange={e => setField('city', e.target.value || null)} style={inp}/></Row>
            </Section>

            <Section title="Classification">
              <Row label="Category"><input value={t.category || ''} onChange={e => setField('category', e.target.value || null)} style={inp}/></Row>
              <Row label="Tags (comma-separated)"><input value={(t.tags || []).join(', ')} onChange={e => setField('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={inp}/></Row>
            </Section>

            <Section title="Rating + reviews">
              <Row label="Rating (0-5)"><input type="number" step="0.1" min={0} max={5} value={t.rating ?? ''} onChange={e => setField('rating', e.target.value === '' ? null : Number(e.target.value))} style={inp}/></Row>
              <Row label="Review count"><input type="number" value={t.review_count ?? ''} onChange={e => setField('review_count', e.target.value === '' ? null : Number(e.target.value))} style={inp}/></Row>
            </Section>

            <Section title="URL">
              <Row label="Slug"><input value={t.slug} onChange={e => setField('slug', e.target.value)} style={inp}/></Row>
              {t.source_product_code && (
                <div style={{ fontSize: 11, color: C.sub }}>Source product code: <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{t.source_product_code}</code></div>
              )}
            </Section>
          </aside>
        </div>
      </div>

      <EditorLinkDialog
        open={linkOpen}
        editing={!!editingAnchor}
        initial={linkInitial}
        onSave={applyLinkSpec}
        onRemove={removeLinkSpec}
        onCancel={() => { setLinkOpen(false); setEditingAnchor(null) }}
      />
    </div>
  )
}

// --- Helper components ---

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

function RichToolbar({ onCmd, onLink }: { onCmd: (cmd: string, val?: string) => void; onLink: () => void }) {
  const btn: React.CSSProperties = { minWidth: 30, height: 28, padding: '0 7px', fontSize: 12, color: C.text, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 6, alignItems: 'center' }}>
      <select onChange={e => { onCmd('formatBlock', `<${e.target.value}>`); e.target.value = '' }} defaultValue="" style={{ ...btn, padding: '0 6px' }}>
        <option value="" disabled>Style</option>
        <option value="p">Paragraph</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="blockquote">Quote</option>
      </select>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => onCmd('bold')} style={btn}><b>B</b></button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => onCmd('italic')} style={btn}><i>I</i></button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => onCmd('underline')} style={{ ...btn, textDecoration: 'underline' }}>U</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => onCmd('insertUnorderedList')} style={btn}>• ─</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => onCmd('insertOrderedList')} style={btn}>1.─</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={onLink} style={btn}>🔗</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => onCmd('unlink')} style={btn}>⛓✕</button>
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => onCmd('removeFormat')} style={btn}>⌫</button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>{children}</div>
    </div>
  )
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  )
}
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      style={{ background: on ? C.teal : C.border, color: '#fff', border: 'none', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
      {on ? 'ON' : 'OFF'}
    </button>
  )
}

const richStyle = (minH: number): React.CSSProperties => ({
  minHeight: minH, padding: '14px 18px', borderRadius: 10,
  border: `1px solid ${C.border}`, background: '#fff', color: C.text,
  fontSize: 15, lineHeight: 1.65, outline: 'none',
})
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, color: C.text, background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }
const primaryBtn: React.CSSProperties = { background: C.teal, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }
const secondaryBtn: React.CSSProperties = { background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }

function escHtml(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)) }
function escAttr(s: string) { return s.replace(/"/g, '&quot;') }
function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}
