'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Row = {
  message: string
  source: 'client' | 'server'
  count: number
  ip_count: number
  last_seen: string
  first_seen: string
  last_url: string | null
  last_route: string | null
  last_ua: string | null
  last_stack: string | null
  last_status: number | null
  all_seen: boolean
}

const C = { card: '#fff', border: '#e5e7eb', text: '#111', sub: '#6b7280', teal: '#0d9488', red: '#dc2626', amber: '#f59e0b', purple: '#7c3aed' }

export default function ClientErrorsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState({ client_total: 0, client_unseen: 0, server_total: 0, server_unseen: 0, total: 0, unseen: 0 })
  const [source, setSource] = useState<'client' | 'server' | 'all'>('all')
  const [seen, setSeen] = useState<'unseen' | 'all'>('unseen')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    const qs = new URLSearchParams({ seen })
    if (source !== 'all') qs.set('source', source)
    fetch(`/api/admin/client-errors?${qs}`)
      .then(r => r.ok ? r.json() : { rows: [], client_total: 0, client_unseen: 0, server_total: 0, server_unseen: 0, total: 0, unseen: 0 })
      .then(d => { setRows(d.rows || []); setCounts(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [source, seen])

  const markSeen = async (message: string, src: string) => {
    await fetch('/api/admin/client-errors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, source: src }) })
    load()
  }
  const markAllSeen = async () => {
    if (!confirm(`Mark all ${counts.unseen} unseen errors as seen?`)) return
    await fetch('/api/admin/client-errors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) })
    load()
  }

  const sourceTabs: Array<{ id: 'all' | 'client' | 'server'; label: string; unseen: number; total: number }> = [
    { id: 'all',    label: 'All',     unseen: counts.unseen,        total: counts.total },
    { id: 'client', label: 'Client',  unseen: counts.client_unseen, total: counts.client_total },
    { id: 'server', label: 'Server',  unseen: counts.server_unseen, total: counts.server_total },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' as const }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0, flex: 1 }}>Errors</h1>
        <Link href="/admin" style={{ fontSize: 13, color: C.sub, textDecoration: 'none' }}>← Dashboard</Link>
      </div>
      <p style={{ color: C.sub, fontSize: 13, margin: '0 0 16px' }}>
        Uncaught JS errors from real users' browsers <em>plus</em> server-side 500s from API routes + page renders. Grouped by message — the count is how many distinct hits.
      </p>

      {/* Source tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' as const }}>
        {sourceTabs.map(t => (
          <button key={t.id} onClick={() => setSource(t.id)}
            style={{ padding: '8px 16px', borderRadius: 999,
              border: `1px solid ${source === t.id ? C.teal : C.border}`,
              background: source === t.id ? '#f0fdfa' : '#fff',
              color: source === t.id ? C.teal : C.text,
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.label} <span style={{ color: t.unseen > 0 ? C.red : C.sub, fontWeight: t.unseen > 0 ? 700 : 500 }}>({t.unseen > 0 ? `${t.unseen} unseen · ` : ''}{t.total})</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
        <button onClick={() => setSeen('unseen')} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${seen === 'unseen' ? C.teal : C.border}`, background: seen === 'unseen' ? '#f0fdfa' : '#fff', color: seen === 'unseen' ? C.teal : C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Unseen only
        </button>
        <button onClick={() => setSeen('all')} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${seen === 'all' ? C.teal : C.border}`, background: seen === 'all' ? '#f0fdfa' : '#fff', color: seen === 'all' ? C.teal : C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Including seen
        </button>
        <div style={{ flex: 1 }} />
        {counts.unseen > 0 && (
          <button onClick={markAllSeen} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Mark all seen
          </button>
        )}
      </div>

      {loading && <div style={{ color: C.sub, fontSize: 14, padding: 20 }}>Loading…</div>}
      {!loading && rows.length === 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: 40, textAlign: 'center' as const, color: C.sub }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{seen === 'unseen' ? 'No unseen errors' : 'No errors in this view'}</div>
        </div>
      )}

      {rows.map(r => {
        const key = r.message + '|' + r.source
        return (
          <div key={key} style={{ background: C.card, border: `1px solid ${r.all_seen ? C.border : '#fecaca'}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' as const }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' as const }}>
                  <span style={{
                    background: r.source === 'server' ? '#ede9fe' : '#dbeafe',
                    color: r.source === 'server' ? C.purple : '#1e40af',
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    padding: '2px 8px', borderRadius: 999,
                    textTransform: 'uppercase' as const,
                  }}>
                    {r.source === 'server' ? '⚙ Server' : '🌐 Client'}
                  </span>
                  {r.last_status && r.source === 'server' && (
                    <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                      HTTP {r.last_status}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: 'SFMono-Regular,Menlo,monospace', fontSize: 13, color: C.text, fontWeight: 600, wordBreak: 'break-word' as const }}>
                  {r.message}
                </div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                  <span><strong style={{ color: r.count > 10 ? C.red : C.text }}>{r.count}</strong> hits</span>
                  {r.source === 'client' && <span><strong style={{ color: C.text }}>{r.ip_count}</strong> {r.ip_count === 1 ? 'browser' : 'browsers'}</span>}
                  <span>last {new Date(r.last_seen).toLocaleString()}</span>
                  {(r.last_route || r.last_url) && (
                    <span style={{ color: C.teal }}>on <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{r.last_route || (r.last_url ? new URL(r.last_url).pathname : '')}</code></span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setExpanded(expanded === key ? null : key)} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: C.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {expanded === key ? 'Hide' : 'Details'}
                </button>
                {!r.all_seen && (
                  <button onClick={() => markSeen(r.message, r.source)} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: C.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Mark seen
                  </button>
                )}
              </div>
            </div>
            {expanded === key && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                {r.last_stack && (
                  <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, fontSize: 11, overflow: 'auto' as const, maxHeight: 300, marginBottom: 10 }}>{r.last_stack}</pre>
                )}
                {r.last_url && <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}><strong>URL:</strong> {r.last_url}</div>}
                {r.last_ua && <div style={{ fontSize: 12, color: C.sub }}><strong>UA:</strong> <code style={{ fontSize: 11 }}>{r.last_ua}</code></div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
