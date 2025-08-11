// scripts/sanity-ai-agent.mjs
import { AIAgent } from '../lib/ai-agent.mjs'
import { SanityAgent } from './sanity-agent.mjs'
import 'dotenv/config'

class SanityAIAgent extends AIAgent {
  constructor() {
    // Initialize base Sanity agent
    const sanityAgent = new SanityAgent()
    
    // Define Sanity-specific tools
    const sanityTools = [
      {
        name: 'get_studio_info',
        aliases: ['info', 'studio', 'status'],
        description: 'Get Sanity studio and project information',
        execute: async () => sanityAgent.runCommand('info')
      },
      {
        name: 'list_products',
        aliases: ['products', 'list-products', 'show-products'],
        description: 'List all products in Sanity CMS',
        execute: async () => sanityAgent.runCommand('list-products')
      },
      {
        name: 'create_product',
        aliases: ['create', 'add-product', 'new-product'],
        description: 'Create a new product in Sanity',
        execute: async (params) => sanityAgent.runCommand('create-product', 
          params.title, params.slug, params.priceEUR, params.description)
      },
      {
        name: 'update_product',
        aliases: ['update', 'modify-product', 'edit'],
        description: 'Update an existing product',
        execute: async (params) => sanityAgent.runCommand('update-product', 
          params.id, params.updates)
      },
      {
        name: 'delete_product',
        aliases: ['delete', 'remove-product'],
        description: 'Delete a product from Sanity',
        execute: async (params) => sanityAgent.runCommand('delete-product', params.id)
      },
      {
        name: 'sync_status',
        aliases: ['sync', 'integration-status'],
        description: 'Check Stripe integration status for products',
        execute: async () => {
          const products = await sanityAgent.runCommand('list-products')
          const syncStats = {
            total: products.length,
            synced: products.filter(p => p.hasStripeIntegration).length,
            unsynced: products.filter(p => !p.hasStripeIntegration).length,
            products: products.map(p => ({
              id: p.id,
              title: p.title,
              slug: p.slug,
              synced: p.hasStripeIntegration,
              stripeProductId: p.stripeProductId,
              stripePriceId: p.stripePriceIdOneTime
            }))
          }
          return syncStats
        }
      },
      {
        name: 'content_analysis',
        aliases: ['analyze', 'content-stats'],
        description: 'Analyze content structure and completeness',
        execute: async () => {
          const products = await sanityAgent.runCommand('list-products')
          
          const analysis = {
            contentHealth: {
              withImages: products.filter(p => p.image).length,
              withDescriptions: products.filter(p => p.description).length,
              withPricing: products.filter(p => p.priceEUR > 0).length,
              complete: products.filter(p => p.title && p.slug && p.description && p.priceEUR).length
            },
            pricing: {
              average: products.reduce((sum, p) => sum + (p.priceEUR || 0), 0) / products.length,
              min: Math.min(...products.map(p => p.priceEUR || 0).filter(p => p > 0)),
              max: Math.max(...products.map(p => p.priceEUR || 0))
            },
            recentActivity: products.sort((a, b) => new Date(b.updated) - new Date(a.updated)).slice(0, 5),
            products
          }
          
          return analysis
        }
      },
      {
        name: 'webhook_setup',
        aliases: ['webhook', 'auto-sync'],
        description: 'Setup webhook for automatic Stripe provisioning',
        execute: async () => ({
          instructions: 'Webhook setup instructions',
          webhookUrl: `https://hormonegroup.ie/api/admin/provision`,
          filter: '_type == "product" && defined(slug.current) && !(_id in path("drafts.**"))',
          events: ['create', 'update'],
          headers: { 'Authorization': `Bearer ${process.env.PROVISION_SECRET}` }
        })
      },
      {
        name: 'bulk_operations',
        aliases: ['bulk', 'batch'],
        description: 'Perform bulk operations on products',
        execute: async (params) => {
          if (params.operation === 'price_update') {
            // Example bulk operation
            return { message: 'Bulk operations require careful implementation', suggestion: 'Use individual updates for safety' }
          }
          return { availableOperations: ['price_update', 'status_check', 'export'] }
        }
      }
    ]

    super('Sanity AI Agent', 'content management, product catalog, and CMS operations', sanityTools)
    this.sanityAgent = sanityAgent
  }

  buildSystemPrompt(context) {
    const basePrompt = super.buildSystemPrompt(context)
    
    return basePrompt + `

SANITY CMS KNOWLEDGE:
- You specialize in Sanity CMS content management and product catalog operations
- Understand document structure, schemas, and content relationships
- Know about draft vs published content states
- Be aware of Stripe integration requirements (slug, priceEUR fields)
- Understand webhook automation for auto-provisioning

CONTENT MANAGEMENT PRINCIPLES:
- Always ensure content completeness (title, slug, description, pricing)
- Consider SEO implications of slugs and content structure
- Maintain consistent pricing and product information
- Think about content workflow and publishing processes

PRODUCT CATALOG OPERATIONS:
- Creating products with proper schema validation
- Managing product pricing and descriptions
- Ensuring Stripe integration readiness
- Content quality analysis and optimization

When users ask about:
- "products" or "catalog" → use list_products
- "new product" or "create" → use create_product
- "update" or "edit" → use update_product
- "sync" or "integration" → use sync_status
- "analyze" or "content health" → use content_analysis
- "webhook" or "automation" → use webhook_setup
- "bulk" operations → use bulk_operations

Always prioritize content quality and proper integration with Stripe.`
  }

  async getSystemContext() {
    try {
      const [info, products] = await Promise.all([
        this.sanityAgent.runCommand('info').catch(() => null),
        this.sanityAgent.runCommand('list-products').catch(() => [])
      ])

      const syncedCount = products.filter(p => p.hasStripeIntegration).length

      return {
        sanity: {
          projectId: info?.projectId,
          dataset: info?.dataset,
          totalProducts: products.length,
          syncedProducts: syncedCount,
          unsyncedProducts: products.length - syncedCount,
          studioUrl: info?.studioUrl
        },
        contentHealth: {
          complete: products.filter(p => p.title && p.slug && p.description && p.priceEUR).length,
          incomplete: products.filter(p => !p.title || !p.slug || !p.description || !p.priceEUR).length
        },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return { error: 'Unable to fetch Sanity context', timestamp: new Date().toISOString() }
    }
  }

  async processRequest(userRequest) {
    const context = await this.getSystemContext()
    return await this.process(userRequest, context)
  }
}

// CLI interface
async function main() {
  const request = process.argv.slice(2).join(' ') || 'help'
  const agent = new SanityAIAgent()
  
  try {
    const result = await agent.processRequest(request)
    
    console.log('\n=== SANITY AI AGENT RESULT ===')
    console.log(JSON.stringify(result, null, 2))
    
    if (result.humanMessage) {
      console.log('\n💬 AI Response:')
      console.log(result.humanMessage)
    }
    
  } catch (error) {
    console.error('❌ Sanity AI Agent error:', error.message)
    console.log('\n💡 Try: npm run sanity:ai "show products" or "analyze content health"')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { SanityAIAgent }
