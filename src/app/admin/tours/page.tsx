'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type Tour = {
  id: string; slug: string; title: string;
  country?: string; city?: string;
  source: string; source_product_code: string;
  duration_label?: string; price_from?: string; currency?: string;
  rating?: string; review_count?: number; cover_image?: string;
  active: boolean; featured: boolean;
  ai_rewritten_at?: string; created_at: string;
}
type CountryRow  = { country: string; c: number; active_c: number; featured_c: number }
type SourceRow   = { source: string; c: number }
type AiSummary   = { ai_missing: number; ai_done: number; ai_total: number }
type SyncLog     = { id: string; source: string; action: string; ok: boolean; count_ok: number; count_fail: number; details?: any; started_at: string; finished_at?: string }

const C = { card:'#fff', border:'#e5e7eb', text:'#111', sub:'#6b7280', teal:'var(--brand)', tealLight:'var(--brand-light)', red:'#ef4444', amber:'#f59e0b' }

export default function AdminToursPage() {
  const sp = useSearchParams()
  const [tours, setTours] = useState<Tour[]>([])
  const [countries, setCountries] = useState<CountryRow[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null)
  const [syncLog, setSyncLog] = useState<SyncLog[]>([])
  const [search, setSearch] = useState(() => sp?.get('search') || '')
  const [country, setCountry] = useState(() => sp?.get('country') || '')
  const [source, setSource] = useState(() => sp?.get('source') || '')
  const [status, setStatus] = useState(() => sp?.get('status') || '')
  const [state, setState] = useState(() => sp?.get('state') || '')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const limit = 25
  const load = (p = 1) => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(p), limit: String(limit) })
    if (search)  qs.set('search',  search)
    if (country) qs.set('country', country)
    if (source)  qs.set('source',  source)
    if (status)  qs.set('status',  status)
    if (state)   qs.set('state',   state)
    fetch('/api/admin/tours?' + qs.toString())
      .then(r => r.ok ? r.json() : { tours: [], total: 0, countries: [], sources: [], aiSummary: null, syncLog: [] })
      .then(d => {
        setTours(d.tours || [])
        setTotal(d.total || 0)
        setCountries(d.countries || [])
        setSources(d.sources || [])
        setAiSummary(d.aiSummary || null)
        setSyncLog(d.syncLog || [])
        setPage(p)
        setLoading(false)
      }).catch(() => setLoading(false))
  }

  useEffect(() => { const t = setTimeout(() => load(1), 250); return () => clearTimeout(t) }, [search, country, source, status, state])
  useEffect(() => { load(1) }, [])

  const patch = async (id: string, patch: Partial<Pick<Tour, 'active' | 'featured'>>) => {
    setTours(prev => prev.map(t => t.id === id ? { ...t, ...patch } as Tour : t))
    await fetch('/api/admin/tours', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
  }
  const del = async (id: string) => {
    if (!confirm('Delete this tour? This cannot be undone.')) return
    const r = await fetch(`/api/admin/tours?id=${id}`, { method: 'DELETE' })
    if (r.ok) load(page)
  }

  const maxPage = Math.max(1, Math.ceil(total / limit))

  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>Tours</h1>
        <Link href="/admin" style={{ fontSize: 13, color: C.sub, textDecoration: 'none' }}>← Dashboard</Link>
      </div>
      {state && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.tealLight, border: `1px solid ${C.teal}`, color: C.teal, fontSize: 13, padding: '6px 10px', borderRadius: 8, marginBottom: 10, width: 'fit-content' }}>
          Filtered to tenant: <strong>{state.toUpperCase()}</strong>
          <button onClick={() => setState('')} style={{ background: 'transparent', border: 'none', color: C.teal, cursor: 'pointer', fontSize: 13, padding: 0, textDecoration: 'underline' }}>clear</button>
        </div>
      )}
      <p style={{ color: C.sub, fontSize: 13, margin: '0 0 16px' }}>
        {total.toLocaleString()} tours match the current filters. Imported via{' '}
        <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>scripts/import-tours.mjs</code>.
      </p>

      {aiSummary && aiSummary.ai_total > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>AI rewrites</div>
          <div style={{ fontSize: 14, color: C.text }}>
            <strong style={{ color: C.teal }}>{aiSummary.ai_done.toLocaleString()}</strong> done ·{' '}
            <strong style={{ color: aiSummary.ai_missing > 0 ? C.amber : C.sub }}>{aiSummary.ai_missing.toLocaleString()}</strong> missing ·{' '}
            <span style={{ color: C.sub }}>{aiSummary.ai_total.toLocaleString()} total</span>
          </div>
          <div style={{ flex: 1 }} />
          {aiSummary.ai_missing > 0 && (
            <button onClick={() => setStatus('ai-missing')}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${C.amber}`, background: status === 'ai-missing' ? '#fef3c7' : '#fff', color: C.amber, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Filter missing →
            </button>
          )}
        </div>
      )}

      {countries.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 10 }}>By country</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {countries.map(r => (
              <button key={r.country} onClick={() => setCountry(country === r.country ? '' : r.country)}
                style={{ padding: '6px 12px', borderRadius: 99, border: `1px solid ${country === r.country ? C.teal : C.border}`, background: country === r.country ? C.tealLight : '#fff', color: country === r.country ? C.teal : C.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {r.country} <span style={{ color: C.sub, fontWeight: 500 }}>· {r.active_c}/{r.c}</span>
                {r.featured_c > 0 && <span style={{ color: C.amber, marginLeft: 4 }}>★{r.featured_c}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, city, country or product code…"
          style={{ flex: '1 1 280px', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
        <select value={source} onChange={e => setSource(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">All sources</option>
          {sources.map(s => <option key={s.source} value={s.source}>{s.source} ({s.c})</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: 'inherit', background: '#fff' }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="featured">Featured</option>
          <option value="ai-missing">AI rewrite missing</option>
          <option value="ai-done">AI rewrite done</option>
        </select>
        {(search || country || source || status) && (
          <button onClick={() => { setSearch(''); setCountry(''); setSource(''); setStatus('') }}
            style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', color: C.sub, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
        )}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' as const }}>
        {loading && tours.length === 0 ? <div style={{ padding: 24, color: C.sub, textAlign: 'center' as const }}>Loading…</div>
          : tours.length === 0 ? <div style={{ padding: 24, color: C.sub, textAlign: 'center' as const }}>No tours match.</div>
          : (
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={th}>Tour</th>
                  <th style={th}>Location</th>
                  <th style={th}>Source</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>Price</th>
                  <th style={{ ...th, textAlign: 'right' as const }}>Rating</th>
                  <th style={{ ...th, textAlign: 'center' as const }}>AI</th>
                  <th style={{ ...th, textAlign: 'center' as const }}>Active</th>
                  <th style={{ ...th, textAlign: 'center' as const }}>Featured</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {tours.map(t => (
                  <tr key={t.id}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {t.cover_image
                          ? <img loading="lazy" decoding="async" src={t.cover_image} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' as const, flexShrink: 0 }} />
                          : <span style={{ width: 44, height: 44, borderRadius: 6, background: C.tealLight, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎟️</span>}
                        <span style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                            <Link href={`/admin/tours/${t.id}/edit/`} style={{ color: C.teal, fontWeight: 600, textDecoration: 'none', lineHeight: 1.3 }}>{t.title}</Link>
                            <a href={`/tours/${t.slug}/`} target="_blank" rel="noopener" title="Open live page in new tab" style={{ color: C.sub, fontSize: 11, textDecoration: 'none' }}>↗</a>
                          </span>
                          <span style={{ fontSize: 11, color: C.sub, fontWeight: 500, fontFamily: 'monospace' }}>{t.source_product_code}</span>
                        </span>
                      </div>
                    </td>
                    <td style={td}>{t.city ? `${t.city}, ` : ''}{t.country || '—'}</td>
                    <td style={td}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, background: '#f3f4f6', fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: '0.03em' }}>{t.source}</span></td>
                    <td style={{ ...td, textAlign: 'right' as const, whiteSpace: 'nowrap' as const }}>{t.price_from ? `${t.currency || 'USD'} ${t.price_from}` : '—'}</td>
                    <td style={{ ...td, textAlign: 'right' as const }}>{t.rating ? `${Number(t.rating).toFixed(1)} (${t.review_count ?? 0})` : '—'}</td>
                    <td style={{ ...td, textAlign: 'center' as const }}>
                      {t.ai_rewritten_at
                        ? <span title={`Rewritten ${new Date(t.ai_rewritten_at).toLocaleString()}`} style={{ color: C.teal, fontSize: 14 }}>✓</span>
                        : <span title="No AI rewrite yet" style={{ color: C.amber, fontSize: 12, fontWeight: 700 }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: 'center' as const }}>
                      <Toggle on={t.active} onChange={v => patch(t.id, { active: v })} />
                    </td>
                    <td style={{ ...td, textAlign: 'center' as const }}>
                      <Toggle on={t.featured} onChange={v => patch(t.id, { featured: v })} color={C.amber} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' as const }}>
                      <button onClick={() => del(t.id)} style={{ background: 'transparent', color: C.red, border: 'none', padding: '4px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {syncLog.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 10px' }}>Recent import activity</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {syncLog.map(s => (
              <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: C.sub, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.ok ? C.teal : C.red, flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', color: C.text, minWidth: 70 }}>{s.source}/{s.action}</span>
                <span style={{ color: s.ok ? C.teal : C.red, fontWeight: 700, minWidth: 70 }}>
                  {s.count_ok}✓{s.count_fail > 0 ? ` / ${s.count_fail}✗` : ''}
                </span>
                <span style={{ flex: 1 }}>{s.details ? JSON.stringify(s.details).slice(0, 140) : ''}</span>
                <span style={{ fontFamily: 'monospace' }}>{new Date(s.started_at).toLocaleString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {maxPage > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' as const }}>
          <button disabled={page === 1} onClick={() => load(page - 1)}
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: page === 1 ? C.sub : C.text, fontSize: 13, fontWeight: 600, cursor: page === 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>← Prev</button>
          <span style={{ padding: '8px 14px', fontSize: 13, color: C.sub }}>Page {page} of {maxPage}</span>
          <button disabled={page >= maxPage} onClick={() => load(page + 1)}
            style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: page >= maxPage ? C.sub : C.text, fontSize: 13, fontWeight: 600, cursor: page >= maxPage ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>Next →</button>
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left' as const, padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em', borderBottom: '1px solid #e5e7eb' }
const td: React.CSSProperties = { padding: '10px 14px', borderTop: '1px solid #e5e7eb', verticalAlign: 'middle' as const }

function Toggle({ on, onChange, color = 'var(--brand)' }: { on: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on}
      style={{ width: 36, height: 20, borderRadius: 99, border: 'none', background: on ? color : '#d1d5db', position: 'relative' as const, cursor: 'pointer', padding: 0, transition: 'background .15s' }}>
      <span style={{ position: 'absolute' as const, top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
    </button>
  )
}
