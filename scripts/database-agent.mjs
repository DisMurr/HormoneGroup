// scripts/database-agent.mjs
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

class DatabaseAgent {
  constructor() {
    this.databaseUrl = process.env.DATABASE_URL
    this.projectRoot = process.cwd()
    this.prismaClient = null
    
    if (!this.databaseUrl) {
      throw new Error('Missing DATABASE_URL environment variable')
    }

    try {
      this.prismaClient = new PrismaClient()
    } catch (error) {
      console.warn('Prisma client initialization failed:', error.message)
    }
  }

  async getConnectionInfo() {
    try {
      const url = new URL(this.databaseUrl)
      return {
        provider: url.protocol.replace(':', ''),
        host: url.hostname,
        port: url.port,
        database: url.pathname.replace('/', ''),
        username: url.username,
        ssl: url.searchParams.get('sslmode') || 'prefer',
        connectionString: this.databaseUrl.replace(/:[^:]*@/, ':***@') // mask password
      }
    } catch (error) {
      throw new Error(`Invalid DATABASE_URL: ${error.message}`)
    }
  }

  async testConnection() {
    try {
      if (!this.prismaClient) {
        throw new Error('Prisma client not available')
      }
      
      await this.prismaClient.$connect()
      const result = await this.prismaClient.$queryRaw`SELECT NOW() as current_time`
      await this.prismaClient.$disconnect()
      
      return {
        connected: true,
        currentTime: result[0]?.current_time,
        message: 'Database connection successful'
      }
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        message: 'Database connection failed'
      }
    }
  }

  async getSchemaInfo() {
    try {
      const schemaPath = join(this.projectRoot, 'prisma', 'schema.prisma')
      if (!existsSync(schemaPath)) {
        throw new Error('Prisma schema file not found')
      }

      const schemaContent = readFileSync(schemaPath, 'utf8')
      
      // Parse models from schema
      const models = []
      const modelRegex = /model\s+(\w+)\s*{([^}]+)}/g
      let match
      
      while ((match = modelRegex.exec(schemaContent)) !== null) {
        const modelName = match[1]
        const modelBody = match[2]
        const fields = []
        
        const fieldRegex = /(\w+)\s+(\w+[?]?)\s*(@[^@]*)?/g
        let fieldMatch
        
        while ((fieldMatch = fieldRegex.exec(modelBody)) !== null) {
          if (!fieldMatch[1].startsWith('//') && !fieldMatch[1].startsWith('@')) {
            fields.push({
              name: fieldMatch[1],
              type: fieldMatch[2],
              attributes: fieldMatch[3] || ''
            })
          }
        }
        
        models.push({ name: modelName, fields })
      }
      
      return {
        schemaPath,
        models,
        totalModels: models.length
      }
    } catch (error) {
      throw new Error(`Failed to get schema info: ${error.message}`)
    }
  }

  async getTableStats() {
    try {
      if (!this.prismaClient) {
        throw new Error('Prisma client not available')
      }

      const stats = {}
      
      // Get counts for each model
      try {
        stats.User = await this.prismaClient.user.count()
      } catch (e) { stats.User = 'Error' }
      
      try {
        stats.Session = await this.prismaClient.session.count()
      } catch (e) { stats.Session = 'Error' }
      
      try {
        stats.Order = await this.prismaClient.order.count()
      } catch (e) { stats.Order = 'Error' }
      
      try {
        stats.FormSubmission = await this.prismaClient.formSubmission.count()
      } catch (e) { stats.FormSubmission = 'Error' }
      
      try {
        stats.VerificationToken = await this.prismaClient.verificationToken.count()
      } catch (e) { stats.VerificationToken = 'Error' }
      
      return stats
    } catch (error) {
      throw new Error(`Failed to get table stats: ${error.message}`)
    }
  }

  async listRecentOrders(limit = 10) {
    try {
      if (!this.prismaClient) {
        throw new Error('Prisma client not available')
      }

      const orders = await this.prismaClient.order.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          mode: true,
          items: true,
          createdAt: true,
          stripeSessionId: true
        }
      })
      
      return orders.map(order => ({
        ...order,
        items: Array.isArray(order.items) ? order.items : [order.items]
      }))
    } catch (error) {
      throw new Error(`Failed to list orders: ${error.message}`)
    }
  }

  async listUsers(limit = 10) {
    try {
      if (!this.prismaClient) {
        throw new Error('Prisma client not available')
      }

      const users = await this.prismaClient.user.findMany({
        take: limit,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
          _count: {
            select: { sessions: true }
          }
        }
      })
      
      return users
    } catch (error) {
      throw new Error(`Failed to list users: ${error.message}`)
    }
  }

  async listFormSubmissions(type = null, limit = 10) {
    try {
      if (!this.prismaClient) {
        throw new Error('Prisma client not available')
      }

      const where = type ? { type } : {}
      
      const submissions = await this.prismaClient.formSubmission.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
      
      return submissions
    } catch (error) {
      throw new Error(`Failed to list form submissions: ${error.message}`)
    }
  }

  async runMigration(action = 'deploy') {
    try {
      let command
      switch (action) {
        case 'deploy':
          command = 'npx prisma migrate deploy'
          break
        case 'dev':
          command = 'npx prisma migrate dev'
          break
        case 'reset':
          command = 'npx prisma migrate reset --force'
          break
        case 'status':
          command = 'npx prisma migrate status'
          break
        default:
          throw new Error(`Unknown migration action: ${action}`)
      }
      
      const result = execSync(command, { 
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      return {
        success: true,
        action,
        output: result
      }
    } catch (error) {
      return {
        success: false,
        action,
        error: error.message,
        output: error.stdout || error.stderr || ''
      }
    }
  }

  async generatePrismaClient() {
    try {
      const result = execSync('npx prisma generate', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      return {
        success: true,
        output: result
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || error.stderr || ''
      }
    }
  }

  async introspectDatabase() {
    try {
      const result = execSync('npx prisma db pull', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      return {
        success: true,
        output: result,
        message: 'Database introspection completed'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || error.stderr || ''
      }
    }
  }

  async pushSchema() {
    try {
      const result = execSync('npx prisma db push', {
        cwd: this.projectRoot,
        encoding: 'utf8',
        stdio: 'pipe'
      })
      
      return {
        success: true,
        output: result,
        message: 'Schema pushed to database'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || error.stderr || ''
      }
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
    const connectionInfo = await this.getConnectionInfo()
    
    console.log('\n=== Setting up Database environment files ===')
    console.log(`Provider: ${connectionInfo.provider}`)
    console.log(`Host: ${connectionInfo.host}`)
    console.log(`Database: ${connectionInfo.database}`)
    
    // Environment updates
    const envUpdates = {
      'DATABASE_URL': this.databaseUrl,
      'NEXTAUTH_URL': process.env.NEXTAUTH_URL || 'http://localhost:3000',
      'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET || 'your-nextauth-secret'
    }
    
    // Update both env files
    this.updateEnvFile('.env.local', envUpdates)
    this.updateEnvFile('.env.production', {
      ...envUpdates,
      'NEXTAUTH_URL': 'https://hormonegroup.ie'
    })
    
    console.log('✅ Updated .env.local and .env.production with database configuration')
    
    return {
      connectionInfo,
      envUpdates
    }
  }

  async runCommand(command, params = {}) {
    try {
      switch (command) {
        case 'info':
        case 'connection':
          return await this.getConnectionInfo()
        
        case 'test':
        case 'test-connection':
          return await this.testConnection()
        
        case 'setup-env':
          return await this.setupEnvironments()
        
        case 'schema':
        case 'schema-info':
          return await this.getSchemaInfo()
        
        case 'stats':
        case 'table-stats':
          return await this.getTableStats()
        
        case 'orders':
        case 'list-orders':
          return await this.listRecentOrders(params.limit)
        
        case 'users':
        case 'list-users':
          return await this.listUsers(params.limit)
        
        case 'forms':
        case 'list-forms':
          return await this.listFormSubmissions(params.type, params.limit)
        
        case 'migrate':
          return await this.runMigration(params.action || 'deploy')
        
        case 'generate':
          return await this.generatePrismaClient()
        
        case 'introspect':
        case 'pull':
          return await this.introspectDatabase()
        
        case 'push':
          return await this.pushSchema()
        
        case 'full-setup':
          const connection = await this.testConnection()
          const schema = await this.getSchemaInfo()
          const stats = await this.getTableStats()
          const envSetup = await this.setupEnvironments()
          
          return {
            connection,
            schema,
            stats,
            envSetup,
            summary: `Database setup complete for ${connection.connected ? 'connected' : 'disconnected'} database`
          }
        
        default:
          throw new Error(`Unknown command: ${command}`)
      }
    } catch (error) {
      return { error: error.message }
    }
  }

  async cleanup() {
    if (this.prismaClient) {
      await this.prismaClient.$disconnect()
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
  
  const agent = new DatabaseAgent()
  const result = await agent.runCommand(command, params)
  
  console.log('\n=== Database Agent Result ===')
  console.log(JSON.stringify(result, null, 2))
  
  await agent.cleanup()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { DatabaseAgent }
