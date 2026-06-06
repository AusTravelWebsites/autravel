'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Option = { slug: string; label: string; count: number }

export default function CategorySelect({ options, current, allCount }: { options: Option[]; current: string; allCount: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(sp?.toString() || '')
    if (e.target.value) next.set('category', e.target.value)
    else next.delete('category')
    next.delete('page')
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <select value={current} onChange={onChange}
      style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minWidth: 220 }}>
      <option value="">All ({allCount})</option>
      {options.map(o => (
        <option key={o.slug} value={o.slug}>
          {o.label} ({o.count})
        </option>
      ))}
    </select>
  )
}
