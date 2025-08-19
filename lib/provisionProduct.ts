import Stripe from 'stripe'
import { createClient, groq } from 'next-sanity'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID!,
  dataset: process.env.SANITY_DATASET!,
  apiVersion: process.env.SANITY_API_VERSION || '2024-07-01',
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
})

export interface ProvisionInput { slug?: string; id?: string }
export interface ProvisionResult {
  ok: true
  id: string
  slug: string | undefined
  stripeProductId: string
  stripePriceIdOneTime: string
}

export async function provisionProduct({ slug, id }: ProvisionInput): Promise<ProvisionResult> {
  if (!slug && !id) {
    throw Object.assign(new Error('Provide slug or id'), { status: 400 })
  }

  const query = groq`*[_type=="product" && (!defined($slug) || slug.current==$slug) && (!defined($id) || _id==$id)][0]{
    _id, title, "slug": slug.current, priceEUR, stripeProductId, stripePriceIdOneTime
  }`
  const prod = await sanity.fetch<any>(query, { slug, id })
  if (!prod) throw Object.assign(new Error('Product not found'), { status: 404 })
  if (prod.priceEUR == null) throw Object.assign(new Error('priceEUR missing on product in Sanity'), { status: 400 })

  let stripeProductId: string | undefined = prod.stripeProductId
  let stripePriceIdOneTime: string | undefined = prod.stripePriceIdOneTime

  if (!stripeProductId) {
    const sProduct = await stripe.products.create({
      name: prod.title,
      metadata: { sanityId: prod._id, slug: prod.slug || '' },
    })
    stripeProductId = sProduct.id
  }

  if (!stripePriceIdOneTime) {
    const unitAmount = Math.round(Number(prod.priceEUR) * 100)
    const sPrice = await stripe.prices.create({
      product: stripeProductId!,
      currency: 'eur',
      unit_amount: unitAmount,
      nickname: `${prod.title} one-time`,
      metadata: { sanityId: prod._id, slug: prod.slug || '' },
    })
    stripePriceIdOneTime = sPrice.id
  }

  await sanity.patch(prod._id).set({ stripeProductId, stripePriceIdOneTime }).commit()

  return { ok: true, id: prod._id, slug: prod.slug, stripeProductId: stripeProductId!, stripePriceIdOneTime: stripePriceIdOneTime! }
}
