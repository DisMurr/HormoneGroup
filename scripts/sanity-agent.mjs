// scripts/sanity-agent.mjs
import 'dotenv/config'
import { createClient } from 'next-sanity'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

class SanityAgent {
  constructor() {
    this.projectId = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
    this.dataset = process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET
    this.apiVersion = process.env.SANITY_API_VERSION || '2025-08-11'
    this.token = process.env.SANITY_WRITE_TOKEN || process.env.SANITY_READ_TOKEN
    this.projectRoot = process.cwd()
    
    if (!this.projectId || !this.dataset) {
      throw new Error('Missing SANITY_PROJECT_ID or SANITY_DATASET')
    }

    // Create clients
    this.readClient = createClient({
      projectId: this.projectId,
      dataset: this.dataset,
      apiVersion: this.apiVersion,
      useCdn: false
    })

    this.writeClient = createClient({
      projectId: this.projectId,
      dataset: this.dataset,
      apiVersion: this.apiVersion,
      token: this.token,
      useCdn: false
    })
  }

  async getProjectInfo() {
    try {
      // Get basic project info
      return {
        projectId: this.projectId,
        dataset: this.dataset,
        apiVersion: this.apiVersion,
        hasWriteToken: !!this.token,
        studioUrl: `https://${this.projectId}.sanity.studio`,
        manageUrl: `https://www.sanity.io/manage/personal/project/${this.projectId}`
      }
    } catch (error) {
      throw new Error(`Failed to get project info: ${error.message}`)
    }
  }

  async listDocuments(type = null, limit = 100) {
    try {
      const query = type 
        ? `*[_type == "${type}"][0...${limit}]{ _id, _type, _createdAt, _updatedAt, title, name, slug }`
        : `*[0...${limit}]{ _id, _type, _createdAt, _updatedAt, title, name, slug }`
      
      const documents = await this.readClient.fetch(query)
      return documents.map(doc => ({
        id: doc._id,
        type: doc._type,
        title: doc.title || doc.name || 'Untitled',
        slug: doc.slug?.current || doc.slug,
        created: doc._createdAt,
        updated: doc._updatedAt
      }))
    } catch (error) {
      throw new Error(`Failed to list documents: ${error.message}`)
    }
  }

  async listProducts() {
    try {
      const query = `*[_type == "product"]{
        _id,
        title,
        "slug": slug.current,
        priceEUR,
        stripeProductId,
        stripePriceIdOneTime,
        _createdAt,
        _updatedAt
      }`
      
      const products = await this.readClient.fetch(query)
      return products.map(product => ({
        id: product._id,
        title: product.title,
        slug: product.slug,
        priceEUR: product.priceEUR,
        stripeProductId: product.stripeProductId,
        stripePriceIdOneTime: product.stripePriceIdOneTime,
        created: product._createdAt,
        updated: product._updatedAt,
        hasStripeIntegration: !!(product.stripeProductId && product.stripePriceIdOneTime)
      }))
    } catch (error) {
      throw new Error(`Failed to list products: ${error.message}`)
    }
  }

  async getDocument(id) {
    try {
      const document = await this.readClient.fetch(`*[_id == $id][0]`, { id })
      return document
    } catch (error) {
      throw new Error(`Failed to get document: ${error.message}`)
    }
  }

  async createDocument(type, data) {
    try {
      if (!this.token) {
        throw new Error('Write token required for creating documents')
      }

      const doc = {
        _type: type,
        ...data
      }

      const result = await this.writeClient.create(doc)
      return result
    } catch (error) {
      throw new Error(`Failed to create document: ${error.message}`)
    }
  }

  async updateDocument(id, data) {
    try {
      if (!this.token) {
        throw new Error('Write token required for updating documents')
      }

      const result = await this.writeClient.patch(id).set(data).commit()
      return result
    } catch (error) {
      throw new Error(`Failed to update document: ${error.message}`)
    }
  }

  async deleteDocument(id) {
    try {
      if (!this.token) {
        throw new Error('Write token required for deleting documents')
      }

      const result = await this.writeClient.delete(id)
      return result
    } catch (error) {
      throw new Error(`Failed to delete document: ${error.message}`)
    }
  }

  async createProduct(productData) {
    try {
      const slug = productData.slug || productData.title?.toLowerCase().replace(/\s+/g, '-')
      
      const product = {
        _type: 'product',
        title: productData.title,
        slug: {
          _type: 'slug',
          current: slug
        },
        priceEUR: productData.priceEUR,
        description: productData.description,
        stripeProductId: productData.stripeProductId,
        stripePriceIdOneTime: productData.stripePriceIdOneTime,
        ...productData.additional
      }

      return await this.createDocument('product', product)
    } catch (error) {
      throw new Error(`Failed to create product: ${error.message}`)
    }
  }

