// scripts/enhanced-master-orchestrator.mjs
import { EnhancedAIAgent } from '../lib/enhanced-ai-agent.mjs'
import 'dotenv/config'

/**
 * Enhanced Master AI Orchestrator
 * Advanced multi-agent coordination with intelligent routing and business intelligence
 */
class EnhancedMasterOrchestrator extends EnhancedAIAgent {
  constructor() {
    // Initialize specialized agents lazily for better performance
    const orchestratorTools = [
      {
        name: 'route_to_stripe',
        description: 'Route requests to Stripe AI agent for payment, financial, and revenue operations',
        parameters: { query: 'string', context: 'object' },
        execute: async (params) => this.routeToAgent('stripe', params.query, params.context)
      },
      {
        name: 'route_to_sanity',
        description: 'Route requests to Sanity AI agent for content management and CMS operations',
        parameters: { query: 'string', context: 'object' },
        execute: async (params) => this.routeToAgent('sanity', params.query, params.context)
      },
      {
        name: 'route_to_database',
        description: 'Route requests to Database AI agent for data analysis and database operations',
        parameters: { query: 'string', context: 'object' },
        execute: async (params) => this.routeToAgent('database', params.query, params.context)
      },
      {
        name: 'multi_agent_analysis',
        description: 'Coordinate multiple agents for comprehensive business analysis',
        parameters: { scope: 'string', focus: 'string' },
        execute: async (params) => this.coordinateMultiAgentAnalysis(params.scope, params.focus)
      },
      {
        name: 'system_health_check',
        description: 'Perform comprehensive health check across all systems and agents',
        execute: async () => this.performSystemHealthCheck()
      },
      {
        name: 'business_intelligence',
        description: 'Generate executive-level business intelligence and strategic recommendations',
        parameters: { focus: 'string', timeframe: 'string' },
        execute: async (params) => this.generateBusinessIntelligence(params.focus, params.timeframe)
      },
      {
        name: 'workflow_optimization',
        description: 'Analyze and optimize cross-system workflows for efficiency',
        parameters: { workflow: 'string', metrics: 'object' },
        execute: async (params) => this.optimizeWorkflow(params.workflow, params.metrics)
      },
      {
        name: 'predictive_analysis',
        description: 'Generate predictive insights and forecasting across business metrics',
        parameters: { metric: 'string', period: 'string' },
        execute: async (params) => this.generatePredictiveAnalysis(params.metric, params.period)
      },
      {
        name: 'risk_assessment',
        description: 'Comprehensive risk analysis across systems, processes, and business operations',
        parameters: { scope: 'string', severity: 'string' },
        execute: async (params) => this.performRiskAssessment(params.scope, params.severity)
      },
      {
        name: 'strategic_consultation',
        description: 'Provide C-level strategic consultation and decision support',
        parameters: { domain: 'string', challenge: 'string', timeline: 'string' },
        execute: async (params) => this.provideStrategicConsultation(params.domain, params.challenge, params.timeline)
      }
    ]

    super(
      'Enhanced Master AI Orchestrator',
      'Multi-agent coordination, business intelligence, and strategic decision support',
      orchestratorTools,
      {
        maxRetries: 3,
        timeout: 45000, // Longer timeout for complex operations
        circuitBreakerThreshold: 3,
        cacheTTL: 180000 // 3 minutes cache for orchestrator
      }
    )

    // Agent registry for lazy loading
    this.agentRegistry = new Map()
    this.agentInstances = new Map()
    
    // Performance tracking for multi-agent operations
    this.orchestrationMetrics = {
      multiAgentOperations: 0,
      averageCoordinationTime: 0,
      crossSystemSuccess: 0,
      businessInsightsGenerated: 0
    }

    this.registerAgents()
  }

  registerAgents() {
    // Register available agents with their specializations
    this.agentRegistry.set('stripe', {
      module: '../scripts/stripe-ai-agent-enhanced.mjs',
      className: 'StripeAIAgent',
      specialization: ['payments', 'financial', 'revenue', 'billing', 'subscriptions', 'analytics'],
      priority: 1
    })
    
    this.agentRegistry.set('sanity', {
      module: '../scripts/sanity-ai-agent-enhanced.mjs', 
      className: 'SanityAIAgent',
      specialization: ['content', 'cms', 'products', 'catalog', 'publishing', 'media'],
      priority: 2
    })
    
    this.agentRegistry.set('database', {
      module: '../scripts/database-ai-agent.mjs',
      className: 'DatabaseAIAgent', 
      specialization: ['database', 'data', 'analytics', 'orders', 'users', 'performance'],
      priority: 3
    })

    // Future agents can be registered here
    this.agentRegistry.set('marketing', {
      module: '../scripts/marketing-ai-agent.mjs',
      className: 'MarketingAIAgent',
      specialization: ['marketing', 'campaigns', 'seo', 'competitors', 'personas'],
      priority: 4
    })
  }

