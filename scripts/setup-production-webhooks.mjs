// scripts/setup-production-webhooks.mjs
import 'dotenv/config'
import { StripeAgent } from './stripe-agent.mjs'

class ProductionWebhookSetup {
  constructor() {
    this.stripeAgent = new StripeAgent()
  }

  async setupStripeWebhook() {
    console.log('\n💳 Setting up Stripe webhook for production...')
    
    try {
      const webhookEndpoint = await this.stripeAgent.stripe.webhookEndpoints.create({
        url: 'https://hormonegroup.ie/api/stripe/webhook',
        enabled_events: [
          'checkout.session.completed',
          'payment_intent.succeeded',
          'product.created',
          'product.updated',
          'price.created',
          'price.updated'
        ],
        description: 'HormoneGroup.ie production webhook'
      })

      console.log('✅ Stripe webhook created successfully!')
      console.log(`Webhook ID: ${webhookEndpoint.id}`)
      console.log(`Webhook Secret: ${webhookEndpoint.secret}`)
      console.log('\n📋 IMPORTANT: Add this to your production .env:')
      console.log(`STRIPE_WEBHOOK_SECRET=${webhookEndpoint.secret}`)
      
      return {
        success: true,
        webhookId: webhookEndpoint.id,
        webhookSecret: webhookEndpoint.secret,
        url: webhookEndpoint.url
      }
    } catch (error) {
      console.error('❌ Failed to create Stripe webhook:', error.message)
      return { success: false, error: error.message }
    }
  }

  async listExistingWebhooks() {
    console.log('\n📋 Existing Stripe webhooks:')
    
    try {
      const webhooks = await this.stripeAgent.stripe.webhookEndpoints.list({ limit: 10 })
      
      if (webhooks.data.length === 0) {
        console.log('No existing webhooks found.')
        return []
      }

      webhooks.data.forEach((webhook, index) => {
        console.log(`\n${index + 1}. Webhook ID: ${webhook.id}`)
        console.log(`   URL: ${webhook.url}`)
        console.log(`   Status: ${webhook.status}`)
        console.log(`   Events: ${webhook.enabled_events.join(', ')}`)
        console.log(`   Created: ${new Date(webhook.created * 1000).toLocaleString()}`)
      })
      
      return webhooks.data
    } catch (error) {
      console.error('❌ Failed to list webhooks:', error.message)
      return []
    }
  }

  displaySanityWebhookInstructions() {
    console.log('\n📝 Sanity Webhook Setup Instructions:')
    console.log('1. Open: https://www.sanity.io/manage')
    console.log('2. Select project: fnv8ttx3 (HormoneGroup)')
    console.log('3. Navigate: API → Webhooks → Create webhook')
    console.log('')
    console.log('📋 Webhook Configuration:')
    console.log('   Name: HormoneGroup Auto-Provision')
    console.log('   URL: https://hormonegroup.ie/api/admin/provision')
    console.log('   HTTP Method: POST')
    console.log('   Dataset: production')
    console.log('')
    console.log('📋 Headers:')
    console.log(`   Authorization: Bearer ${process.env.PROVISION_SECRET}`)
    console.log('')
    console.log('📋 Filter (Include only):')
    console.log('   _type == "product" && defined(slug.current) && !(_id in path("drafts.**"))')
    console.log('')
    console.log('📋 Projection (Optional):')
    console.log('   { "slug": slug.current, "id": _id, "title": title }')
    console.log('')
    console.log('📋 Trigger on:')
    console.log('   ✅ Create')
    console.log('   ✅ Update')
    console.log('   ❌ Delete')
    console.log('')
    console.log('🎯 This webhook will automatically provision new Sanity products to Stripe!')
  }

  async verifyProductionEnvironment() {
    console.log('\n🔍 Verifying production environment...')
    
    const requiredEnvVars = {
      'NEXT_PUBLIC_SITE_URL': process.env.NEXT_PUBLIC_SITE_URL,
      'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
      'NEXT_PUBLIC_STRIPE_PUB_KEY': process.env.NEXT_PUBLIC_STRIPE_PUB_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      'SANITY_PROJECT_ID': process.env.SANITY_PROJECT_ID,
      'SANITY_WRITE_TOKEN': process.env.SANITY_WRITE_TOKEN,
      'DATABASE_URL': process.env.DATABASE_URL,
      'PROVISION_SECRET': process.env.PROVISION_SECRET,
      'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET
    }

    const missing = []
    const configured = []

    Object.entries(requiredEnvVars).forEach(([key, value]) => {
      if (!value) {
        missing.push(key)
      } else {
        configured.push(key)
      }
    })

    console.log(`✅ Configured: ${configured.length} variables`)
    configured.forEach(key => console.log(`   ✅ ${key}`))

    if (missing.length > 0) {
      console.log(`\n❌ Missing: ${missing.length} variables`)
      missing.forEach(key => console.log(`   ❌ ${key}`))
    }

    // Check if using live Stripe keys
    const isLive = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
    console.log(`\n💳 Stripe Mode: ${isLive ? '🔴 LIVE' : '🟡 TEST'}`)

    return {
      configured: configured.length,
      missing: missing.length,
      isProductionReady: missing.length === 0,
      isLiveStripe: isLive
    }
  }
}

async function main() {
  const command = process.argv[2] || 'help'
  const setup = new ProductionWebhookSetup()

  switch (command) {
    case 'verify':
      const verification = await setup.verifyProductionEnvironment()
      console.log('\n=== ENVIRONMENT VERIFICATION ===')
      console.log(JSON.stringify(verification, null, 2))
      break

    case 'list-webhooks':
      await setup.listExistingWebhooks()
      break

    case 'create-stripe-webhook':
      const result = await setup.setupStripeWebhook()
      console.log('\n=== STRIPE WEBHOOK RESULT ===')
      console.log(JSON.stringify(result, null, 2))
      break

    case 'sanity-instructions':
      setup.displaySanityWebhookInstructions()
      break

    case 'full-setup':
      console.log('🚀 === PRODUCTION WEBHOOK SETUP ===')
      
      // 1. Verify environment
      const env = await setup.verifyProductionEnvironment()
      if (!env.isProductionReady) {
        console.log('\n❌ Environment not ready. Fix missing variables first.')
        return
      }

      // 2. List existing webhooks
      await setup.listExistingWebhooks()

      // 3. Create new Stripe webhook (if needed)
      console.log('\n🤔 Do you want to create a new Stripe webhook? (Check existing ones first)')
      console.log('If yes, run: npm run webhook:create-stripe')

      // 4. Show Sanity instructions
      setup.displaySanityWebhookInstructions()
      break

    default:
      console.log('\n🔗 Production Webhook Setup Commands:')
      console.log('npm run webhook:verify - Verify environment variables')
      console.log('npm run webhook:list - List existing Stripe webhooks')  
      console.log('npm run webhook:create-stripe - Create new Stripe webhook')
      console.log('npm run webhook:sanity - Show Sanity webhook instructions')
      console.log('npm run webhook:full-setup - Complete setup process')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { ProductionWebhookSetup }
