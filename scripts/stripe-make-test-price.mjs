import fs from 'node:fs'
import 'dotenv/config'
import StripePkg from 'stripe'
const Stripe = StripePkg.default || StripePkg

const key = process.env.STRIPE_SECRET_KEY
if (!key || !key.startsWith('sk_')) {
  console.error('❌ STRIPE_SECRET_KEY missing or invalid. Put your TEST key (sk_test_...) in .env')
  process.exit(1)
}

const stripe = new Stripe(key)
const name = process.argv[2] || 'Hormone Test (dev)'
const amount = Number(process.argv[3] || 6900) // cents
const currency = process.argv[4] || 'eur'

const acct = await stripe.accounts.retrieve()
console.log('✔ Using Stripe account:', acct.id)

const product = await stripe.products.create({ name })
const price = await stripe.prices.create({ unit_amount: amount, currency, product: product.id })

console.log('✔ Created product:', product.id, 'price:', price.id)

const envPath = '.env'
try {
  const orig = fs.readFileSync(envPath, 'utf8')
  const lines = orig.split(/\r?\n/)
  const k = 'NEXT_PUBLIC_STRIPE_DEFAULT_PRICE_ID'
  const newLine = `${k}=${price.id}`
  const idx = lines.findIndex(l => l.startsWith(k+'='))
  if (idx >= 0) lines[idx] = newLine; else lines.push(newLine)
  fs.writeFileSync(envPath, lines.join('\n'))
  console.log(`✔ Wrote ${k}=${price.id} to .env`)
} catch (e) {
  console.log('ℹ Could not update .env automatically. Add this line manually:')
  console.log(`NEXT_PUBLIC_STRIPE_DEFAULT_PRICE_ID=${price.id}`)
}
