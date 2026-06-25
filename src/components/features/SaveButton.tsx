'use client'
import { useEffect, useState } from 'react'

type SaveItem = {
  type: 'tour' | 'park' | 'destination' | 'article'
  slug: string
  name: string
  href: string
  image: string | null
  state_code: string
  region?: string | null
  saved_at: number
}

const KEY = 'autravel:saved'

function read(): SaveItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as SaveItem[] } catch { return [] }
}
function write(items: SaveItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, 200))) } catch {}
  try { window.dispatchEvent(new CustomEvent('autravel:saved-change')) } catch {}
}

export function SaveButton(props: Omit<SaveItem, 'saved_at'>) {
  const [saved, setSaved] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const items = read()
    setSaved(items.some(i => i.type === props.type && i.slug === props.slug))
  }, [props.type, props.slug])
  function toggle() {
    const items = read()
    const idx = items.findIndex(i => i.type === props.type && i.slug === props.slug)
    if (idx >= 0) { items.splice(idx, 1); setSaved(false) }
    else { items.unshift({ ...props, saved_at: Date.now() }); setSaved(true) }
    write(items)
  }
  if (!mounted) return null
  return (
    <button
      onClick={toggle}
      title={saved ? 'Remove from saved' : 'Save for later'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px',
        background: saved ? 'var(--brand)' : '#fff',
        color: saved ? '#fff' : 'var(--brand)',
        border: '1px solid var(--brand)',
        borderRadius: 999,
        fontSize: 13, fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}>
      <span aria-hidden>{saved ? '★' : '☆'}</span>
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}

export function SavedCount() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const update = () => setN(read().length)
    update()
    window.addEventListener('autravel:saved-change', update)
    window.addEventListener('storage', (e) => { if (e.key === KEY) update() })
    return () => window.removeEventListener('autravel:saved-change', update)
  }, [])
  if (n === 0) return null
  return <span style={{ display: 'inline-block', minWidth: 18, padding: '2px 6px', background: 'var(--brand)', color: '#fff', borderRadius: 999, fontSize: 11, fontWeight: 700, marginLeft: 4 }}>{n}</span>
}

export function SavedListClient() {
  const [items, setItems] = useState<SaveItem[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const update = () => setItems(read())
    update()
    window.addEventListener('autravel:saved-change', update)
    return () => window.removeEventListener('autravel:saved-change', update)
  }, [])
  function remove(item: SaveItem) {
    const next = read().filter(i => !(i.type === item.type && i.slug === item.slug))
    write(next); setItems(next)
  }
  function clearAll() {
    if (!confirm('Clear all saved items?')) return
    write([]); setItems([])
  }
  if (!mounted) return <div style={{ padding: 24, textAlign: 'center' as const, color: '#6b7280' }}>Loading…</div>
  if (items.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center' as const, color: '#6b7280', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14 }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>☆</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Nothing saved yet</div>
      <div style={{ fontSize: 14 }}>Tap the ☆ Save button on any tour, park, destination or article to keep a list as you plan.</div>
    </div>
  )
  const groups: Record<string, SaveItem[]> = {}
  for (const i of items) (groups[i.type] ||= []).push(i)
  const order: Array<SaveItem['type']> = ['destination', 'tour', 'park', 'article']
  const labels: Record<SaveItem['type'], string> = {
    destination: 'Destinations', tour: 'Tours', park: 'Caravan parks', article: 'Articles',
  }
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: '#6b7280' }}>{items.length} saved item{items.length === 1 ? '' : 's'}</div>
        <button onClick={clearAll} style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Clear all</button>
      </div>
      {order.filter(t => groups[t]?.length).map(t => (
        <section key={t} style={{ marginBottom: 26 }}>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 800, margin: '0 0 12px', color: '#111827' }}>{labels[t]}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 14 }}>
            {groups[t].map(i => (
              <article key={i.type + i.slug} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' as const, position: 'relative' as const }}>
                <a href={i.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div style={{ aspectRatio: '4/3', background: '#f1f5f9' }}>
                    {i.image ? <img src={i.image} alt={i.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' as const }}/>
                             : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 32 }}>📍</div>}
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{i.name}</div>
                    {i.region && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{i.region}</div>}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{new Date(i.saved_at).toLocaleDateString('en-AU')}</div>
                  </div>
                </a>
                <button onClick={() => remove(i)} aria-label="Remove" style={{ position: 'absolute' as const, top: 6, right: 6, width: 26, height: 26, padding: 0, background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: '50%', cursor: 'pointer', fontSize: 13, lineHeight: 1, color: '#6b7280' }}>×</button>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