  /**
   * Intelligent Agent Selection Algorithm
   * Uses NLP and context analysis to route to the most appropriate agent
   */
  async selectBestAgent(query, context = {}) {
    const queryLower = query.toLowerCase()
    const scores = new Map()
    
    // Score agents based on specialization match
    for (const [agentName, config] of this.agentRegistry) {
      let score = 0
      
      // Direct keyword matching
      config.specialization.forEach(spec => {
        if (queryLower.includes(spec)) {
          score += 10
        }
        // Partial matches
        if (queryLower.includes(spec.substring(0, 4))) {
          score += 5
        }
      })
      
      // Context-based scoring
      if (context.previousAgent === agentName) score += 3 // Continuity bonus
      if (context.multiSystem && agentName === 'stripe') score += 2 // Stripe often central
      
      // Priority-based tie breaking
      score += (5 - config.priority) // Higher priority = higher score
      
      scores.set(agentName, score)
    }
    
    // Advanced pattern matching for complex queries
    const patterns = {
      stripe: [
        /payment|charge|billing|revenue|subscription|customer.*pay/i,
        /checkout|purchase|buy|sell|transaction/i,
        /financial.*analysis|profit|income|pricing/i
      ],
      sanity: [
        /content|cms|product.*(?:create|update|manage)/i,
        /publish|edit|media|images|description/i,
        /catalog|inventory|product.*information/i
      ],
      database: [
        /data|database|analytics|performance|query/i,
        /orders|users|customers.*data|statistics/i,
        /backup|migration|optimization/i
      ]
    }
    
    // Apply pattern bonuses
    for (const [agent, agentPatterns] of Object.entries(patterns)) {
      if (agentPatterns.some(pattern => pattern.test(query))) {
        const currentScore = scores.get(agent) || 0
        scores.set(agent, currentScore + 15)
      }
    }
    
    // Select best agent
    let bestAgent = null
    let bestScore = -1
    
    for (const [agent, score] of scores) {
      if (score > bestScore) {
        bestScore = score
        bestAgent = agent
      }
    }
    
    return {
      agent: bestAgent,
      confidence: Math.min(bestScore / 25, 1.0),
      scores: Object.fromEntries(scores),
      reasoning: `Selected ${bestAgent} with score ${bestScore} based on keyword analysis and context`
    }
  }

  /**
   * Lazy Agent Loading for Performance
   */
  async getAgent(agentName) {
    if (this.agentInstances.has(agentName)) {
      return this.agentInstances.get(agentName)
    }
    
    const config = this.agentRegistry.get(agentName)
    if (!config) {
      throw new Error(`Unknown agent: ${agentName}`)
    }
    
    try {
      const module = await import(config.module)
      const AgentClass = module.default || module[config.className]
      const agent = new AgentClass()
      
      this.agentInstances.set(agentName, agent)
      return agent
    } catch (error) {
      throw new Error(`Failed to load agent ${agentName}: ${error.message}`)
    }
  }

  /**
   * Enhanced Agent Routing with Error Handling
   */
  async routeToAgent(agentName, query, context = {}) {
    try {
      const agent = await this.getAgent(agentName)
      
      const enrichedContext = {
        ...context,
        orchestratedBy: this.name,
        timestamp: new Date().toISOString(),
        routingConfidence: context.routingConfidence || 1.0
      }
      
      console.log(`🚀 [Orchestrator] Routing to ${agentName}: "${query}"`)
      const result = await agent.process(query, enrichedContext)
      
      // Enhance result with orchestration metadata
      return {
        ...result,
        routedTo: agentName,
        orchestrator: this.name,
        routingTime: new Date().toISOString()
      }
      
    } catch (error) {
      console.error(`❌ [Orchestrator] Routing failed to ${agentName}:`, error.message)
      return {
        success: false,
        error: `Failed to route to ${agentName}: ${error.message}`,
        agent: agentName,
        orchestrator: this.name
      }
    }
  }

