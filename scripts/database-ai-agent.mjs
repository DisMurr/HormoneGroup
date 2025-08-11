// scripts/database-ai-agent.mjs
import { AIAgent } from '../lib/ai-agent.mjs'
import { DatabaseAgent } from './database-agent.mjs'
import 'dotenv/config'

class DatabaseAIAgent extends AIAgent {
  constructor() {
    // Initialize base Database agent
    const databaseAgent = new DatabaseAgent()
    
    // Define Database-specific tools
    const databaseTools = [
      {
        name: 'test_connection',
        aliases: ['connection', 'status', 'health'],
        description: 'Test database connection and health',
        execute: async () => databaseAgent.runCommand('test-connection')
      },
      {
        name: 'get_schema_info',
        aliases: ['schema', 'structure', 'models'],
        description: 'Get database schema and model information',
        execute: async () => databaseAgent.runCommand('schema-info')
      },
      {
        name: 'get_table_stats',
        aliases: ['stats', 'table-stats', 'counts'],
        description: 'Get statistics for all database tables',
        execute: async () => databaseAgent.runCommand('table-stats')
      },
      {
        name: 'list_orders',
        aliases: ['orders', 'list-orders', 'recent-orders'],
        description: 'List recent orders from the database',
        execute: async (params) => databaseAgent.runCommand('list-orders', params)
      },
      {
        name: 'list_users',
        aliases: ['users', 'list-users', 'customers'],
        description: 'List users/customers from the database',
        execute: async (params) => databaseAgent.runCommand('list-users', params)
      },
      {
        name: 'run_migrations',
        aliases: ['migrate', 'migrations', 'deploy'],
        description: 'Run Prisma database migrations',
        execute: async () => databaseAgent.runCommand('run-migrations')
      },
      {
        name: 'backup_data',
        aliases: ['backup', 'export'],
        description: 'Create database backup or export data',
        execute: async (params) => databaseAgent.runCommand('backup', params)
      },
      {
        name: 'analyze_orders',
        aliases: ['analyze', 'order-analysis', 'revenue'],
        description: 'Analyze order patterns and revenue data',
        execute: async () => {
          const orders = await databaseAgent.runCommand('list-orders', { limit: 100 })
          
          if (!orders || orders.length === 0) {
            return { 
              message: 'No orders found to analyze',
              totalOrders: 0,
              totalRevenue: 0,
              avgOrderValue: 0
            }
          }

          const analysis = {
            totalOrders: orders.length,
            dateRange: {
              earliest: orders[orders.length - 1]?.createdAt,
              latest: orders[0]?.createdAt
            },
            ordersByMode: orders.reduce((acc, order) => {
              acc[order.mode] = (acc[order.mode] || 0) + 1
              return acc
            }, {}),
            recentOrders: orders.slice(0, 5),
            totalItems: orders.reduce((sum, order) => sum + (order.items?.length || 0), 0)
          }
          
          return analysis
        }
      },
      {
        name: 'performance_check',
        aliases: ['performance', 'slow-queries', 'optimize'],
        description: 'Check database performance and identify issues',
        execute: async () => {
          const stats = await databaseAgent.runCommand('table-stats')
          const connection = await databaseAgent.runCommand('test-connection')
          
          return {
            connectionHealth: connection,
            tableStats: stats,
            recommendations: [
              stats.Order > 1000 ? 'Consider indexing for large order table' : null,
              stats.User > 500 ? 'Monitor user query performance' : null,
              'Regular backup schedule recommended'
            ].filter(Boolean),
            timestamp: new Date().toISOString()
          }
        }
      },
      {
        name: 'data_integrity_check',
        aliases: ['integrity', 'validation', 'audit'],
        description: 'Check data integrity and validation',
        execute: async () => {
          const [orders, users, stats] = await Promise.all([
            databaseAgent.runCommand('list-orders', { limit: 50 }),
            databaseAgent.runCommand('list-users', { limit: 50 }),
            databaseAgent.runCommand('table-stats')
          ])

          const integrity = {
            tables: stats,
            validation: {
              ordersWithEmail: orders?.filter(o => o.email).length || 0,
              ordersWithItems: orders?.filter(o => o.items && o.items.length > 0).length || 0,
              usersWithEmail: users?.filter(u => u.email).length || 0
            },
            issues: [],
            recommendations: []
          }

          // Check for potential issues
          if (orders && orders.some(o => !o.email)) {
            integrity.issues.push('Some orders missing email addresses')
          }
          
          if (orders && orders.some(o => !o.items || o.items.length === 0)) {
            integrity.issues.push('Some orders have no items')
          }

          return integrity
        }
      }
    ]

    super('Database AI Agent', 'database management, data analysis, and system monitoring', databaseTools)
    this.databaseAgent = databaseAgent
  }

  buildSystemPrompt(context) {
    const basePrompt = super.buildSystemPrompt(context)
    
    return basePrompt + `

DATABASE MANAGEMENT KNOWLEDGE:
- You specialize in PostgreSQL/Supabase database operations and Prisma ORM
- Understand data integrity, performance optimization, and backup strategies
- Know about database migrations, schema management, and query optimization
- Be aware of data privacy and security best practices
- Understand relationships between Users, Orders, Sessions, and other entities

DATA ANALYSIS CAPABILITIES:
- Order analysis and revenue tracking
- User behavior and customer insights
- Performance monitoring and optimization
- Data integrity validation and auditing
- Backup and disaster recovery planning

DATABASE OPERATIONS:
- Schema management and migrations
- Performance monitoring and tuning
- Data backup and recovery
- User and order management
- System health monitoring

When users ask about:
- "connection" or "health" → use test_connection
- "orders" or "sales" → use list_orders or analyze_orders
- "users" or "customers" → use list_users
- "stats" or "counts" → use get_table_stats
- "schema" or "structure" → use get_schema_info
- "analyze" or "insights" → use analyze_orders
- "performance" → use performance_check
- "integrity" or "validation" → use data_integrity_check
- "backup" → use backup_data
- "migrate" → use run_migrations

Always prioritize data security and integrity in all operations.`
  }

  async getSystemContext() {
    try {
      const [connection, stats, schema] = await Promise.all([
        this.databaseAgent.runCommand('test-connection').catch(() => null),
        this.databaseAgent.runCommand('table-stats').catch(() => {}),
        this.databaseAgent.runCommand('schema-info').catch(() => null)
      ])

      return {
        database: {
          connected: connection?.connected || false,
          totalRecords: Object.values(stats).reduce((sum, count) => sum + count, 0),
          tables: Object.keys(stats).length,
          stats: stats,
          schema: schema
        },
        health: connection?.connected ? 'healthy' : 'disconnected',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return { error: 'Unable to fetch database context', timestamp: new Date().toISOString() }
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
  const agent = new DatabaseAIAgent()
  
  try {
    const result = await agent.processRequest(request)
    
    console.log('\n=== DATABASE AI AGENT RESULT ===')
    console.log(JSON.stringify(result, null, 2))
    
    if (result.humanMessage) {
      console.log('\n💬 AI Response:')
      console.log(result.humanMessage)
    }
    
  } catch (error) {
    console.error('❌ Database AI Agent error:', error.message)
    console.log('\n💡 Try: npm run database:ai "analyze orders" or "check performance"')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { DatabaseAIAgent }
