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

type Article = {
  id: string
  state_code: string
  slug: string
  legacy_path: string | null
  title: string
  excerpt: string | null
  body_html: string | null
  cover_image: string | null
  categories: string[] | null
  tags: string[] | null
  destination_slug: string | null
  author: string | null
  author_slug: string | null
  status: string
  published_at: string | null
  noindex: boolean | null
  seo_title: string | null
  seo_description: string | null
}
type AuthorOption = { slug: string; name: string; role: string | null }

const C = {
  bg: '#f3f4f6', card: '#fff', border: '#e5e7eb', text: '#111827', sub: '#6b7280',
  teal: 'var(--brand)', tealDark: 'var(--brand-dark)', tealLight: 'var(--brand-light)', red: '#dc2626', amber: '#f59e0b',
}

export default function AdminArticleEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [a, setA] = useState<Article | null>(null)
  const [authors, setAuthors] = useState<AuthorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showHtml, setShowHtml] = useState(false)
  // bodyHtml is the single source of truth, synced between WYSIWYG (innerHTML)
  // and the HTML <textarea>. The contentEditable div is otherwise uncontrolled
  // — React doesn't drive every keystroke or the caret jumps around.
  const [bodyHtml, setBodyHtml] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Link dialog state
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkInitial, setLinkInitial] = useState<LinkSpec>({ url: '', text: '', newTab: false })
  const [editingAnchor, setEditingAnchor] = useState<HTMLAnchorElement | null>(null)
  const savedRange = useRef<Range | null>(null)

  // Load article
  useEffect(() => {
    if (!id) return
    fetch(`/api/admin/articles/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => {
        setA(d.article)
        // Stronger than processWpShortcodes — also strips <script>, <style>,
        // Word-paste XML, deprecated <font>, mso-* styles, etc. so the editor
        // never shows literal markup as text. First save persists the cleaned
        // version back to body_html.
        setBodyHtml(sanitizeForEditor(d.article.body_html || ''))
        setLoading(false)
        // Fetch authors visible on this article's tenant for the dropdown.
        fetch(`/api/admin/authors?state=${d.article.state_code}`)
          .then(r => r.ok ? r.json() : { authors: [] })
          .then(j => setAuthors(j.authors || []))
          .catch(() => {})
      })
      .catch(e => { setError(`Failed to load article (${e})`); setLoading(false) })
  }, [id])

  // Populate the WYSIWYG when it first mounts after the article loads, AND
  // whenever bodyHtml changes externally (via load or toggle). We don't update
  // bodyHtml on every keystroke, so this won't fight the user's caret.
  useEffect(() => {
    if (!showHtml && editorRef.current && editorRef.current.innerHTML !== bodyHtml) {
      editorRef.current.innerHTML = bodyHtml
    }
  }, [showHtml, bodyHtml, loading])

  // Beforeunload guard for unsaved changes
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // Patch helper
  function setField<K extends keyof Article>(k: K, v: Article[K]) {
    if (!a) return
    setA({ ...a, [k]: v })
    setDirty(true)
  }

  // ---- Toolbar actions (classic execCommand WP-style) ----
  function exec(cmd: string, val?: string) {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(cmd, false, val)
    setDirty(true)
  }
  function formatBlock(tag: string) { exec('formatBlock', `<${tag}>`) }

  // ---- Link dialog (replaces the old prompt) ----
  // Opens the modal with prefilled values either from an existing <a> at the
  // caret OR from the current text selection. Saves the Range first so we can
  // restore the caret position after the user clicks into the dialog input.
  function openLinkDialog() {
    if (!editorRef.current) return
    editorRef.current.focus()
    savedRange.current = saveSelection()
    const anchor = findAnchorAtSelection(editorRef.current)
    if (anchor) {
      setEditingAnchor(anchor.node)
      setLinkInitial({ url: anchor.url, text: anchor.text, newTab: anchor.newTab })
    } else {
      const sel = window.getSelection()?.toString() || ''
      setEditingAnchor(null)
      // Default external URLs to new-tab; relative paths stay same-tab.
      setLinkInitial({ url: '', text: sel, newTab: true })
    }
    setLinkOpen(true)
  }
  function applyLinkSpec(spec: LinkSpec) {
    if (!editorRef.current) return
    editorRef.current.focus()
    restoreSelection(savedRange.current)
    if (editingAnchor) {
      updateAnchor(editingAnchor, spec)
    } else {
      document.execCommand('insertHTML', false, linkHtml(spec))
    }
    setLinkOpen(false); setEditingAnchor(null); setDirty(true)
  }
  function removeLinkSpec() {
    if (!editorRef.current || !editingAnchor) return
    unwrapAnchor(editingAnchor)
    setLinkOpen(false); setEditingAnchor(null); setDirty(true)
  }
  function unlink() { exec('unlink') }
  function insertImage() { fileRef.current?.click() }
  async function uploadImage(file: File) {
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'blog')
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) throw new Error(d.error || 'Upload failed')
      exec('insertHTML', `<p><img src="${escAttr(d.url)}" alt="" loading="lazy" /></p>`)
    } catch (e: any) {
      alert(`Image upload failed: ${e.message}`)
    }
  }
  async function uploadCover(file: File) {
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'blog')
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) throw new Error(d.error || 'Upload failed')
      setField('cover_image', d.url)
    } catch (e: any) {
      alert(`Cover upload failed: ${e.message}`)
    }
  }

  // ---- Mode toggle: capture current view's content into bodyHtml first ----
  function toggleHtmlView() {
    if (!showHtml && editorRef.current) {
      setBodyHtml(editorRef.current.innerHTML)
    } else if (showHtml) {
      const ta = document.getElementById('html-source') as HTMLTextAreaElement | null
      if (ta) setBodyHtml(ta.value)
    }
    setShowHtml(v => !v)
  }

  // ---- Save ----
  async function save(opts: { newStatus?: string } = {}) {
    if (!a) return
    setSaving(true); setError('')
    try {
      const body_html = showHtml
        ? (document.getElementById('html-source') as HTMLTextAreaElement | null)?.value ?? bodyHtml
        : editorRef.current?.innerHTML ?? bodyHtml
      const payload = {
        title: a.title,
        excerpt: a.excerpt,
        body_html,
        cover_image: a.cover_image,
        tags: a.tags || [],
        categories: a.categories || [],
        slug: a.slug,
        legacy_path: a.legacy_path,
        author: a.author,
        author_slug: a.author_slug,
        status: opts.newStatus || a.status,
        noindex: a.noindex,
        seo_title: a.seo_title,
        seo_description: a.seo_description,
        destination_slug: a.destination_slug,
      }
      const r = await fetch(`/api/admin/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || `Save failed (${r.status})`)
      }
      if (opts.newStatus) setA({ ...a, status: opts.newStatus })
      setDirty(false)
      setSavedAt(new Date())
    } catch (e: any) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ---- Render ----
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.sub }}>Loading article…</div>
  if (error && !a) return <div style={{ padding: 60, textAlign: 'center', color: C.red }}>{error}</div>
  if (!a) return null

  const liveUrl = a.legacy_path || `/articles/${a.slug}/`

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '16px 20px' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>

        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' as const }}>
          <Link href={`/admin/articles/?state=${a.state_code}`} style={{ color: C.sub, fontSize: 13, textDecoration: 'none' }}>← Articles</Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{a.state_code.toUpperCase()} · {a.status}{a.noindex ? ' · noindex' : ''}</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600, whiteSpace: 'nowrap' as const, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const }}>{a.title}</div>
          </div>
          {savedAt && !dirty && <span style={{ fontSize: 12, color: '#16a34a' }}>✓ Saved {timeAgo(savedAt)}</span>}
          {dirty && <span style={{ fontSize: 12, color: C.amber }}>● Unsaved</span>}
          <a href={liveUrl} target="_blank" rel="noopener" style={{ ...secondaryBtn }}>View live ↗</a>
          {a.status !== 'published' && <button disabled={saving} onClick={() => save({ newStatus: 'published' })} style={secondaryBtn}>Publish</button>}
          {a.status === 'published' && <button disabled={saving} onClick={() => save({ newStatus: 'draft' })} style={secondaryBtn}>Unpublish</button>}
          <button disabled={saving || !dirty} onClick={() => save()} style={{ ...primaryBtn, opacity: !dirty || saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: C.red, fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {/* Layout: editor (left) + sidebar (right). On screens < 920px the
            sidebar stacks below so the editor gets full width. */}
        <div className="ed-grid">

          {/* Editor column */}
          <div>
            {/* Title */}
            <input
              value={a.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="Title"
              style={{
                width: '100%', fontSize: 30, fontFamily: 'Georgia, serif', fontWeight: 800,
                color: C.text, padding: '14px 18px', borderRadius: 12, border: `1px solid ${C.border}`,
                background: C.card, marginBottom: 10, boxSizing: 'border-box' as const, outline: 'none',
              }}
            />

            {/* Toolbar */}
            <div style={{
              position: 'sticky' as const, top: 8, zIndex: 5,
              background: '#fafafa', border: `1px solid ${C.border}`, borderRadius: 10,
              padding: 8, marginBottom: 10,
              display: 'flex', flexWrap: 'wrap' as const, gap: 4, alignItems: 'center',
            }}>
              <select onChange={e => { formatBlock(e.target.value); e.target.value = '' }} defaultValue="" style={tbSelect}>
                <option value="" disabled>Paragraph / Heading</option>
                <option value="p">Paragraph</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
                <option value="h4">Heading 4</option>
                <option value="blockquote">Blockquote</option>
                <option value="pre">Preformatted</option>
              </select>
              <Sep />
              <TBtn onClick={() => exec('bold')} title="Bold (⌘B)"><b>B</b></TBtn>
              <TBtn onClick={() => exec('italic')} title="Italic (⌘I)"><i>I</i></TBtn>
              <TBtn onClick={() => exec('underline')} title="Underline (⌘U)" style={{ textDecoration: 'underline' }}>U</TBtn>
              <TBtn onClick={() => exec('strikeThrough')} title="Strikethrough" style={{ textDecoration: 'line-through' }}>S</TBtn>
              <Sep />
              <TBtn onClick={() => exec('insertUnorderedList')} title="Bullet list">• ─</TBtn>
              <TBtn onClick={() => exec('insertOrderedList')} title="Numbered list">1. ─</TBtn>
              <TBtn onClick={() => exec('outdent')} title="Decrease indent">⇤</TBtn>
              <TBtn onClick={() => exec('indent')} title="Increase indent">⇥</TBtn>
              <Sep />
              <TBtn onClick={() => exec('justifyLeft')} title="Align left">⇉</TBtn>
              <TBtn onClick={() => exec('justifyCenter')} title="Align center">≡</TBtn>
              <TBtn onClick={() => exec('justifyRight')} title="Align right">⇇</TBtn>
              <Sep />
              <TBtn onClick={openLinkDialog} title="Insert / edit link (⌘K)">🔗</TBtn>
              <TBtn onClick={unlink} title="Remove link">⛓ ✕</TBtn>
              <TBtn onClick={insertImage} title="Insert image">🖼</TBtn>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
              <Sep />
              <TBtn onClick={() => exec('removeFormat')} title="Clear formatting">⌫ fmt</TBtn>
              <TBtn onClick={() => exec('undo')} title="Undo (⌘Z)">↶</TBtn>
              <TBtn onClick={() => exec('redo')} title="Redo (⌘⇧Z)">↷</TBtn>
              <Sep />
              <TBtn onClick={toggleHtmlView} title="Toggle HTML source view"
                style={{ background: showHtml ? C.teal : undefined, color: showHtml ? '#fff' : undefined }}>
                ⟨/⟩ HTML
              </TBtn>
            </div>

            {/* Editor / source view */}
            {showHtml ? (
              <textarea
                id="html-source"
                defaultValue={editorRef.current?.innerHTML || a.body_html || ''}
                onChange={() => setDirty(true)}
                style={{
                  width: '100%', minHeight: 520, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontSize: 13, lineHeight: 1.55, padding: 16, borderRadius: 12,
                  border: `1px solid ${C.border}`, background: C.card, color: C.text,
                  boxSizing: 'border-box' as const, outline: 'none', resize: 'vertical' as const,
                }}
              />
            ) : (
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setDirty(true)}
                onClick={e => {
                  // Inside contentEditable, click-on-anchor still tries to follow
                  // in some browsers (esp. on a fresh click before the editor has
                  // focus). Always cancel — Craig wants cursor placement, not
                  // navigation. The ↗ button in the header opens the live page.
                  const t = e.target as HTMLElement
                  if (t.closest('a')) e.preventDefault()
                }}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openLinkDialog() }
                  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save() }
                }}
                onPaste={e => {
                  // Default browser paste keeps Word/Docs cruft (mso-* styles, smart
                  // quotes, font-family overrides) AND raw <script>/<style> blocks
                  // that show as visible text. We prefer to keep useful structure
                  // (headings, lists, links) by sanitising the HTML, falling back
                  // to plain text only when there's no HTML available. Shift-paste
                  // bypasses everything (raw browser default).
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
                }}
                style={{
                  minHeight: 520, padding: '20px 26px', borderRadius: 12,
                  border: `1px solid ${C.border}`, background: C.card, color: C.text,
                  fontSize: 16, lineHeight: 1.7, outline: 'none',
                }}
              />
            )}

            <style jsx global>{`
              .ed-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; }
              @media (max-width: 920px) { .ed-grid { grid-template-columns: 1fr; } }
              [contenteditable]:empty::before { content: 'Start writing…'; color: #9ca3af; }
              [contenteditable] h1, [contenteditable] h2 { font-family: Georgia, serif; font-weight: 800; color: #111827; margin: 1.4em 0 0.5em; line-height: 1.25; }
              [contenteditable] h1 { font-size: 26px; }
              [contenteditable] h2 { font-size: 22px; }
              [contenteditable] h3 { font-size: 18px; font-weight: 700; margin: 1.2em 0 0.4em; color: #111827; }
              [contenteditable] h4 { font-size: 16px; font-weight: 700; margin: 1em 0 0.3em; color: #111827; }
              [contenteditable] p { margin: 0 0 1em; }
              [contenteditable] ul, [contenteditable] ol { margin: 0 0 1em 1.4em; padding: 0; }
              [contenteditable] li { margin: 0.2em 0; }
              [contenteditable] a { color: var(--brand); text-decoration: underline; }
              [contenteditable] blockquote { border-left: 4px solid var(--brand); padding: 8px 14px; color: #374151; background: var(--brand-light); margin: 0 0 1em; font-style: italic; }
              [contenteditable] img { max-width: 100%; height: auto; border-radius: 8px; margin: 0.6em 0; }
              [contenteditable] pre { background: #f3f4f6; padding: 10px 12px; border-radius: 8px; overflow-x: auto; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 13px; }
              [contenteditable] code { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.92em; }
              [contenteditable] table { border-collapse: collapse; width: 100%; margin: 0 0 1em; }
              [contenteditable] td, [contenteditable] th { border: 1px solid #e5e7eb; padding: 6px 10px; }
            `}</style>
          </div>

          {/* Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            <Section title="Publish">
              <Row label="Status">
                <select value={a.status} onChange={e => setField('status', e.target.value)} style={inp}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </Row>
              <Row label="Published at">
                <input type="datetime-local" value={a.published_at ? a.published_at.slice(0, 16) : ''}
                  onChange={e => setField('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
                  style={inp} />
              </Row>
              <Row label="Noindex">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text }}>
                  <input type="checkbox" checked={!!a.noindex} onChange={e => setField('noindex', e.target.checked)} />
                  Hide from search engines
                </label>
              </Row>
            </Section>

            <Section title="Cover image">
              {a.cover_image ? (
                <div style={{ position: 'relative' as const }}>
                  <img src={a.cover_image} alt="" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
                  <button onClick={() => setField('cover_image', null)} style={{ position: 'absolute' as const, top: 6, right: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Remove</button>
                </div>
              ) : null}
              <label style={{ display: 'block', marginTop: 8, padding: '10px 12px', border: `1px dashed ${C.border}`, borderRadius: 8, textAlign: 'center' as const, cursor: 'pointer', color: C.sub, fontSize: 13 }}>
                📷 {a.cover_image ? 'Replace cover' : 'Upload cover'}
                <input type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = '' }} />
              </label>
              <input value={a.cover_image || ''} onChange={e => setField('cover_image', e.target.value || null)}
                placeholder="…or paste image URL" style={{ ...inp, marginTop: 8, fontSize: 11 }} />
            </Section>

            <Section title="URL">
              <Row label="Slug"><input value={a.slug} onChange={e => setField('slug', e.target.value)} style={inp} /></Row>
              <Row label="Legacy path">
                <input value={a.legacy_path || ''} onChange={e => setField('legacy_path', e.target.value || null)}
                  placeholder="/the-best-things-to-do-in-…" style={inp} />
              </Row>
            </Section>

            <Section title="Excerpt">
              <textarea value={a.excerpt || ''} onChange={e => setField('excerpt', e.target.value || null)} rows={3}
                placeholder="Shown in lists and meta description fallback" style={{ ...inp, resize: 'vertical' as const }} />
            </Section>

            <Section title="Categories & tags">
              <Row label="Categories">
                <input value={(a.categories || []).join(', ')} onChange={e => setField('categories', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={inp} />
              </Row>
              <Row label="Tags">
                <input value={(a.tags || []).join(', ')} onChange={e => setField('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={inp} />
              </Row>
              <Row label="Destination slug">
                <input value={a.destination_slug || ''} onChange={e => setField('destination_slug', e.target.value || null)} style={inp} />
              </Row>
            </Section>

            <Section title="SEO">
              <Row label="SEO title">
                <input value={a.seo_title || ''} onChange={e => setField('seo_title', e.target.value || null)} maxLength={70} style={inp} />
                <div style={{ fontSize: 10, color: C.sub, textAlign: 'right' as const }}>{(a.seo_title || '').length}/70</div>
              </Row>
              <Row label="SEO description">
                <textarea value={a.seo_description || ''} onChange={e => setField('seo_description', e.target.value || null)}
                  rows={3} maxLength={160} style={{ ...inp, resize: 'vertical' as const }} />
                <div style={{ fontSize: 10, color: C.sub, textAlign: 'right' as const }}>{(a.seo_description || '').length}/160</div>
              </Row>
            </Section>

            <Section title="Author">
              <select
                value={a.author_slug || ''}
                onChange={e => {
                  const slug = e.target.value || null
                  const picked = authors.find(au => au.slug === slug)
                  // Keep `author` text in sync so legacy renderers and byline JSON-LD
                  // still work; an empty selection clears both.
                  setA({ ...a, author_slug: slug, author: picked ? picked.name : null })
                  setDirty(true)
                }}
                style={inp}
              >
                <option value="">— No author —</option>
                {authors.map(au => (
                  <option key={au.slug} value={au.slug}>{au.name}{au.role ? ` · ${au.role}` : ''}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>
                {a.author_slug
                  ? <>Visible on this article's byline. <a href={`/author/${a.author_slug}/`} target="_blank" rel="noopener" style={{ color: C.teal }}>View profile ↗</a></>
                  : <>Add or edit authors in <a href="/admin/authors/" style={{ color: C.teal }}>Authors admin</a>.</>}
              </div>
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

// --- helpers ---

function TBtn({ children, style, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault() /* preserve selection */}
      {...rest}
      style={{
        minWidth: 32, height: 30, padding: '0 8px', fontSize: 13, color: C.text,
        background: '#fff', border: `1px solid ${C.border}`, borderRadius: 6,
        cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        ...(style || {}),
      }}
    >
      {children}
    </button>
  )
}
function Sep() { return <span style={{ width: 1, height: 22, background: '#e5e7eb', margin: '0 4px' }} /> }
const tbSelect: React.CSSProperties = { height: 30, fontSize: 13, padding: '0 8px', border: `1px solid ${C.border}`, borderRadius: 6, background: '#fff', color: C.text, fontWeight: 600, cursor: 'pointer' }

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
