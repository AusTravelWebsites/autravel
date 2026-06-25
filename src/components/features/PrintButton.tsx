'use client'
import { useEffect, useState } from 'react'

export function PrintButton({ label = 'Print this page' }: { label?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <button
      onClick={() => window.print()}
      data-print-hide
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', background: '#fff', color: 'var(--brand)',
        border: '1px solid var(--brand)', borderRadius: 999,
        fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>
      <span aria-hidden>🖨</span> {label}
    </button>
  )
}
