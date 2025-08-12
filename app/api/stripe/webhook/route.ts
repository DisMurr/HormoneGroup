import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from 'next-sanity'
import { PrismaClient } from '@prisma/client'

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

let prisma: PrismaClient

declare global {
  var __prisma: PrismaClient | undefined
}

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient()
  }
  prisma = global.__prisma
}

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
        const session = event.data.object as Stripe.Checkout.Session
        
        try {
          // Get full session details with line items
          const sessionWithItems = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items', 'line_items.data.price.product']
          })
          
          const lineItems = sessionWithItems.line_items?.data || []
          const items = lineItems.map(item => ({
            name: typeof item.price?.product === 'object' && 'name' in item.price.product 
              ? item.price.product.name || 'Unknown Product' 
              : 'Unknown Product',
            price: item.price ? item.price.unit_amount! / 100 : 0, // Convert cents to euros
            quantity: item.quantity || 1,
            priceId: item.price?.id
          }))

          // Save order to database
          const order = await prisma.order.create({
            data: {
              email: session.customer_details?.email || session.customer_email || 'unknown@example.com',
              stripeSessionId: session.id,
              items: items,
              mode: session.mode || 'payment'
            }
          })

          console.log('✅ Order saved to database:', order.id, 'for session:', session.id)
          
        } catch (err) {
          console.error('❌ Failed to save order to database:', err)
        }
        
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



