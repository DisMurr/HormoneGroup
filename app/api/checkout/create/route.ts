import { NextResponse } from 'next/server'
import Stripe from 'stripe'

export async function POST(req: Request) {
  const { priceId, successPath = '/thanks', cancelPath = '/tests' } = await req.json()
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 400 })
  if (!priceId) return NextResponse.json({ error: 'Missing priceId' }, { status: 400 })

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const stripe = new Stripe(key)

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: `${site}${successPath}?cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}${cancelPath}`,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['IE','GB','DE','FR','ES','IT','NL'] },
      metadata: {}, // place for product slug/id later if you want
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('❌ Checkout create error:', err)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }
}













