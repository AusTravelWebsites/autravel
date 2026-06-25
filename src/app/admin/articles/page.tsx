'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type A = {
  id: string; state_code: string; slug: string; legacy_path: string | null
  title: string; excerpt: string | null; cover_image: string | null
  destination_slug: string | null; post_type: string | null
  author: string | null; status: string; source: string | null
  published_at: string | null; noindex: boolean | null
}
type S = { state_code: string; c: number; published_c: number; draft_c: number }

const C = { card: '#fff', border: '#e5e7eb', text: '#111', sub: '#6b7280', teal: 'var(--brand)', red: '#ef4444', amber: '#f59e0b' }

export default function AdminArticlesPage() {
  const sp = useSearchParams()
  const [rows, setRows] = useState<A[]>([])
  const [count, setCount] = useState(0)
  const [byState, setByState] = useState<S[]>([])
  const [state, setState] = useState(() => sp?.get('state') || '')
  const [status, setStatus] = useState(() => sp?.get('status') || '')
  const [search, setSearch] = useState(() => sp?.get('search') || '')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (state) p.set('state', state)
    if (status) p.set('status', status)
    if (search) p.set('search', search)
    p.set('page', String(page))
    const r = await fetch(`/api/admin/articles?${p}`)
    const j = await r.json()
    setRows(j.articles || []); setCount(j.count || 0); setByState(j.byState || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [state, status, page])

  async function patch(id: string, body: any) {
    await fetch('/api/admin/articles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    load()
  }
  async function archive(id: string) {
    if (!confirm('Archive this article? It will stop serving on the site but NOT be deleted (you can restore).')) return
    await fetch('/api/admin/articles', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  async function editAffiliate(id: string) {
    // Fetch current value
    const cur = await fetch(`/api/admin/articles?id=${id}&fields=affiliate_links`).then(r => r.json()).catch(() => ({})) as any
    const existing = cur?.articles?.[0]?.affiliate_links || {}
    const fields: Array<{ key: string; label: string; hint: string }> = [
      { key: 'direct',       label: 'Operator direct URL',  hint: 'e.g. https://oreillys.com.au/book' },
      { key: 'captain_cook', label: 'Captain Cook URL',     hint: 'via Awin (SeaLink parent)' },
      { key: 'cruise_com',   label: 'Cruise.com URL',       hint: 'via CJ Affiliate' },
      { key: 'booking',      label: 'Booking.com URL',      hint: 'with ?aid=YOUR_AID appended' },
    ]
    const next: Record<string, string> = {}
    for (const f of fields) {
      const v = prompt(`${f.label}\n${f.hint}\n\n(leave blank to clear; cancel to abort)`, existing[f.key] || '')
      if (v === null) return  // cancel
      if (v.trim()) next[f.key] = v.trim()
    }
    await patch(id, { affiliate_links: Object.keys(next).length ? next : null })
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const, gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Articles</h1>
        <div style={{ fontSize: 12, color: C.sub }}>{count.toLocaleString()} total · archives stay in DB forever</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14, fontSize: 12 }}>
        <button onClick={() => { setState(''); setPage(1) }}
          style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${!state ? C.teal : C.border}`, background: !state ? C.teal : C.card, color: !state ? '#fff' : C.text, fontWeight: 600, cursor: 'pointer' }}>
          All
        </button>
        {byState.map(r => (
          <button key={r.state_code} onClick={() => { setState(r.state_code === state ? '' : r.state_code); setPage(1) }}
            style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${r.state_code === state ? C.teal : C.border}`, background: r.state_code === state ? C.teal : C.card, color: r.state_code === state ? '#fff' : C.text, fontWeight: 600, cursor: 'pointer' }}>
            {r.state_code.toUpperCase()} ({r.c.toLocaleString()})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }}
          placeholder="Search title / slug / legacy path" style={{ flex: '1 1 260px', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}/>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13 }}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button onClick={() => { setPage(1); load() }} style={{ padding: '8px 16px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Search</button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
          <thead><tr style={{ background: '#f9fafb', textAlign: 'left' as const }}>
            <th style={th}>Title</th><th style={th}>State</th><th style={th}>Legacy path</th>
            <th style={th}>Destination</th><th style={th}>Status</th><th style={th}>Source</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center' as const, color: C.sub }}>Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} style={{ padding: 16, textAlign: 'center' as const, color: C.sub }}>No articles.</td></tr>
              : rows.map(a => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <Link href={`/admin/articles/${a.id}/edit/`} style={{ color: C.teal, textDecoration: 'none', fontWeight: 600 }}>{a.title}</Link>
                      <a href={a.legacy_path || `/articles/${a.slug}/`} target="_blank" rel="noopener" title="Open live page in new tab" style={{ color: C.sub, fontSize: 11, textDecoration: 'none' }}>↗</a>
                    </div>
                    <div style={{ fontSize: 11, color: C.sub }}>{a.slug}{a.published_at ? ` · ${new Date(a.published_at).toLocaleDateString()}` : ''}</div>
                  </td>
                  <td style={td}>{a.state_code.toUpperCase()}</td>
                  <td style={td}><code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{a.legacy_path || '—'}</code></td>
                  <td style={td}>{a.destination_slug || '—'}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 700,
                      background: a.status === 'published' ? '#dcfce7' : a.status === 'draft' ? '#fef3c7' : '#f3f4f6',
                      color:      a.status === 'published' ? '#166534' : a.status === 'draft' ? '#92400e' : '#374151' }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={td}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f3f4f6' }}>{a.source || '—'}</span></td>
                  <td style={td}>
                    <button onClick={() => patch(a.id, { status: a.status === 'published' ? 'draft' : 'published' })} style={btn}>{a.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                    <button onClick={() => patch(a.id, { noindex: !a.noindex })} style={btn}>{a.noindex ? 'Index' : 'Noindex'}</button>
                    <button onClick={() => editAffiliate(a.id)} style={btn} title="Edit affiliate URLs (Booking.com, Cruise.com, Captain Cook, direct)">Affiliate</button>
                    {a.status !== 'archived' && <button onClick={() => archive(a.id)} style={{ ...btn, color: C.red }}>Archive</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
        {page > 1 && <button onClick={() => setPage(page - 1)} style={btn}>← Prev</button>}
        <span style={{ padding: '6px 10px', fontSize: 12, color: C.sub }}>Page {page}</span>
        <button onClick={() => setPage(page + 1)} style={btn}>Next →</button>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: '#374151' }
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'middle' as const }
const btn: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', marginRight: 4 }
