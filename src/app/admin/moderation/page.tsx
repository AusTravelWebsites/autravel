'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Kind = 'posts' | 'reviews' | 'comments' | 'images' | 'trips'
const C = { bg:'#f9fafb', card:'#fff', border:'#e5e7eb', text:'#111', sub:'#6b7280', teal:'#0d9488', red:'#ef4444' }

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d < 1) return 'today'
  if (d < 7) return d + 'd ago'
  if (d < 30) return Math.floor(d/7) + 'w ago'
  return Math.floor(d/30) + 'mo ago'
}

export default function ModerationPage() {
  const [kind, setKind] = useState<Kind>('posts')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = () => { setLoading(true); setSelected(new Set()); fetch(`/api/admin/moderation?kind=${kind}`).then(r => r.ok ? r.json() : {}).then(d => { setItems(d.items || []); setLoading(false) }).catch(() => setLoading(false)) }
  useEffect(() => { load() }, [kind])

  const del = async (params: Record<string, string>) => {
    if (!confirm('Delete this item? This cannot be undone.')) return
    const qs = new URLSearchParams(params).toString()
    const r = await fetch(`/api/admin/moderation?${qs}`, { method: 'DELETE' })
    if (r.ok) load()
    else alert('Delete failed.')
  }

  const toggleSel = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selAll = () => setSelected(s => s.size === items.length ? new Set() : new Set(items.map((i: any) => i.id)))

  const bulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} ${kind}? This cannot be undone.`)) return
    const singularKind = kind === 'posts' ? 'post' : kind === 'reviews' ? 'review' : kind === 'trips' ? 'trip' : kind === 'comments' ? 'comment' : null
    if (!singularKind) { alert('Bulk delete not supported for images.'); return }
    const r = await fetch(`/api/admin/moderation?kind=${singularKind}&ids=${[...selected].join(',')}`, { method: 'DELETE' })
    if (r.ok) load()
    else alert('Bulk delete failed.')
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Moderation</h1>
      <p style={{ color: C.sub, fontSize: 14, margin: '0 0 18px' }}>Review and remove posts, reviews, trips or specific images.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        {(['posts','reviews','comments','images','trips'] as const).map(k => (
          <button key={k} onClick={() => setKind(k)} style={{ padding: '8px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: kind===k?C.teal:C.card, color: kind===k?'#fff':C.sub, boxShadow: kind===k?'none':`0 0 0 1px ${C.border}`, textTransform: 'capitalize' as const }}>{k}</button>
        ))}
        {kind !== 'images' && items.length > 0 && (
          <>
            <button onClick={selAll} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: C.sub, border: `1px solid ${C.border}`, fontFamily: 'inherit' }}>{selected.size === items.length && items.length ? 'Deselect all' : 'Select all'}</button>
            {selected.size > 0 && (
              <>
                <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>{selected.size} selected</span>
                <button onClick={bulkDelete} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: C.red, color: '#fff', border: 'none', fontFamily: 'inherit' }}>Delete {selected.size}</button>
              </>
            )}
          </>
        )}
      </div>

      {loading ? <div style={{ color: C.sub, padding: 20 }}>Loading…</div> : items.length === 0 ? <div style={{ color: C.sub, padding: 20 }}>None found.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {kind === 'posts' && items.map((p: any) => (
            <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' as const }}>
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} style={{ marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>
                  <Link href={`/${p.username}`} style={{ color: C.teal, fontWeight: 700, textDecoration: 'none' }}>@{p.username}</Link> · {timeAgo(p.created_at)}{!p.is_public && <span style={{ marginLeft: 6, background: '#f3f4f6', padding: '1px 6px', borderRadius: 99, fontSize: 10 }}>private</span>}
                  {p.location_name && <> · 📍 {p.location_name}</>}
                </div>
                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{(p.body || '').slice(0, 320)}{(p.body||'').length > 320 ? '…' : ''}</div>
                {p.media_urls && p.media_urls.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' as const }}>
                    {p.media_urls.slice(0, 4).map((u: string) => <img loading="lazy" decoding="async" key={u} src={u} alt="" style={{ width: 70, height: 50, objectFit: 'cover' as const, borderRadius: 4 }} />)}
                  </div>
                )}
                <div style={{ fontSize: 11, color: C.sub, marginTop: 6 }}>♥ {p.like_count||0} · 💬 {p.comment_count||0}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, flexShrink: 0 }}>
                <Link href={`/journal-entries/${p.id}`} target="_blank" style={{ background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none', textAlign: 'center' as const }}>View</Link>
                <button onClick={() => del({ kind: 'post', id: p.id })} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}

          {kind === 'reviews' && items.map((r: any) => (
            <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' as const }}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} style={{ marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>
                  <Link href={`/${r.username}`} style={{ color: C.teal, fontWeight: 700, textDecoration: 'none' }}>@{r.username}</Link> · {timeAgo(r.created_at)} · {(r.overall_rating || r.rating || 0).toFixed(1)}★
                  {r.place_name && <> · {r.place_name}</>}
                </div>
                {r.title && <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{r.title}</div>}
                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{(r.body || '').slice(0, 320)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, flexShrink: 0 }}>
                {r.place_slug && <Link href={`/places/${r.place_slug}`} target="_blank" style={{ background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none', textAlign: 'center' as const }}>Place</Link>}
                <button onClick={() => del({ kind: 'review', id: r.id })} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}

          {kind === 'comments' && items.map((c: any) => (
            <div key={c.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' as const }}>
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSel(c.id)} style={{ marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>
                  <Link href={`/${c.username}`} style={{ color: C.teal, fontWeight: 700, textDecoration: 'none' }}>@{c.username}</Link> · {timeAgo(c.created_at)}
                  {c.entry_id && <> · on post</>}
                </div>
                <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{(c.body || '').slice(0, 320)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, flexShrink: 0 }}>
                {c.entry_id && <Link href={`/journal-entries/${c.entry_id}`} target="_blank" style={{ background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none', textAlign: 'center' as const }}>View</Link>}
                <button onClick={() => del({ kind: 'comment', id: c.id })} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}

          {kind === 'images' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
              {items.map((img: any, i: number) => (
                <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' as const }}>
                  <img loading="lazy" decoding="async" src={img.url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' as const, display: 'block' }} />
                  <div style={{ padding: 8 }}>
                    <div style={{ fontSize: 11, color: C.sub }}>@{img.username} · {timeAgo(img.created_at)}</div>
                    <button onClick={() => del({ kind: 'image', entry_id: img.entry_id, url: img.url })} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: 6, width: '100%' }}>Delete image</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {kind === 'trips' && items.map((t: any) => (
            <div key={t.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' as const }}>
              <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleSel(t.id)} style={{ marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>
                  <Link href={`/${t.username}`} style={{ color: C.teal, fontWeight: 700, textDecoration: 'none' }}>@{t.username}</Link> · {timeAgo(t.created_at)}{!t.is_public && <span style={{ marginLeft: 6, background: '#f3f4f6', padding: '1px 6px', borderRadius: 99, fontSize: 10 }}>private</span>}
                  {t.location_name && <> · 📍 {t.location_name}</>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{t.title}</div>
                {t.description && <div style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{(t.description as string).slice(0, 200)}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, flexShrink: 0 }}>
                <Link href={`/${t.username}/trips/${t.slug}`} target="_blank" style={{ background: '#fff', color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, textDecoration: 'none', textAlign: 'center' as const }}>View</Link>
                <button onClick={() => del({ kind: 'trip', id: t.id })} style={{ background: C.red, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