  async syncWithStripe() {
    try {
      const products = await this.listProducts()
      const unsyncedProducts = products.filter(p => !p.hasStripeIntegration)
      
      return {
        totalProducts: products.length,
        syncedProducts: products.filter(p => p.hasStripeIntegration).length,
        unsyncedProducts: unsyncedProducts.length,
        needsSync: unsyncedProducts.map(p => ({
          id: p.id,
          title: p.title,
          slug: p.slug
        }))
      }
    } catch (error) {
      throw new Error(`Failed to check Stripe sync status: ${error.message}`)
    }
  }

  async getSchemaTypes() {
    try {
      // This would require the management API, but we can infer from documents
      const query = `array::unique(*[]._type)`
      const types = await this.readClient.fetch(query)
      
      const typeCounts = {}
      for (const type of types) {
        const count = await this.readClient.fetch(`count(*[_type == "${type}"])`)
        typeCounts[type] = count
      }
      
      return typeCounts
    } catch (error) {
      throw new Error(`Failed to get schema types: ${error.message}`)
    }
  }

  generateWebhookUrl(baseUrl = null) {
    const base = baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    return {
      provisionUrl: `${base}/api/admin/provision`,
      sanityWebhookUrl: `${base}/api/webhooks/sanity/product`,
      webhookInstructions: [
        '1. Go to https://www.sanity.io/manage',
        '2. Select your project',
        '3. Go to API -> Webhooks',
        '4. Click "Create webhook"',
        '5. Use the URL above',
        '6. Filter: _type == "product" && defined(slug.current) && !(_id in path("drafts.**"))',
        '7. Trigger on: Create, Update, Delete'
      ]
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
    const projectInfo = await this.getProjectInfo()
    
    console.log('\n=== Setting up Sanity environment files ===')
    console.log(`Project ID: ${projectInfo.projectId}`)
    console.log(`Dataset: ${projectInfo.dataset}`)
    console.log(`Has Write Token: ${projectInfo.hasWriteToken}`)
    
    // Environment updates
    const envUpdates = {
      'SANITY_PROJECT_ID': this.projectId,
      'SANITY_DATASET': this.dataset,
      'SANITY_API_VERSION': this.apiVersion,
      'SANITY_READ_TOKEN': process.env.SANITY_READ_TOKEN || 'your-sanity-read-token',
      'SANITY_WRITE_TOKEN': process.env.SANITY_WRITE_TOKEN || 'your-sanity-write-token',
      'NEXT_PUBLIC_SANITY_PROJECT_ID': this.projectId,
      'NEXT_PUBLIC_SANITY_DATASET': this.dataset
    }
    
    // Update both env files
    this.updateEnvFile('.env.local', envUpdates)
    this.updateEnvFile('.env.production', envUpdates)
    
    console.log('✅ Updated .env.local and .env.production with Sanity configuration')
    
    if (!projectInfo.hasWriteToken) {
      console.log('\n⚠️  No write token detected. To create/update documents:')
      console.log('1. Go to https://www.sanity.io/manage')
      console.log('2. Select your project')
      console.log('3. Go to API -> Tokens')
      console.log('4. Create a token with "Editor" permissions')
      console.log('5. Add it as SANITY_WRITE_TOKEN in your .env')
    }
    
    return {
      projectInfo,
      envUpdates,
      webhookSetup: this.generateWebhookUrl()
    }
  }

  async runCommand(command, params = {}) {
    try {
      switch (command) {
        case 'info':
        case 'project':
          return await this.getProjectInfo()
        
        case 'setup-env':
          return await this.setupEnvironments()
        
        case 'list-documents':
          return await this.listDocuments(params.type, params.limit)
        
        case 'list-products':
          return await this.listProducts()
        
        case 'get-document':
          return await this.getDocument(params.id)
        
        case 'create-document':
          return await this.createDocument(params.type, params.data)
        
        case 'create-product':
          return await this.createProduct(params)
        
        case 'update-document':
          return await this.updateDocument(params.id, params.data)
        
        case 'delete-document':
          return await this.deleteDocument(params.id)
        
        case 'schema-types':
          return await this.getSchemaTypes()
        
        case 'sync-stripe':
          return await this.syncWithStripe()
        
        case 'webhook-setup':
          return this.generateWebhookUrl(params.baseUrl)
        
        case 'full-setup':
          const info = await this.getProjectInfo()
          const products = await this.listProducts()
          const schemaTypes = await this.getSchemaTypes()
          const stripeSync = await this.syncWithStripe()
          const envSetup = await this.setupEnvironments()
          
          return {
            projectInfo: info,
            products,
            schemaTypes,
            stripeSync,
            envSetup,
            summary: `Setup complete for Sanity project ${info.projectId}`
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
  
  const agent = new SanityAgent()
  const result = await agent.runCommand(command, params)
  
  console.log('\n=== Sanity Agent Result ===')
  console.log(JSON.stringify(result, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { SanityAgent }