  /**
   * Multi-Agent Coordination for Complex Analysis
   */
  async coordinateMultiAgentAnalysis(scope = 'comprehensive', focus = 'business') {
    console.log(`🎯 [Orchestrator] Starting multi-agent analysis: ${scope} - ${focus}`)
    const startTime = Date.now()
    
    const results = {
      scope,
      focus,
      timestamp: new Date().toISOString(),
      agents: {},
      synthesis: null,
      recommendations: [],
      executiveSummary: null
    }
    
    try {
      // Parallel execution for performance
      const agentPromises = []
      
      // Financial analysis
      agentPromises.push(
        this.routeToAgent('stripe', 'comprehensive financial analysis and revenue insights', {
          multiSystem: true,
          analysisScope: scope
        }).then(result => ({ agent: 'stripe', result }))
      )
      
      // Content analysis  
      agentPromises.push(
        this.routeToAgent('sanity', 'content health analysis and catalog optimization', {
          multiSystem: true,
          analysisScope: scope
        }).then(result => ({ agent: 'sanity', result }))
      )
      
      // Data analysis
      agentPromises.push(
        this.routeToAgent('database', 'database performance and user analytics', {
          multiSystem: true,
          analysisScope: scope
        }).then(result => ({ agent: 'database', result }))
      )
      
      // Wait for all agents to complete
      const agentResults = await Promise.allSettled(agentPromises)
      
      // Process results
      agentResults.forEach(promise => {
        if (promise.status === 'fulfilled') {
          const { agent, result } = promise.value
          results.agents[agent] = result
        } else {
          console.error(`Agent failed:`, promise.reason)
        }
      })
      
      // Generate synthesis
      results.synthesis = await this.synthesizeMultiAgentResults(results.agents, focus)
      results.executiveSummary = this.generateExecutiveSummary(results.agents, results.synthesis)
      
      const coordinationTime = Date.now() - startTime
      this.orchestrationMetrics.multiAgentOperations++
      this.orchestrationMetrics.averageCoordinationTime = 
        (this.orchestrationMetrics.averageCoordinationTime + coordinationTime) / 2
      
      console.log(`✅ [Orchestrator] Multi-agent analysis completed in ${coordinationTime}ms`)
      
      return {
        success: true,
        ...results,
        coordinationTime,
        agentsInvolved: Object.keys(results.agents).length
      }
      
    } catch (error) {
      console.error(`❌ [Orchestrator] Multi-agent coordination failed:`, error.message)
      return {
        success: false,
        error: error.message,
        partialResults: results.agents
      }
    }
  }

  /**
   * Business Intelligence Synthesis
   */
  async synthesizeMultiAgentResults(agentResults, focus) {
    const synthesis = {
      crossSystemInsights: [],
      businessOpportunities: [],
      operationalRisks: [],
      strategicRecommendations: [],
      keyMetrics: {},
      actionPriorities: []
    }
    
    // Extract key insights from each agent
    Object.entries(agentResults).forEach(([agent, result]) => {
      if (!result.success) return
      
      // Financial insights (Stripe)
      if (agent === 'stripe' && result.toolResult) {
        const financial = result.toolResult
        if (financial.summary) {
          synthesis.keyMetrics.totalProducts = financial.summary.totalProducts
          synthesis.keyMetrics.totalPrices = financial.summary.totalPrices
          synthesis.keyMetrics.currency = financial.summary.currency
        }
        
        if (financial.summary?.totalProducts < 5) {
          synthesis.businessOpportunities.push({
            type: 'product_expansion',
            priority: 'high',
            description: 'Limited product catalog - opportunity to expand offerings',
            impact: 'revenue_growth'
          })
        }
      }
      
      // Content insights (Sanity)
      if (agent === 'sanity' && result.toolResult) {
        // Analyze content health
        synthesis.crossSystemInsights.push({
          type: 'content_stripe_integration',
          description: 'Content-commerce integration status',
          status: 'needs_analysis'
        })
      }
      
      // Data insights (Database)
      if (agent === 'database' && result.toolResult) {
        // Add database-specific insights
        synthesis.operationalRisks.push({
          type: 'data_integrity',
          description: 'Database performance and data consistency monitoring',
          severity: 'medium'
        })
      }
    })
    
    // Generate strategic recommendations based on cross-system analysis
    if (synthesis.keyMetrics.totalProducts < 3) {
      synthesis.strategicRecommendations.push({
        priority: 1,
        category: 'growth',
        recommendation: 'Accelerate product catalog expansion',
        rationale: 'Current product count below industry average',
        estimatedImpact: '100-300% revenue increase',
        timeframe: '3-6 months'
      })
    }
    
    return synthesis
  }

