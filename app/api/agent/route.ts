// app/api/agent/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

type ProvisionResult = {
  ok?: boolean
  slug?: string
  sanityId?: string
  stripeProductId?: string
  stripePriceIdOneTime?: string
  priceId?: string
  [k: string]: any
}

async function provisionProduct({
  slug,
  id,
}: {
  slug?: string
  id?: string
}): Promise<ProvisionResult> {
  if (!process.env.PROVISION_SECRET) {
    return { ok: false, error: 'PROVISION_SECRET is not set in env' }
  }
  const res = await fetch(`${BASE}/api/admin/provision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.PROVISION_SECRET}`,
    },
    body: JSON.stringify({ slug, id }),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as ProvisionResult
  if (!res.ok) {
    return { ok: false, error: json?.error || `Provision failed ${res.status}` }
  }
  return { ok: true, ...json }
}

async function createCheckout({
  priceId,
  successPath = '/thanks',
  cancelPath = '/tests',
}: {
  priceId: string
  successPath?: string
  cancelPath?: string
}): Promise<{ ok: boolean; url?: string; [k: string]: any }> {
  const res = await fetch(`${BASE}/api/checkout/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ priceId, successPath, cancelPath }),
    cache: 'no-store',
  })
  const json = await res.json().catch(async () => ({ error: await res.text().catch(() => '') }))
  if (!res.ok) {
    return { ok: false, error: json?.error || `Checkout failed ${res.status}` }
  }
  return { ok: true, ...json }
}

/** very small helper to pull slug/id from free text */
function extractTargets(input: string) {
  const id = input.match(/\b(?:_id|id)\s*[:=]\s*([a-z0-9][\w-]+)/i)?.[1]
  const fromProductPhrase = input.match(/product\s+([a-z0-9][a-z0-9-]*)/i)?.[1]
  const fromTestsPath = input.match(/tests\/([a-z0-9][a-z0-9-]*)/i)?.[1]
  const slug = fromProductPhrase || fromTestsPath
  return { slug, id }
}

export async function POST(req: NextRequest) {
  // auth
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!process.env.AGENT_ADMIN_TOKEN || token !== process.env.AGENT_ADMIN_TOKEN) {
    return unauthorized()
  }

  const body = await req.json().catch(() => ({} as any))
  const input = (body?.input ?? '').toString().trim()
  const explicitSlug = (body?.slug ?? '').toString().trim() || undefined
  const explicitId = (body?.id ?? '').toString().trim() || undefined

  if (!input && !explicitSlug && !explicitId) {
    return bad('Missing input. Pass { input: "..."} or { slug: "..." }')
  }

  const { slug: parsedSlug, id: parsedId } = extractTargets(input)
  const slug = explicitSlug || parsedSlug
  const id = explicitId || parsedId

  if (!slug && !id) {
    return bad('Could not find a product slug or id in your instruction.')
  }

  // Step 1: provision (creates Stripe product/price & patches Sanity if missing)
  const provision = await provisionProduct({ slug, id })
  if (!provision.ok) {
    return bad(provision.error || 'Provision failed', 500)
  }

  // find a usable price id from the provision payload
  const priceId =
    provision.stripePriceIdOneTime ||
    provision.priceId ||
    provision?.stripe?.price?.id

  if (!priceId) {
    return bad('Provision succeeded but no priceId was returned.', 500)
  }

  // Step 2: checkout
  const cancelPath = slug ? `/tests/${slug}` : '/tests'
  const checkout = await createCheckout({ priceId, cancelPath })

  if (!checkout.ok || !checkout.url) {
    return bad(checkout?.error || 'Checkout failed', 500)
  }

  return NextResponse.json({
    ok: true,
    slug: slug ?? null,
    id: id ?? null,
    priceId,
    checkoutUrl: checkout.url,
    details: {
      provision,
    },
  })
}
