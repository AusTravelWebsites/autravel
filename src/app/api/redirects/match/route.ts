import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'

// Match order: exact > prefix (longest) > regex (first match)
// Tenant scoped — rows are filtered by state_code from the query (set by the
// tenant-aware middleware). A row with state_code IS NULL applies globally.
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path')
  const state = req.nextUrl.searchParams.get('state')
  if (!path) return NextResponse.json({})

  try {
    // 1. Exact — tenant-specific row wins over a global fallback
    const [exact] = await db`
      SELECT id::text, to_path, redirect_type, match_type FROM redirects
      WHERE match_type = 'exact'
        AND from_path = ${path}
        AND is_active = true
        AND (state_code = ${state} OR state_code IS NULL)
      ORDER BY state_code NULLS LAST LIMIT 1`
    if (exact) return NextResponse.json({ id: exact.id, to_path: exact.to_path, redirect_type: exact.redirect_type })

    // 2. Prefix — longest match wins, tenant-specific wins over global
    const prefix = await db`
      SELECT id::text, from_path, to_path, redirect_type FROM redirects
      WHERE match_type = 'prefix'
        AND is_active = true
        AND ${path} LIKE from_path || '%'
        AND (state_code = ${state} OR state_code IS NULL)
      ORDER BY state_code NULLS LAST, LENGTH(from_path) DESC LIMIT 1`
    if (prefix[0]) {
      const p = prefix[0] as any
      const rest = path.slice(p.from_path.length)
      const target = (p.to_path as string).endsWith('/') && rest.startsWith('/')
        ? (p.to_path as string) + rest.slice(1)
        : (p.to_path as string) + rest
      return NextResponse.json({ id: p.id, to_path: target, redirect_type: p.redirect_type })
    }

    // 3. Regex — first match wins
    const regexes = await db`
      SELECT id::text, from_path, to_path, redirect_type FROM redirects
      WHERE match_type = 'regex'
        AND is_active = true
        AND (state_code = ${state} OR state_code IS NULL)
      ORDER BY state_code NULLS LAST, created_at ASC LIMIT 200`
    for (const r of regexes as any[]) {
      try {
        const re = new RegExp(r.from_path)
        const m = path.match(re)
        if (m) {
          const target = (r.to_path as string).replace(/\$(\d+)/g, (_, n) => m[+n] ?? '')
          return NextResponse.json({ id: r.id, to_path: target, redirect_type: r.redirect_type })
        }
      } catch { /* bad regex — skip */ }
    }

    return NextResponse.json({})
  } catch {
    return NextResponse.json({})
  }
}