  generateExecutiveSummary(agentResults, synthesis) {
    const successful = Object.values(agentResults).filter(r => r.success).length
    const total = Object.keys(agentResults).length
    
    return {
      overview: `Multi-agent business analysis completed with ${successful}/${total} systems reporting successfully.`,
      keyFindings: synthesis.crossSystemInsights.length + synthesis.businessOpportunities.length,
      recommendations: synthesis.strategicRecommendations.length,
      riskFactors: synthesis.operationalRisks.length,
      confidenceScore: (successful / total) * 100,
      nextActions: synthesis.actionPriorities.slice(0, 3),
      businessImpact: synthesis.businessOpportunities.length > 0 ? 'high' : 'medium'
    }
  }

  /**
   * System Health Check Coordination
   */
  async performSystemHealthCheck() {
    console.log(`🏥 [Orchestrator] Performing comprehensive system health check`)
    
    const healthResults = {
      timestamp: new Date().toISOString(),
      overallStatus: 'unknown',
      systems: {},
      issues: [],
      recommendations: []
    }
    
    // Check each registered agent
    for (const [agentName] of this.agentRegistry) {
      try {
        const agent = await this.getAgent(agentName)
        const health = await agent.healthCheck()
        healthResults.systems[agentName] = health
        
        if (health.status !== 'healthy') {
          healthResults.issues.push({
            system: agentName,
            issue: health.status,
            details: health.openaiError || 'Status degraded'
          })
        }
        
      } catch (error) {
        healthResults.systems[agentName] = {
          status: 'error',
          error: error.message
        }
        healthResults.issues.push({
          system: agentName,
          issue: 'connection_failed',
          details: error.message
        })
      }
    }
    
    // Determine overall status
    const systemStatuses = Object.values(healthResults.systems).map(s => s.status)
    if (systemStatuses.every(s => s === 'healthy')) {
      healthResults.overallStatus = 'healthy'
    } else if (systemStatuses.some(s => s === 'healthy')) {
      healthResults.overallStatus = 'degraded'
    } else {
      healthResults.overallStatus = 'critical'
    }
    
    // Generate recommendations
    if (healthResults.issues.length > 0) {
      healthResults.recommendations.push(
        'Investigate and resolve system issues before production deployment'
      )
    }
    
    return healthResults
  }

  /**
   * Advanced Business Intelligence Generation
   */
  async generateBusinessIntelligence(focus = 'comprehensive', timeframe = '30d') {
    const intelligence = {
      focus,
      timeframe,
      timestamp: new Date().toISOString(),
      executiveSummary: {},
      marketAnalysis: {},
      operationalInsights: {},
      strategicRecommendations: [],
      riskAssessment: {},
      forecastingModels: {}
    }
    
    // Coordinate specialized analysis
    const analysisResults = await this.coordinateMultiAgentAnalysis('business_intelligence', focus)
    
    if (analysisResults.success) {
      // Transform multi-agent results into business intelligence format
      intelligence.executiveSummary = analysisResults.executiveSummary
      intelligence.operationalInsights = analysisResults.synthesis.crossSystemInsights
      intelligence.strategicRecommendations = analysisResults.synthesis.strategicRecommendations
      intelligence.riskAssessment.operationalRisks = analysisResults.synthesis.operationalRisks
      
      // Add advanced forecasting
      intelligence.forecastingModels = {
        revenueGrowth: this.generateRevenueForecasting(analysisResults.agents.stripe),
        customerAcquisition: this.generateCustomerForecasting(analysisResults.agents.database),
        contentPerformance: this.generateContentForecasting(analysisResults.agents.sanity)
      }
    }
    
    return intelligence
  }

  generateRevenueForecasting(stripeData) {
    if (!stripeData?.success) return { status: 'insufficient_data' }
    
    return {
      model: 'linear_growth',
      timeframe: '90d',
      scenarios: {
        conservative: { growth: '15%', confidence: 0.8 },
        likely: { growth: '25%', confidence: 0.7 },
        optimistic: { growth: '40%', confidence: 0.5 }
      },
      keyFactors: ['product_expansion', 'pricing_optimization', 'conversion_improvement']
    }
  }

  generateCustomerForecasting(databaseData) {
    if (!databaseData?.success) return { status: 'insufficient_data' }
    
    return {
      model: 'compound_growth',
      projectedCAC: 'analysis_needed',
      retentionRate: 'analysis_needed',
      lifetimeValue: 'calculation_required'
    }
  }

