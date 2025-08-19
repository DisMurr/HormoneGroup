// scripts/stripe-agent.mjs
import 'dotenv/config'
import Stripe from 'stripe'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

class StripeAgent {
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    this.isLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live')
    this.projectRoot = process.cwd()
  }

  async getAccountInfo() {
    try {
      const account = await this.stripe.accounts.retrieve()
      return {
        id: account.id,
        email: account.email,
        country: account.country,
        businessName: account.business_profile?.name,
        isLiveMode: this.isLiveMode
      }
    } catch (error) {
      throw new Error(`Failed to get account info: ${error.message}`)
    }
  }

  async generateWebhookEndpoint(url) {
    try {
      const webhook = await this.stripe.webhookEndpoints.create({
        url: url,
        enabled_events: [
          'checkout.session.completed',
          'payment_intent.succeeded',
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted'
        ]
      })
      return {
        id: webhook.id,
        secret: webhook.secret,
        url: webhook.url,
        status: webhook.status
      }
    } catch (error) {
      throw new Error(`Failed to create webhook: ${error.message}`)
    }
  }

  async listWebhooks() {
    try {
      const webhooks = await this.stripe.webhookEndpoints.list({ limit: 100 })
      return webhooks.data.map(webhook => ({
        id: webhook.id,
        url: webhook.url,
        status: webhook.status,
        events: webhook.enabled_events
      }))
    } catch (error) {
      throw new Error(`Failed to list webhooks: ${error.message}`)
    }
  }

  async createProduct(name, description, metadata = {}) {
    try {
      const product = await this.stripe.products.create({
        name,
        description,
        metadata
      })
      return product
    } catch (error) {
      throw new Error(`Failed to create product: ${error.message}`)
    }
  }

  async createPrice(productId, unitAmount, currency = 'eur') {
    try {
      const price = await this.stripe.prices.create({
        product: productId,
        unit_amount: unitAmount,
        currency,
      })
      return price
    } catch (error) {
      throw new Error(`Failed to create price: ${error.message}`)
    }
  }

  async listProducts() {
    try {
      const products = await this.stripe.products.list({ limit: 100 })
      return products.data.map(product => ({
        id: product.id,
        name: product.name,
        active: product.active,
        created: new Date(product.created * 1000),
        metadata: product.metadata
      }))
    } catch (error) {
      throw new Error(`Failed to list products: ${error.message}`)
    }
  }

  async listPrices() {
    try {
      const prices = await this.stripe.prices.list({ limit: 100 })
      return prices.data.map(price => ({
        id: price.id,
        productId: price.product,
        unitAmount: price.unit_amount,
        currency: price.currency,
        active: price.active,
        type: price.type
      }))
    } catch (error) {
      throw new Error(`Failed to list prices: ${error.message}`)
    }
  }

  generateTestKeys() {
    // Since we can't programmatically get test keys, provide instructions
    return {
      instruction: 'Test keys must be retrieved manually',
      steps: [
        '1. Go to https://dashboard.stripe.com/test/apikeys',
        '2. Copy "Publishable key" (starts with pk_test_)',
        '3. Reveal and copy "Secret key" (starts with sk_test_)',
        '4. Use these keys in .env.local for development'
      ],
      testDashboardUrl: 'https://dashboard.stripe.com/test/apikeys',
      liveDashboardUrl: 'https://dashboard.stripe.com/apikeys'
    }
  }

  updateEnvFile(filePath, updates) {
    try {
      const envPath = join(this.projectRoot, filePath)
      let content = readFileSync(envPath, 'utf8')
      
      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm')
        if (content.match(regex)) {
          content = content.replace(regex, `${key}=${value}`)
        } else {
          content += `\n${key}=${value}`
        }
      }
      
      writeFileSync(envPath, content)
      return { success: true, file: filePath, updates }
    } catch (error) {
      throw new Error(`Failed to update env file: ${error.message}`)
    }
  }

  async setupEnvironments() {
    const account = await this.getAccountInfo()
    
    console.log('\n=== Setting up environment files ===')
    console.log(`Current mode: ${account.isLiveMode ? 'LIVE' : 'TEST'}`)
    
    if (account.isLiveMode) {
      // Update .env.production with live keys
      const productionUpdates = {
        'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
        'NEXT_PUBLIC_STRIPE_PUB_KEY': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUB_KEY,
        'NEXT_PUBLIC_SITE_URL': 'https://hormonegroup.ie'
      }
      
      this.updateEnvFile('.env.production', productionUpdates)
      console.log('✅ Updated .env.production with live keys')
      
      // Provide test key instructions for .env.local
      const testKeyInfo = this.generateTestKeys()
      console.log('\n🚨 For .env.local, you need test keys:')
      testKeyInfo.steps.forEach(step => console.log(step))
      
      return {
        production: productionUpdates,
        testKeyInstructions: testKeyInfo
      }
    } else {
      // Update .env.local with test keys
      const localUpdates = {
        'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
        'NEXT_PUBLIC_STRIPE_PUB_KEY': process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUB_KEY,
        'NEXT_PUBLIC_SITE_URL': 'http://localhost:3000'
      }
      
      this.updateEnvFile('.env.local', localUpdates)
      console.log('✅ Updated .env.local with test keys')
      
      return { local: localUpdates }
    }
  }

  async runCommand(command, params = {}) {
    try {
      switch (command) {
        case 'account':
          return await this.getAccountInfo()
        
        case 'setup-env':
          return await this.setupEnvironments()
        
        case 'create-webhook':
          return await this.generateWebhookEndpoint(params.url)
        
        case 'list-webhooks':
          return await this.listWebhooks()
        
        case 'list-products':
          return await this.listProducts()
        
        case 'list-prices':
          return await this.listPrices()
        
        case 'create-product':
          return await this.createProduct(params.name, params.description, params.metadata)
        
        case 'create-price':
          return await this.createPrice(params.productId, params.unitAmount, params.currency)
        
        case 'full-setup':
          const account = await this.getAccountInfo()
          const envSetup = await this.setupEnvironments()
          const webhooks = await this.listWebhooks()
          const products = await this.listProducts()
          
          return {
            account,
            envSetup,
            webhooks,
            products,
            summary: `Setup complete for ${account.isLiveMode ? 'LIVE' : 'TEST'} mode`
          }
        
        default:
          throw new Error(`Unknown command: ${command}`)
      }
    } catch (error) {
      return { error: error.message }
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || 'full-setup'
  const params = {}
  
  // Parse additional parameters
  for (let i = 3; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace('--', '')
    const value = process.argv[i + 1]
    if (key && value) {
      params[key] = value
    }
  }
  
  const agent = new StripeAgent()
  const result = await agent.runCommand(command, params)
  
  console.log('\n=== Stripe Agent Result ===')
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { StripeAgent }
