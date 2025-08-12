import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// Middleware for basic access control and lightweight rate limiting.
// NOTE: This uses an in-memory store which is NOT suitable for multi-instance production.
// TODO: Replace with a durable, centralized store (e.g., Redis) in production deployments.

type RateRecord = { count: number; reset: number }
const WINDOW_MS = 60 * 1000
const LIMIT = 60

// Persist across hot reloads in dev
const g = globalThis as unknown as { __rateLimitStore?: Map<string, RateRecord> }
const store: Map<string, RateRecord> = g.__rateLimitStore ?? new Map()
if (!g.__rateLimitStore) g.__rateLimitStore = store

function getClientIp(req: NextRequest): string {
  return (
    (req as any).ip ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function checkRateLimit(key: string) {
  const now = Date.now()
  const current = store.get(key)
  if (current && now < current.reset) {
    if (current.count >= LIMIT) {
      return { allowed: false, retryAfter: Math.ceil((current.reset - now) / 1000) }
    }
    current.count += 1
    store.set(key, current)
    return { allowed: true }
  }
  store.set(key, { count: 1, reset: now + WINDOW_MS })
  return { allowed: true }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Access control for admin dashboard and Sanity Studio
  if (pathname.startsWith('/admin') || pathname.startsWith('/studio')) {
    const expected = process.env.ADMIN_DASHBOARD_TOKEN
    const auth = req.headers.get('authorization') || ''
    const ok = expected && auth === `Bearer ${expected}`
    if (!ok) {
      return new NextResponse('Unauthorized', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer realm="admin", error="invalid_token"',
        },
      })
    }
  }

  // Lightweight IP-based rate limit for sensitive POST endpoints.
  // Excludes Stripe webhook path entirely via matcher configuration.
  const isSensitivePost =
    req.method === 'POST' &&
    (pathname === '/api/agent' || pathname === '/api/admin/provision')

  if (isSensitivePost) {
    const ip = getClientIp(req)
    const key = `${ip}:${pathname}`
    const result = checkRateLimit(key)
    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please slow down.' }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'Retry-After': String(result.retryAfter ?? 60),
          },
        }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  // Apply only to protected and sensitive endpoints. Stripe webhook is intentionally excluded.
  matcher: ['/admin/:path*', '/studio/:path*', '/api/agent', '/api/admin/provision'],
}
