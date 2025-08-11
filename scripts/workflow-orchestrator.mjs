// scripts/workflow-orchestrator.mjs
import 'dotenv/config'
import { SanityAgent } from './sanity-agent.mjs'
import { StripeAgent } from './stripe-agent.mjs'
import { DatabaseAgent } from './database-agent.mjs'

class WorkflowOrchestrator {
  constructor() {
    this.sanityAgent = new SanityAgent()
    this.stripeAgent = new StripeAgent()
    this.databaseAgent = new DatabaseAgent()
  }

  async testFullWorkflow(productData) {
    console.log('\n🚀 === TESTING FULL WORKFLOW ===')
    const results = {
      steps: [],
      success: true,
      errors: []
    }

    try {
      // Step 1: Create product in Sanity
      console.log('\n📝 Step 1: Creating product in Sanity...')
      const sanityResult = await this.sanityAgent.createProduct({
        title: productData.title || 'Test Workflow Product',
        slug: productData.slug || 'test-workflow-product',
        priceEUR: productData.priceEUR || 49,
        description: productData.description || 'Testing full workflow integration'
      })
      
      if (sanityResult.error) {
        throw new Error(`Sanity creation failed: ${sanityResult.error}`)
      }
      
      results.steps.push({
        step: 'sanity_create',
        success: true,
        data: sanityResult
      })
      console.log('✅ Product created in Sanity:', sanityResult._id)

      // Step 2: Auto-provision to Stripe
      console.log('\n💳 Step 2: Auto-provisioning to Stripe...')
      const provisionResult = await this.provisionToStripe(sanityResult.slug.current)
      
      if (provisionResult.error) {
        throw new Error(`Stripe provisioning failed: ${provisionResult.error}`)
      }
      
      results.steps.push({
        step: 'stripe_provision',
        success: true,
        data: provisionResult
      })
      console.log('✅ Product provisioned to Stripe:', provisionResult.stripeProductId)

      // Step 3: Create checkout session
      console.log('\n🛒 Step 3: Creating checkout session...')
      const checkoutResult = await this.createCheckoutSession(provisionResult.stripePriceIdOneTime)
      
      if (checkoutResult.error) {
        throw new Error(`Checkout creation failed: ${checkoutResult.error}`)
      }
      
      results.steps.push({
        step: 'checkout_create',
        success: true,
        data: checkoutResult
      })
      console.log('✅ Checkout session created:', checkoutResult.url)

      // Step 4: Simulate order completion (normally done by Stripe webhook)
      console.log('\n💾 Step 4: Simulating order save to Database...')
      const orderResult = await this.simulateOrderSave({
        email: 'test@example.com',
        stripeSessionId: checkoutResult.id,
        items: [{ 
          name: productData.title || 'Test Product',
          price: productData.priceEUR || 49,
          quantity: 1
        }],
        mode: 'payment'
      })
      
      if (orderResult.error) {
        throw new Error(`Order save failed: ${orderResult.error}`)
      }
      
      results.steps.push({
        step: 'database_save',
        success: true,
        data: orderResult
      })
      console.log('✅ Order saved to Database:', orderResult.id)

      // Step 5: Health check across all systems
      console.log('\n📊 Step 5: Running health checks...')
      const healthCheck = await this.runHealthChecks()
      
      results.steps.push({
        step: 'health_check',
        success: true,
        data: healthCheck
      })

      console.log('\n🎉 === WORKFLOW COMPLETED SUCCESSFULLY ===')
      return results

    } catch (error) {
      console.error('\n❌ === WORKFLOW FAILED ===')
      console.error('Error:', error.message)
      results.success = false
      results.errors.push(error.message)
      return results
    }
  }

