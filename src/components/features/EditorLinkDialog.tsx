'use client'
import { useEffect, useRef, useState } from 'react'

export type LinkSpec = { url: string; text: string; newTab: boolean }

interface Props {
  open: boolean
  // Initial state when opened (e.g. prefilled from an existing <a> at cursor)
  initial: LinkSpec
  // True when editing an existing link (shows Remove button)
  editing: boolean
  onSave: (spec: LinkSpec) => void
  onRemove?: () => void
  onCancel: () => void
}

// Small floating dialog for inserting / editing links inside the rich-text
// editors. Includes "Open in new tab" + lets the operator edit text + URL of
// an existing link instead of having to delete and re-create.
export function EditorLinkDialog({ open, initial, editing, onSave, onRemove, onCancel }: Props) {
  const [url, setUrl] = useState(initial.url)
  const [text, setText] = useState(initial.text)
  const [newTab, setNewTab] = useState(initial.newTab)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setUrl(initial.url)
    setText(initial.text)
    setNewTab(initial.newTab)
    // Focus the URL field once mounted, scrolled into view
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [open, initial.url, initial.text, initial.newTab])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault()
        if (url.trim()) onSave({ url: url.trim(), text: text.trim() || url.trim(), newTab })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, url, text, newTab, onSave, onCancel])

  if (!open) return null

  return (
    <div
      onMouseDown={e => { /* keep the parent's text selection alive */ e.stopPropagation() }}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '14vh 20px 20px',
      }}
    >
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 480, boxShadow: '0 18px 38px -12px rgba(15,23,42,0.4)' }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{editing ? 'Edit link' : 'Insert link'}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
          Use a full URL (<code>https://…</code>) for external sites, or a relative path (<code>/destinations/sydney/</code>) for pages on this site.
        </div>

        <Field label="URL">
          <input
            ref={inputRef}
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com  or  /relative-path/"
            spellCheck={false}
            style={inp}
          />
        </Field>
        <Field label="Link text">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="(uses URL if blank)"
            style={inp}
          />
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#111827', cursor: 'pointer', padding: '8px 0' }}>
          <input
            type="checkbox"
            checked={newTab}
            onChange={e => setNewTab(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <span>Open in a new tab <small style={{ color: '#6b7280' }}>(adds <code>target="_blank" rel="noopener noreferrer"</code>)</small></span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, gap: 10, flexWrap: 'wrap' }}>
          <div>
            {editing && onRemove && (
              <button onClick={onRemove} style={{ ...btn, color: '#dc2626', border: '1px solid #fecaca' }}>Remove link</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={btn}>Cancel</button>
            <button
              onClick={() => { if (url.trim()) onSave({ url: url.trim(), text: text.trim() || url.trim(), newTab }) }}
              disabled={!url.trim()}
              style={{ ...btn, background: 'var(--brand)', color: '#fff', borderColor: 'var(--brand)', opacity: url.trim() ? 1 : 0.5 }}
            >
              {editing ? 'Update link' : 'Insert link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
  fontSize: 14, color: '#111827', background: '#fff', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
}
const btn: React.CSSProperties = {
  background: '#fff', color: '#111827', border: '1px solid #e5e7eb', borderRadius: 8,
  padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

// --- Helper exports used by both editors to inspect / mutate links at the
//     current selection. Keeps the DOM-mutation logic out of the components.

export type AnchorInfo = { node: HTMLAnchorElement; url: string; text: string; newTab: boolean }

// Find the <a> ancestor of the current selection's focus node, if any.
export function findAnchorAtSelection(root: HTMLElement | null): AnchorInfo | null {
  if (!root) return null
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  let node: Node | null = sel.focusNode
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'A') {
      const a = node as HTMLAnchorElement
      return {
        node: a,
        url: a.getAttribute('href') || '',
        text: a.textContent || '',
        newTab: a.getAttribute('target') === '_blank',
      }
    }
    node = node.parentNode
  }
  return null
}

// Save / restore the Selection range so opening the dialog (which moves
// focus to the input) doesn't lose the cursor position inside the editor.
export function saveSelection(): Range | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  return sel.getRangeAt(0).cloneRange()
}
export function restoreSelection(r: Range | null) {
  if (!r) return
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  sel.addRange(r)
}

// Build the <a> HTML for an insert / replace.
export function linkHtml({ url, text, newTab }: LinkSpec): string {
  const safeUrl = url.replace(/"/g, '&quot;')
  const safeText = (text || url).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
  const attrs = newTab ? ` target="_blank" rel="noopener noreferrer"` : ''
  return `<a href="${safeUrl}"${attrs}>${safeText}</a>`
}

// Replace an existing <a> with new attrs + text, in-place.
export function updateAnchor(node: HTMLAnchorElement, spec: LinkSpec) {
  node.setAttribute('href', spec.url)
  if (spec.newTab) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  } else {
    node.removeAttribute('target')
    node.removeAttribute('rel')
  }
  if (spec.text && spec.text !== node.textContent) {
    node.textContent = spec.text
  }
}

// Unwrap an existing <a>, leaving its text content in place.
export function unwrapAnchor(node: HTMLAnchorElement) {
  const parent = node.parentNode
  if (!parent) return
  while (node.firstChild) parent.insertBefore(node.firstChild, node)
  parent.removeChild(node)
}