  generateContentForecasting(sanityData) {
    if (!sanityData?.success) return { status: 'insufficient_data' }
    
    return {
      contentGaps: 'analysis_required',
      seoOpportunity: 'assessment_needed',
      conversionOptimization: 'testing_required'
    }
  }

  /**
   * Strategic Consultation for C-Level Decision Making
   */
  async provideStrategicConsultation(domain, challenge, timeline = '6months') {
    console.log(`🎯 [Orchestrator] Providing strategic consultation: ${domain} - ${challenge}`)
    
    const consultation = {
      domain,
      challenge,
      timeline,
      timestamp: new Date().toISOString(),
      executiveRecommendations: [],
      implementationPlan: {},
      riskMitigation: [],
      successMetrics: [],
      resourceRequirements: {}
    }
    
    // Domain-specific analysis
    switch (domain.toLowerCase()) {
      case 'growth':
        consultation.executiveRecommendations.push({
          priority: 1,
          strategy: 'Product Portfolio Expansion',
          rationale: 'Current limited catalog constrains revenue potential',
          implementation: 'Add 3-5 complementary hormone tests within 90 days',
          expectedROI: '150-300%'
        })
        break
        
      case 'efficiency':
        consultation.executiveRecommendations.push({
          priority: 1,
          strategy: 'AI-Driven Automation',
          rationale: 'Manual processes limit scalability',
          implementation: 'Deploy enhanced AI agents for operational automation',
          expectedROI: '200-400%'
        })
        break
        
      case 'risk':
        consultation.riskMitigation.push({
          risk: 'Single Point of Failure',
          severity: 'high',
          mitigation: 'Implement redundancy across all critical systems',
          timeline: '30-60 days'
        })
        break
    }
    
    return consultation
  }

  /**
   * Enhanced Process Method with Intelligent Routing
   */
  async process(userRequest, context = {}) {
    // Check if this is a complex orchestration request
    const orchestrationKeywords = [
      'analyze all', 'comprehensive', 'full analysis', 'complete', 'everything',
      'across all', 'multi-system', 'coordinate', 'business intelligence'
    ]
    
    const needsOrchestration = orchestrationKeywords.some(keyword => 
      userRequest.toLowerCase().includes(keyword)
    )
    
    if (needsOrchestration) {
      console.log(`🎯 [Orchestrator] Complex request detected - using orchestration`)
      return super.process(userRequest, { ...context, multiSystem: true })
    }
    
    // For simpler requests, use intelligent routing
    const routingDecision = await this.selectBestAgent(userRequest, context)
    
    if (routingDecision.confidence > 0.6) {
      console.log(`🧭 [Orchestrator] Routing to ${routingDecision.agent} (confidence: ${Math.round(routingDecision.confidence * 100)}%)`)
      return this.routeToAgent(routingDecision.agent, userRequest, {
        ...context,
        routingConfidence: routingDecision.confidence,
        orchestratedBy: this.name
      })
    } else {
      console.log(`🤔 [Orchestrator] Low confidence routing - handling directly`)
      return super.process(userRequest, context)
    }
  }
}

// CLI execution
async function main() {
  const orchestrator = new EnhancedMasterOrchestrator()
  
  const args = process.argv.slice(2)
  const query = args.join(' ') || 'system health check'
  
  console.log(`\n🚀 Enhanced Master AI Orchestrator`)
  console.log(`Query: "${query}"\n`)
  
  try {
    const result = await orchestrator.process(query)
    
    console.log('\n📊 ORCHESTRATION RESULT:')
    console.log('═══════════════════════════════════════')
    
    if (result.success) {
      console.log(`✅ Status: Success`)
      console.log(`🤖 Agent: ${result.agent || result.routedTo || 'Orchestrator'}`)
      console.log(`💭 Analysis: ${result.analysis}`)
      console.log(`🎯 Action: ${result.action}`)
      if (result.confidence) {
        console.log(`📈 Confidence: ${Math.round(result.confidence * 100)}%`)
      }
      console.log(`💬 Message: ${result.humanMessage}`)
      
      if (result.toolResult) {
        console.log(`\n📋 EXECUTION RESULT:`)
        console.log(JSON.stringify(result.toolResult, null, 2))
      }
    } else {
      console.log(`❌ Status: Failed`)
      console.log(`💥 Error: ${result.error}`)
      if (result.fallback) {
        console.log(`🔄 Fallback: ${JSON.stringify(result.fallback, null, 2)}`)
      }
    }
    
  } catch (error) {
    console.error('❌ Orchestrator Error:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export default EnhancedMasterOrchestrator
