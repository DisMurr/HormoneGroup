import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from 'next-sanity'

type ProductDoc = {
  _id: string
  title: string
  slug: string
  priceEUR?: number
  stripeProductId?: string
  stripePriceIdOneTime?: string
}

const projectId = process.env.SANITY_PROJECT_ID!
const dataset = process.env.SANITY_DATASET!
const apiVersion = process.env.SANITY_API_VERSION || '2025-08-11'
const writeToken = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_READ_TOKEN // needs write scope for patch

const readClient = createClient({ projectId, dataset, apiVersion, useCdn: false })
const writeClient = createClient({ projectId, dataset, apiVersion, token: writeToken, useCdn: false })

export async function POST(req: NextRequest) {
  // Refuse to use live Stripe key in dev
  if (process.env.NODE_ENV !== 'production' && process.env.STRIPE_SECRET_KEY?.startsWith('sk_live')) {
    return NextResponse.json({ error: 'Refusing to use live Stripe key in dev.' }, { status: 400 })
  }
  const expected = process.env.PROVISION_SECRET ? `Bearer ${process.env.PROVISION_SECRET}` : ''
  const got = req.headers.get('authorization') ?? ''
  if (!process.env.PROVISION_SECRET || got !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as { slug?: string; id?: string } | null
  const slug = body?.slug
  const id = body?.id
  if (!slug && !id) {
    return NextResponse.json({ error: 'Provide slug or id' }, { status: 400 })
  }

  const baseFields = `
    _id,
    title,
    "slug": slug.current,
    priceEUR,
    stripeProductId,
    stripePriceIdOneTime
  `
  const query = id
    ? `*[_type=="product" && _id==$id][0]{${baseFields}}`
    : `*[_type=="product" && slug.current==$slug][0]{${baseFields}}`

  const product = await readClient.fetch<ProductDoc | null>(query, id ? { id } : { slug })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'STRIPE_SECRET_KEY missing' }, { status: 500 })
  // Use the library's default API version (types currently expect a specific pinned version)
  const stripe = new Stripe(stripeKey)


  let { stripeProductId, stripePriceIdOneTime } = product

  // Create Stripe product if missing
  if (!stripeProductId) {
    const created = await stripe.products.create({
      name: product.title,
      metadata: { sanityId: product._id, slug: product.slug },
    })
    stripeProductId = created.id
  }

  // Always compute amount for priceEUR
  const amount = typeof product.priceEUR === 'number' ? Math.round(product.priceEUR * 100) : null
  if (!amount) return NextResponse.json({ error: 'priceEUR missing on product' }, { status: 400 })

  // If price exists, check if amount changed; if so, create new price
  if (stripePriceIdOneTime) {
    try {
      const current = await stripe.prices.retrieve(stripePriceIdOneTime)
      if (typeof amount === 'number' && current.unit_amount !== amount) {
        const newPrice = await stripe.prices.create({
          currency: 'eur',
          unit_amount: amount,
          product: stripeProductId!,
        })
        stripePriceIdOneTime = newPrice.id
      }
    } catch {
      // If retrieval fails, create a fresh price
      if (typeof amount === 'number') {
        const newPrice = await stripe.prices.create({
          currency: 'eur',
          unit_amount: amount,
          product: stripeProductId!,
        })
        stripePriceIdOneTime = newPrice.id
      }
    }
  } else {
    // No price exists, create one
    const created = await stripe.prices.create({
      currency: 'eur',
      unit_amount: amount,
      product: stripeProductId!,
    })
    stripePriceIdOneTime = created.id
  }

  // Persist back to Sanity (if we have a token with write scope)
  if (!writeToken) {
    return NextResponse.json(
      { ok: true, stripeProductId, stripePriceIdOneTime, note: 'SANITY_WRITE_TOKEN missing, not persisted' },
      { status: 200 }
    )
  }

  await writeClient
    .patch(product._id)
    .set({ stripeProductId, stripePriceIdOneTime })
    .commit()

  return NextResponse.json({ ok: true, stripeProductId, stripePriceIdOneTime })
}

