// app/api/checkout/create/route.ts
import Stripe from 'stripe'
import {NextResponse} from 'next/server'

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({error: 'Missing STRIPE_SECRET_KEY'}, {status: 500})

  const stripe = new Stripe(stripeKey)
  const {priceId, successPath = '/thanks', cancelPath = '/tests'} = await req.json()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{price: priceId, quantity: 1}],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}${cancelPath}`,
      shipping_address_collection: {allowed_countries: ['IE', 'GB', 'FR', 'DE', 'ES', 'NL', 'BE']},
    })
    return NextResponse.json({url: session.url}, {status: 200})
  } catch (e:any) {
    console.error(e)
    return NextResponse.json({error: e.message || 'Stripe error'}, {status: 500})
  }
}
