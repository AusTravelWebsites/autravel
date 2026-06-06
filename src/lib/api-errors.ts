import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db'

/**
 * Return a 500 without leaking internal error details to the client.
 * Logs the full error server-side (with stack) for debugging AND writes a row
 * to client_errors (source='server') so /admin/client-errors shows server-side
 * failures alongside browser-side ones.
 */
export function serverError(err: unknown, context?: string, req?: NextRequest) {
  const msg = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  const tag = context ? `[${context}]` : '[server error]'
  console.error(tag, msg, stack || '')
  // Fire-and-forget DB insert — never block the response on error-logging failure.
  logServerError({ message: msg.slice(0, 800), stack: stack?.slice(0, 4000), context, req }).catch(() => {})
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

/**
 * Write a server-side error to the errors table. Call directly if you're
 * catching an error in a background job or cron where there's no response.
 */
export async function logServerError(opts: {
  message: string
  stack?: string
  context?: string
  req?: NextRequest
  statusCode?: number
}) {
  try {
    const route = opts.req ? new URL(opts.req.url).pathname : opts.context || null
    const ua = opts.req?.headers.get('user-agent')?.slice(0, 400) || null
    const ip = opts.req
      ? (opts.req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
         || opts.req.headers.get('cf-connecting-ip')?.trim()
         || opts.req.headers.get('x-real-ip')?.trim()
         || null)
      : null
    await db`
      INSERT INTO client_errors (message, stack, url, route, status_code, user_agent, ip, source)
      VALUES (${opts.message}, ${opts.stack ?? null}, ${route}, ${route}, ${opts.statusCode ?? 500}, ${ua}, ${ip}, 'server')`
  } catch (e) {
    // Last-resort: nowhere to log THIS failure except console
    console.error('[logServerError]', e instanceof Error ? e.message : String(e))
  }
}
