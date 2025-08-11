import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from 'next-sanity'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  // Leave apiVersion unspecified to use library default; safer with changing dates
})

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  apiVersion: process.env.SANITY_API_VERSION || '2024-07-01',
  token: process.env.SANITY_WRITE_TOKEN, // needed if we upsert back to Sanity
  useCdn: false,
})

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret || !sig) {
    console.warn('Stripe webhook misconfigured: missing secret or signature')
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const raw = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err: any) {
    console.error('❌ Invalid Stripe signature', err?.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'product.created':
      case 'product.updated': {
        const product = event.data.object as Stripe.Product
        const sanityId = product.metadata?.sanityId
        if (sanityId && process.env.SANITY_WRITE_TOKEN) {
          await sanity.patch(sanityId).set({ stripeProductId: product.id }).commit()
        }
        break
      }
      case 'price.created':
      case 'price.updated': {
        const price = event.data.object as Stripe.Price
        // We only update one-time price ID if this looks like a one-time EUR price
        if (price.type === 'one_time' && price.currency === 'eur') {
          // Try to find sanityId either on price or its product metadata
          let sanityId = (price.metadata && (price.metadata as any).sanityId) as string | undefined
          if (!sanityId && typeof price.product === 'string') {
            const sp = await stripe.products.retrieve(price.product)
            sanityId = sp?.metadata?.sanityId
          }
          if (sanityId && process.env.SANITY_WRITE_TOKEN) {
            await sanity.patch(sanityId).set({ stripePriceIdOneTime: price.id }).commit()
          }
        }
        break
      }
      case 'checkout.session.completed': {
        // TODO: record order/fulfillment; you can read:
        // const session = event.data.object as Stripe.Checkout.Session
        break
      }
      default:
        // ignore others for now
        break
    }
  } catch (err) {
    console.error('❌ Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}

export const config = {
  api: {
    bodyParser: false, // ensure raw body for Stripe signature
  },
}
