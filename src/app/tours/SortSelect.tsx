'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Option = { slug: string; label: string }

export default function SortSelect({ options, current }: { options: Option[]; current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(sp?.toString() || '')
    if (e.target.value && e.target.value !== 'top') next.set('sort', e.target.value)
    else next.delete('sort')
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <select value={current} onChange={onChange}
      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#111827', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
      {options.map(o => <option key={o.slug} value={o.slug}>{o.label}</option>)}
    </select>
  )
}