  async provisionToStripe(slug) {
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const secret = process.env.PROVISION_SECRET
      
      console.log(`Making request to: ${base}/api/admin/provision`)
      console.log(`Using slug: ${slug}`)
      
      const response = await fetch(`${base}/api/admin/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`
        },
        body: JSON.stringify({ slug })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`HTTP ${response.status}: ${errorText}`)
        return { error: `HTTP ${response.status}: ${response.statusText}` }
      }
      
      const result = await response.json()
      return result
    } catch (error) {
      console.error('Provision fetch error:', error.message)
      return { error: error.message }
    }
  }

  async createCheckoutSession(priceId) {
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      
      const response = await fetch(`${base}/api/checkout/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId,
          successPath: '/thanks',
          cancelPath: '/tests'
        })
      })
      
      return await response.json()
    } catch (error) {
      return { error: error.message }
    }
  }

  async simulateOrderSave(orderData) {
    try {
      // This simulates what the Stripe webhook would do
      if (!this.databaseAgent.prismaClient) {
        throw new Error('Database client not available')
      }

      const order = await this.databaseAgent.prismaClient.order.create({
        data: {
          email: orderData.email,
          stripeSessionId: orderData.stripeSessionId,
          items: orderData.items,
          mode: orderData.mode
        }
      })
      
      return order
    } catch (error) {
      return { error: error.message }
    }
  }

  async runHealthChecks() {
    const health = {
      sanity: await this.sanityAgent.runCommand('info'),
      stripe: await this.stripeAgent.runCommand('account'),
      database: await this.databaseAgent.runCommand('test-connection'),
      timestamp: new Date().toISOString()
    }
    
    return health
  }

  async setupWebhooks() {
    console.log('\n🔗 === SETTING UP WEBHOOKS ===')
    
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    
    // 1. Sanity webhook setup instructions
    console.log('\n📝 Sanity Webhook Setup:')
    console.log('1. Go to https://www.sanity.io/manage')
    console.log(`2. Select project: ${process.env.SANITY_PROJECT_ID}`)
    console.log('3. Go to API → Webhooks → Create webhook')
    console.log(`4. URL: ${baseUrl}/api/admin/provision`)
    console.log('5. Method: POST')
    console.log(`6. Headers: Authorization: Bearer ${process.env.PROVISION_SECRET}`)
    console.log('7. Filter: _type == "product" && defined(slug.current) && !(_id in path("drafts.**"))')
    console.log('8. Trigger on: Create, Update')
    console.log('9. Projection: { "slug": slug.current, "id": _id }')
    
    // 2. Stripe webhook setup instructions
    console.log('\n💳 Stripe Webhook Setup:')
    console.log('For development:')
    console.log('1. Run: npm run stripe:listen')
    console.log('2. Copy the whsec_ key to STRIPE_WEBHOOK_SECRET in .env')
    console.log('3. Restart your dev server')
    console.log('')
    console.log('For production:')
    console.log('1. Go to https://dashboard.stripe.com/webhooks')
    console.log('2. Create endpoint')
    console.log(`3. URL: https://hormonegroup.ie/api/stripe/webhook`)
    console.log('4. Events: checkout.session.completed, payment_intent.succeeded')
    console.log('5. Copy webhook secret to production env')
    
    return {
      sanityWebhook: `${baseUrl}/api/admin/provision`,
      stripeWebhook: `${baseUrl}/api/stripe/webhook`,
      setupComplete: false,
      instructions: 'Follow the printed instructions above'
    }
  }

  async monitorOperations() {
    console.log('\n📊 === MONITORING OPERATIONS ===')
    
    // Get stats from all systems
    const sanityProducts = await this.sanityAgent.runCommand('list-products')
    const stripeProducts = await this.stripeAgent.runCommand('list-products')
    const databaseStats = await this.databaseAgent.runCommand('table-stats')
    const recentOrders = await this.databaseAgent.runCommand('list-orders', { limit: 5 })
    
    const monitoring = {
      sanity: {
        totalProducts: sanityProducts.length || 0,
        syncedProducts: sanityProducts.filter(p => p.hasStripeIntegration).length || 0
      },
      stripe: {
        totalProducts: stripeProducts.length || 0,
        totalPrices: (await this.stripeAgent.runCommand('list-prices')).length || 0
      },
      database: {
        stats: databaseStats,
        recentOrders: recentOrders.length || 0
      },
      health: await this.runHealthChecks(),
      timestamp: new Date().toISOString()
    }
    
    console.log('\n📈 System Overview:')
    console.log(`Sanity: ${monitoring.sanity.totalProducts} products (${monitoring.sanity.syncedProducts} synced)`)
    console.log(`Stripe: ${monitoring.stripe.totalProducts} products, ${monitoring.stripe.totalPrices} prices`)
    console.log(`Database: ${monitoring.database.stats.Order || 0} orders, ${monitoring.database.stats.User || 0} users`)
    console.log(`Health: ${monitoring.health.database.connected ? '🟢' : '🔴'} DB, ${monitoring.health.sanity.error ? '🔴' : '🟢'} Sanity, ${monitoring.health.stripe.error ? '🔴' : '🟢'} Stripe`)
    
    return monitoring
  }

  async cleanup() {
    await this.databaseAgent.cleanup()
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || 'help'
  const orchestrator = new WorkflowOrchestrator()
  
  try {
    switch (command) {
      case 'test-workflow':
        const productData = {
          title: process.argv[3] || 'Workflow Test Product',
          slug: process.argv[4] || 'workflow-test-product',
          priceEUR: parseInt(process.argv[5]) || 29,
          description: 'Testing complete workflow integration'
        }
        const result = await orchestrator.testFullWorkflow(productData)
        console.log('\n=== FINAL RESULT ===')
        console.log(JSON.stringify(result, null, 2))
        break
        
      case 'setup-webhooks':
        const webhooks = await orchestrator.setupWebhooks()
        console.log('\n=== WEBHOOK SETUP ===')
        console.log(JSON.stringify(webhooks, null, 2))
        break
        
      case 'monitor':
        const monitoring = await orchestrator.monitorOperations()
        console.log('\n=== MONITORING RESULT ===')
        console.log(JSON.stringify(monitoring, null, 2))
        break
        
      case 'health':
        const health = await orchestrator.runHealthChecks()
        console.log('\n=== HEALTH CHECK ===')
        console.log(JSON.stringify(health, null, 2))
        break
        
      default:
        console.log('\n🚀 Workflow Orchestrator Commands:')
        console.log('npm run workflow test-workflow [title] [slug] [price] - Test full workflow')
        console.log('npm run workflow setup-webhooks - Setup webhook instructions')
        console.log('npm run workflow monitor - Monitor all operations')
        console.log('npm run workflow health - Health check all systems')
    }
  } finally {
    await orchestrator.cleanup()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { WorkflowOrchestrator }
