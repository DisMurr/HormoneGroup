// lib/enhanced-ai-agent.mjs
import OpenAI from 'openai'
import 'dotenv/config'

/**
 * Enhanced AI Agent Base Class
 * Implements advanced engineering patterns for reliable, scalable AI agents
 */
class EnhancedAIAgent {
  constructor(name, specialization, tools = [], config = {}) {
    this.name = name
    this.specialization = specialization
    this.tools = new Map(tools.map(tool => [tool.name, tool]))
    this.config = {
      maxRetries: 3,
      timeout: 30000,
      circuitBreakerThreshold: 5,
      cacheTTL: 300000, // 5 minutes
      ...config
    }
    
    // Circuit breaker pattern
    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      state: 'closed' // closed, open, half-open
    }
    
    // Response cache for performance
    this.cache = new Map()
    
    // Performance metrics
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastError: null
    }
    
    this.initializeOpenAI()
  }

  initializeOpenAI() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(`[${this.name}] OPENAI_API_KEY not set in environment variables`)
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: this.config.timeout
    })
    
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    this.modelHeavy = process.env.OPENAI_MODEL_HEAVY || 'gpt-4o'
  }

  /**
   * Circuit Breaker Pattern Implementation
   * Prevents cascading failures and provides resilience
   */
  canExecute() {
    const now = Date.now()
    
    switch (this.circuitBreaker.state) {
      case 'open':
        // Check if we should try again (half-open state)
        if (now - this.circuitBreaker.lastFailure > 60000) { // 1 minute
          this.circuitBreaker.state = 'half-open'
          return true
        }
        return false
        
      case 'half-open':
        return true
        
      case 'closed':
      default:
        return true
    }
  }

  recordSuccess() {
    this.circuitBreaker.failures = 0
    this.circuitBreaker.state = 'closed'
    this.metrics.successCount++
  }

  recordFailure() {
    this.circuitBreaker.failures++
    this.circuitBreaker.lastFailure = Date.now()
    this.metrics.errorCount++
    
    if (this.circuitBreaker.failures >= this.config.circuitBreakerThreshold) {
      this.circuitBreaker.state = 'open'
      console.warn(`[${this.name}] Circuit breaker OPEN - too many failures`)
    }
  }

  /**
   * Intelligent Model Selection
   * Uses advanced heuristics to choose the optimal model
   */
  selectModel(request, context = {}) {
    const complexity = this.assessComplexity(request, context)
    const urgency = this.assessUrgency(request)
    const resourceAvailability = this.checkResourceAvailability()
    
    // Decision matrix for model selection
    if (complexity > 0.7 && !urgency && resourceAvailability) {
      return this.modelHeavy
    }
    
    if (complexity > 0.8) {
      return this.modelHeavy // Force heavy model for very complex tasks
    }
    
    return this.model
  }

  assessComplexity(request, context) {
    const complexityIndicators = [
      // Multi-step operations
      /analyze.*and.*(?:recommend|optimize|create|update)/i,
      /(?:create|setup|configure).*(?:workflow|integration|automation)/i,
      
      // Cross-system operations
      /sync.*(?:between|from.*to|across)/i,
      /coordinate.*(?:multiple|several|all)/i,
      
      // Strategic analysis
      /strategy|strategic|planning|forecast|predict/i,
      /optimization|efficiency|performance.*analysis/i,
      
      // Troubleshooting
      /debug|troubleshoot|fix.*issue|resolve.*problem/i,
      /error.*analysis|failure.*investigation/i
    ]
    
    let score = 0.2 // Base complexity
    
    complexityIndicators.forEach(pattern => {
      if (pattern.test(request)) score += 0.15
    })
    
    // Context complexity
    if (Object.keys(context).length > 3) score += 0.1
    if (context.multiSystem) score += 0.2
    if (context.criticalOperation) score += 0.15
    
    return Math.min(score, 1.0)
  }

  assessUrgency(request) {
    const urgencyIndicators = /urgent|emergency|critical|asap|immediately|now/i
    return urgencyIndicators.test(request)
  }

  checkResourceAvailability() {
    // Simple heuristic - could be enhanced with actual resource monitoring
    return this.metrics.requestCount % 10 !== 9 // Allow heavy model 90% of the time
  }

  /**
   * Caching Layer for Performance
   */
  getCacheKey(request, context) {
    const contextKey = JSON.stringify(context, Object.keys(context).sort())
    return `${this.name}:${Buffer.from(request + contextKey).toString('base64')}`
  }

  getCachedResponse(key) {
    const cached = this.cache.get(key)
    if (!cached) return null
    
    if (Date.now() - cached.timestamp > this.config.cacheTTL) {
      this.cache.delete(key)
      return null
    }
    
    return cached.data
  }

  setCachedResponse(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
    
    // Simple cache cleanup - keep only last 100 entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
  }

  /**
   * Enhanced System Prompt with Context Awareness
   */
  buildSystemPrompt(context) {
    const basePrompt = `You are ${this.name}, an advanced AI agent specializing in ${this.specialization}.

CORE IDENTITY:
- Expert-level knowledge in ${this.specialization}
- Autonomous decision-making capabilities
- Business intelligence and strategic thinking
- Error prevention and risk assessment

AVAILABLE TOOLS:
${Array.from(this.tools.values()).map(tool => 
  `- ${tool.name}: ${tool.description}${tool.parameters ? ` (params: ${JSON.stringify(tool.parameters)})` : ''}`
).join('\n')}

CURRENT CONTEXT:
${JSON.stringify(context, null, 2)}

SYSTEM METRICS:
- Success Rate: ${this.getSuccessRate()}%
- Total Requests: ${this.metrics.requestCount}
- Circuit Breaker: ${this.circuitBreaker.state}

RESPONSE REQUIREMENTS:
1. Always respond with valid JSON in this exact format:
{
  "analysis": "Detailed analysis of the request and context",
  "strategy": "High-level approach and reasoning",
  "action": "specific_tool_name_to_execute",
  "parameters": {"key": "value"},
  "confidence": 0.95,
  "reasoning": "Why this approach is optimal",
  "riskAssessment": "Potential risks and mitigation strategies",
  "businessImpact": "Expected business outcomes",
  "humanMessage": "Clear, executive-level explanation for humans"
}

2. Consider business implications and strategic value
3. Assess risks and provide mitigation strategies
4. Think several steps ahead and consider dependencies
5. Prioritize reliability and user experience

OPERATIONAL GUIDELINES:
- Be proactive in identifying potential issues
- Suggest optimizations and improvements
- Provide clear, actionable recommendations
- Consider long-term strategic implications
- Maintain high confidence through careful analysis`

    // Add context-specific guidance
    if (context.criticalOperation) {
      return basePrompt + '\n\nCRITICAL OPERATION: This request requires extra caution and validation.'
    }
    
    if (context.multiSystem) {
      return basePrompt + '\n\nMULTI-SYSTEM OPERATION: Consider cross-system dependencies and data consistency.'
    }
    
    return basePrompt
  }

  getSuccessRate() {
    if (this.metrics.requestCount === 0) return 100
    return Math.round((this.metrics.successCount / this.metrics.requestCount) * 100)
  }

  /**
   * Advanced Response Processing with Validation
   */
  async processResponse(aiResponse, request, context) {
    try {
      const cleanResponse = this.cleanResponse(aiResponse)
      const parsed = JSON.parse(cleanResponse)
      
      // Validate response structure
      this.validateResponse(parsed)
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        model: this.selectModel(request, context),
        agent: this.name,
        ...parsed,
        originalRequest: request,
        context
      }
    } catch (error) {
      // Intelligent fallback parsing
      return this.handleParsingFallback(aiResponse, request, error)
    }
  }

  validateResponse(parsed) {
    const required = ['analysis', 'action', 'confidence', 'humanMessage']
    const missing = required.filter(field => !(field in parsed))
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }
    
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
      throw new Error('Confidence must be a number between 0 and 1')
    }
    
    if (!this.tools.has(parsed.action)) {
      throw new Error(`Unknown action: ${parsed.action}. Available: ${Array.from(this.tools.keys()).join(', ')}`)
    }
  }

  cleanResponse(response) {
    return response
      .trim()
      .replace(/^```(?:json)?\s*/, '')
      .replace(/\s*```$/, '')
      .replace(/^`(.+)`$/, '$1')
  }

  handleParsingFallback(response, request, error) {
    console.warn(`[${this.name}] JSON parsing failed, using fallback:`, error.message)
    
    // Attempt to extract action using NLP patterns
    const extractedAction = this.extractActionFromText(response + ' ' + request)
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      agent: this.name,
      analysis: 'Fallback parsing - response format was invalid',
      strategy: 'Using text analysis for action extraction',
      action: extractedAction,
      parameters: { fallbackResponse: response },
      confidence: 0.6,
      reasoning: 'Extracted from text analysis due to parsing failure',
      riskAssessment: 'Lower confidence due to parsing issues',
      businessImpact: 'May require manual verification',
      humanMessage: response,
      originalRequest: request,
      fallback: true,
      parseError: error.message
    }
  }

  extractActionFromText(text) {
    const actionMappings = [
      { patterns: [/list|show|display|get/i], action: 'list_items' },
      { patterns: [/create|add|make|new/i], action: 'create_item' },
      { patterns: [/update|modify|change|edit/i], action: 'update_item' },
      { patterns: [/delete|remove|destroy/i], action: 'delete_item' },
      { patterns: [/analyze|check|verify|examine/i], action: 'analyze_system' },
      { patterns: [/sync|synchronize|provision/i], action: 'sync_data' },
      { patterns: [/status|health|monitor/i], action: 'check_status' }
    ]
    
    for (const mapping of actionMappings) {
      if (mapping.patterns.some(pattern => pattern.test(text))) {
        // Find the closest matching tool
        const availableActions = Array.from(this.tools.keys())
        const closestAction = availableActions.find(action => 
          action.includes(mapping.action.split('_')[0]) || 
          mapping.action.includes(action.split('_')[0])
        )
        return closestAction || availableActions[0]
      }
    }
    
    return Array.from(this.tools.keys())[0] || 'help'
  }

  /**
   * Retry Logic with Exponential Backoff
   */
  async executeWithRetry(operation, maxRetries = null) {
    const retries = maxRetries || this.config.maxRetries
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await operation()
        this.recordSuccess()
        return result
      } catch (error) {
        this.metrics.lastError = error.message
        
        if (attempt === retries) {
          this.recordFailure()
          throw error
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) + Math.random() * 1000
        console.warn(`[${this.name}] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms:`, error.message)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Main Processing Method with Enhanced Error Handling
   */
  async process(userRequest, context = {}) {
    const startTime = Date.now()
    this.metrics.requestCount++
    
    console.log(`\n🤖 [${this.name}] Enhanced AI Agent processing: "${userRequest}"`)
    
    // Circuit breaker check
    if (!this.canExecute()) {
      return {
        success: false,
        error: 'Circuit breaker is OPEN - service temporarily unavailable',
        agent: this.name,
        circuitBreakerState: this.circuitBreaker.state,
        humanMessage: 'Service is temporarily unavailable. Please try again later.'
      }
    }
    
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(userRequest, context)
      const cachedResult = this.getCachedResponse(cacheKey)
      
      if (cachedResult) {
        console.log(`📋 [${this.name}] Cache hit - returning cached response`)
        return { ...cachedResult, cached: true }
      }
      
      // Process with retry logic
      const result = await this.executeWithRetry(async () => {
        // AI reasoning
        const model = this.selectModel(userRequest, context)
        console.log(`🧠 [${this.name}] Using model: ${model}`)
        
        const completion = await this.openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(context) },
            { role: 'user', content: userRequest }
          ],
          temperature: 0.1,
          max_tokens: 3000
        })
        
        const aiResponse = completion.choices[0]?.message?.content
        if (!aiResponse) throw new Error('No response from AI model')
        
        return this.processResponse(aiResponse, userRequest, context)
      })
      
      // Execute the planned action
      if (result.success && result.action) {
        const executionResult = await this.executeAction(result)
        const finalResult = { ...result, ...executionResult }
        
        // Cache successful results
        if (finalResult.executionSuccess && !context.noCache) {
          this.setCachedResponse(cacheKey, finalResult)
        }
        
        // Update metrics
        const responseTime = Date.now() - startTime
        this.updateMetrics(responseTime, finalResult.success)
        
        return finalResult
      }
      
      return result
      
    } catch (error) {
      this.recordFailure()
      console.error(`❌ [${this.name}] Processing failed:`, error.message)
      
      return {
        success: false,
        error: error.message,
        agent: this.name,
        timestamp: new Date().toISOString(),
        fallback: await this.handleEmergencyFallback(userRequest, error),
        humanMessage: `I encountered an error processing your request: ${error.message}. Please try again or rephrase your request.`
      }
    }
  }

  updateMetrics(responseTime, success) {
    this.metrics.averageResponseTime = Math.round(
      (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) / 
      this.metrics.requestCount
    )
  }

  async executeAction(actionResult) {
    const { action, parameters = {} } = actionResult
    const tool = this.tools.get(action)
    
    if (!tool) {
      return {
        executionSuccess: false,
        error: `Tool not found: ${action}`,
        availableTools: Array.from(this.tools.keys())
      }
    }
    
    try {
      console.log(`⚡ [${this.name}] Executing: ${action}`)
      const startTime = Date.now()
      
      const result = await tool.execute(parameters, {
        agent: this.name,
        context: actionResult.context
      })
      
      const executionTime = Date.now() - startTime
      console.log(`✅ [${this.name}] Execution completed in ${executionTime}ms`)
      
      return {
        executionSuccess: true,
        executionTime,
        toolResult: result,
        tool: action
      }
    } catch (error) {
      console.error(`❌ [${this.name}] Tool execution failed:`, error.message)
      return {
        executionSuccess: false,
        error: error.message,
        tool: action
      }
    }
  }

  async handleEmergencyFallback(request, error) {
    // Provide basic functionality when everything else fails
    const fallbacks = {
      help: `I'm ${this.name}, specialized in ${this.specialization}. Available tools: ${Array.from(this.tools.keys()).join(', ')}`,
      status: `Agent operational but encountered error: ${error.message}`,
      info: {
        agent: this.name,
        specialization: this.specialization,
        toolCount: this.tools.size,
        metrics: this.metrics
      }
    }
    
    const requestLower = request.toLowerCase()
    if (requestLower.includes('help')) return { message: fallbacks.help }
    if (requestLower.includes('status')) return { message: fallbacks.status }
    if (requestLower.includes('info')) return fallbacks.info
    
    return { message: 'Emergency fallback: Basic agent information available. Try "help" for commands.' }
  }

  /**
   * Health Check and Diagnostics
   */
  async healthCheck() {
    const health = {
      agent: this.name,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      circuitBreaker: this.circuitBreaker,
      toolCount: this.tools.size,
      cacheSize: this.cache.size
    }
    
    // Test OpenAI connectivity
    try {
      await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Health check' }],
        max_tokens: 10
      })
      health.openaiConnectivity = 'operational'
    } catch (error) {
      health.openaiConnectivity = 'failed'
      health.status = 'degraded'
      health.openaiError = error.message
    }
    
    return health
  }

  /**
   * Performance and Usage Statistics
   */
  getStatistics() {
    return {
      agent: this.name,
      specialization: this.specialization,
      uptime: Date.now() - (this.startTime || Date.now()),
      metrics: this.metrics,
      successRate: this.getSuccessRate(),
      averageResponseTime: this.metrics.averageResponseTime,
      circuitBreakerState: this.circuitBreaker.state,
      cacheHitRate: this.calculateCacheHitRate(),
      toolsAvailable: Array.from(this.tools.keys()),
      lastError: this.metrics.lastError
    }
  }

  calculateCacheHitRate() {
    // This is a simplified calculation - in production, you'd track cache hits vs misses
    return this.cache.size > 0 ? Math.min(this.cache.size / this.metrics.requestCount * 100, 100) : 0
  }
}

export { EnhancedAIAgent }
