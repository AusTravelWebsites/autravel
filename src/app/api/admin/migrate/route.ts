import { NextResponse } from 'next/server'
import db from '@/lib/db'

export async function POST(req: Request) {
  const secret = req.headers.get('x-migrate-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await db`CREATE TABLE IF NOT EXISTS site_snippets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, location text NOT NULL CHECK (location IN ('head','body_start','body_end')), code text NOT NULL, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`
  await db`CREATE TABLE IF NOT EXISTS redirects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), from_path text NOT NULL UNIQUE, to_path text NOT NULL, redirect_type integer DEFAULT 301, hit_count integer DEFAULT 0, last_hit_at timestamptz, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`
  await db`CREATE TABLE IF NOT EXISTS admin_settings (key text PRIMARY KEY, value text, updated_at timestamptz DEFAULT now())`
  await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false`
  await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false`
  return NextResponse.json({ ok: true, message: 'Migration complete' })
}
