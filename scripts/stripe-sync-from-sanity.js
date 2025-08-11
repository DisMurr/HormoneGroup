/* eslint-disable no-console */
const Stripe = require('stripe')
const { createClient } = require('@sanity/client')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  apiVersion: process.env.SANITY_API_VERSION || '2024-07-01',
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
})

async function main() {
  const missing = await sanity.fetch(
    `*[_type=="product" && (!defined(stripeProductId) || !defined(stripePriceIdOneTime))]{
      _id, title, "slug": slug.current, priceEUR, stripeProductId, stripePriceIdOneTime
    }`
  )

  if (!missing.length) {
    console.log('✅ Nothing to do; all products have Stripe IDs.')
    return
  }

  console.log(`Found ${missing.length} product(s) to provision…`)

  for (const p of missing) {
    try {
      let { stripeProductId, stripePriceIdOneTime } = p

      if (!stripeProductId) {
        const sp = await stripe.products.create({
          name: p.title,
          metadata: { sanityId: p._id, slug: p.slug || '' },
        })
        stripeProductId = sp.id
      }

      if (!stripePriceIdOneTime) {
        if (p.priceEUR == null) throw new Error('priceEUR missing')
        const unitAmount = Math.round(Number(p.priceEUR) * 100)
        const price = await stripe.prices.create({
          product: stripeProductId,
          currency: 'eur',
          unit_amount: unitAmount,
          nickname: `${p.title} one-time`,
          metadata: { sanityId: p._id, slug: p.slug || '' },
        })
        stripePriceIdOneTime = price.id
      }

      await sanity.patch(p._id)
        .set({ stripeProductId, stripePriceIdOneTime })
        .commit()

      console.log(`✅ ${p.title} → product=${stripeProductId} price=${stripePriceIdOneTime}`)
    } catch (e) {
      console.error(`❌ ${p.title}:`, e.message || e)
    }
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
