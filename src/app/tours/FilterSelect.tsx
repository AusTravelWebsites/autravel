'use client'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Option = { value: string; label: string; count?: number }

export default function FilterSelect({
  param,
  label,
  options,
  current,
  anyLabel = 'Any',
  anyCount,
  minWidth = 150,
}: {
  param: string
  label: string
  options: Option[]
  current: string
  anyLabel?: string
  anyCount?: number
  minWidth?: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(sp?.toString() || '')
    if (e.target.value) next.set(param, e.target.value)
    else next.delete(param)
    next.delete('page')
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column' as const, gap: 4, minWidth }}>
      <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
        {label}
      </span>
      <select value={current} onChange={onChange}
        style={{
          padding: '9px 30px 9px 12px',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%236b7280' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E") no-repeat right 12px center`,
          color: '#111827',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          appearance: 'none' as const,
          WebkitAppearance: 'none' as const,
          MozAppearance: 'none' as const,
          width: '100%',
        }}>
        <option value="">{anyLabel}{typeof anyCount === 'number' ? ` (${anyCount.toLocaleString()})` : ''}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}{typeof o.count === 'number' ? ` (${o.count.toLocaleString()})` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
