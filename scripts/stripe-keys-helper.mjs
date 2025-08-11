import 'dotenv/config'
import Stripe from 'stripe'

const currentSecretKey = process.env.STRIPE_SECRET_KEY
const currentPublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUB_KEY

if (!currentSecretKey) {
  console.error('No STRIPE_SECRET_KEY found in environment')
  process.exit(1)
}

const stripe = new Stripe(currentSecretKey)
const isLiveMode = currentSecretKey.startsWith('sk_live')

console.log('\n=== Current Stripe Configuration ===')
console.log(`Mode: ${isLiveMode ? 'LIVE' : 'TEST'}`)
console.log(`Secret Key: ${currentSecretKey.slice(0, 20)}...`)
console.log(`Publishable Key: ${currentPublishableKey?.slice(0, 20)}...`)

try {
  const account = await stripe.accounts.retrieve()
  console.log(`Account ID: ${account.id}`)
  console.log(`Country: ${account.country}`)
  console.log(`Email: ${account.email}`)
  console.log(`Business Name: ${account.business_profile?.name || 'Not set'}`)
  
  console.log('\n=== Environment File Setup ===')
  
  if (isLiveMode) {
    console.log('✅ You have LIVE keys - perfect for .env.production')
    console.log('\n🚨 For .env.local (development), you need TEST keys:')
    console.log('1. Go to https://dashboard.stripe.com/test/apikeys')
    console.log('2. Copy your test keys (they start with sk_test_ and pk_test_)')
    console.log('3. I will update your .env.local with placeholders for test keys')
    
    // Update .env.local with test key placeholders
    console.log('\n=== Updating .env.local with test key placeholders ===')
  } else {
    console.log('✅ You have TEST keys - perfect for .env.local')
    console.log('\n📝 For .env.production (Vercel), you need LIVE keys:')
    console.log('1. Go to https://dashboard.stripe.com/apikeys')
    console.log('2. Copy your live keys (they start with sk_live_ and pk_live_)')
    console.log('3. I will update your .env.production with your current live keys from main .env')
  }
  
} catch (error) {
  console.error('Error fetching account info:', error.message)
}

console.log('\n=== Next Steps ===')
console.log('1. Get your missing keys from Stripe Dashboard')
console.log('2. Run: npm run agent:ask -- "update env files with stripe keys"')
console.log('3. Restart your dev server: npm run dev')
