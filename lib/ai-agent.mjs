// lib/ai-agent.mjs
import OpenAI from 'openai'
import 'dotenv/config'

class AIAgent {
  constructor(name, specialization, tools = []) {
    this.name = name
    this.specialization = specialization
    this.tools = tools
    
    // Initialize OpenAI client
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not set in environment variables')
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    this.modelHeavy = process.env.OPENAI_MODEL_HEAVY || 'gpt-4o'
  }

  async think(userRequest, context = {}) {
    const systemPrompt = this.buildSystemPrompt(context)
    
    try {
      const response = await this.openai.chat.completions.create({
        model: this.shouldUseHeavyModel(userRequest) ? this.modelHeavy : this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userRequest }
        ],
        temperature: 0.1, // Low temperature for consistent, focused responses
        max_tokens: 2000
      })

      const aiResponse = response.choices[0]?.message?.content
      if (!aiResponse) {
        throw new Error('No response from AI model')
      }

      // Parse AI response to determine actions
      return this.parseResponse(aiResponse, userRequest)
      
    } catch (error) {
      console.error(`AI Agent ${this.name} error:`, error.message)
      return {
        success: false,
        error: error.message,
        fallback: await this.handleFallback(userRequest)
      }
    }
  }

  buildSystemPrompt(context) {
    return `You are ${this.name}, a specialized AI agent for ${this.specialization}.

Your role: Analyze user requests and determine the best course of action using available tools.

Available tools: ${this.tools.map(tool => `\n- ${tool.name}: ${tool.description}`).join('')}

Current system context:
${JSON.stringify(context, null, 2)}

Response format: Provide a JSON response with:
{
  "analysis": "Brief analysis of the user request",
  "action": "specific_action_to_take",
  "parameters": {"key": "value"},
  "confidence": 0.95,
  "reasoning": "Why this action is appropriate",
  "humanMessage": "User-friendly explanation"
}

Always respond with valid JSON. Be precise, helpful, and focus on the specific domain of ${this.specialization}.`
  }

  shouldUseHeavyModel(request) {
    // Use heavy model for complex analysis, reasoning, or multi-step operations
    const heavyModelTriggers = [
      'analyze', 'complex', 'workflow', 'strategy', 'optimize', 'recommend',
      'troubleshoot', 'debug', 'integrate', 'architecture', 'plan'
    ]
    
    return heavyModelTriggers.some(trigger => 
      request.toLowerCase().includes(trigger)
    )
  }

  parseResponse(aiResponse, originalRequest) {
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanResponse = aiResponse.trim()
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n/, '').replace(/\n```$/, '')
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/```[a-z]*\n/, '').replace(/\n```$/, '')
      }
      
      // Try to parse JSON response
      const parsed = JSON.parse(cleanResponse)
      
      return {
        success: true,
        analysis: parsed.analysis,
        action: parsed.action,
        parameters: parsed.parameters || {},
        confidence: parsed.confidence || 0.8,
        reasoning: parsed.reasoning,
        humanMessage: parsed.humanMessage,
        originalRequest,
        agent: this.name
      }
    } catch (error) {
      // If JSON parsing fails, try to extract action from text
      const action = this.extractActionFromText(aiResponse)
      
      return {
        success: true,
        analysis: 'Text-based response (non-JSON)',
        action: action || 'provide_information',
        parameters: { response: aiResponse },
        confidence: 0.6,
        reasoning: 'Fallback text parsing',
        humanMessage: aiResponse,
        originalRequest,
        agent: this.name
      }
    }
  }

  extractActionFromText(text) {
    // Extract common actions from text responses
    const actionPatterns = {
      'list': /list|show|display|get.*(?:products|orders|items)/i,
      'create': /create|add|make|new/i,
      'update': /update|modify|change|edit/i,
      'delete': /delete|remove|destroy/i,
      'sync': /sync|synchronize|provision/i,
      'analyze': /analyze|check|verify|test/i,
      'monitor': /monitor|watch|track|status/i
    }

    for (const [action, pattern] of Object.entries(actionPatterns)) {
      if (pattern.test(text)) {
        return action
      }
    }

    return 'provide_information'
  }

  async handleFallback(userRequest) {
    // Provide fallback functionality when AI fails
    const fallbackActions = {
      help: () => ({ message: `${this.name} agent available. Specializes in ${this.specialization}. Available tools: ${this.tools.map(t => t.name).join(', ')}` }),
      status: () => ({ message: `${this.name} agent is operational. AI integration active.` }),
      info: () => ({ 
        agent: this.name,
        specialization: this.specialization,
        tools: this.tools.length,
        aiModel: this.model
      })
    }

    // Simple keyword matching for fallback
    const keywords = userRequest.toLowerCase()
    if (keywords.includes('help')) return fallbackActions.help()
    if (keywords.includes('status')) return fallbackActions.status()
    if (keywords.includes('info')) return fallbackActions.info()

    return { message: `Unable to process request: "${userRequest}". Try 'help' for available commands.` }
  }

  async executeAction(actionResult) {
    if (!actionResult.success) {
      return actionResult
    }

    const { action, parameters } = actionResult
    
    // Find matching tool
    const tool = this.tools.find(t => t.name === action || t.aliases?.includes(action))
    
    if (!tool) {
      return {
        ...actionResult,
        success: false,
        error: `No tool found for action: ${action}`,
        availableActions: this.tools.map(t => t.name)
      }
    }

    try {
      // Execute the tool
      const result = await tool.execute(parameters)
      
      return {
        ...actionResult,
        toolResult: result,
        executionSuccess: true,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      return {
        ...actionResult,
        success: false,
        error: error.message,
        executionSuccess: false
      }
    }
  }

  async process(userRequest, context = {}) {
    console.log(`\n🤖 ${this.name} AI Agent processing: "${userRequest}"`)
    
    // Step 1: AI thinks and plans
    const thoughtResult = await this.think(userRequest, context)
    
    if (!thoughtResult.success) {
      console.log(`❌ AI thinking failed, using fallback`)
      return thoughtResult
    }

    console.log(`🧠 AI Analysis: ${thoughtResult.analysis}`)
    console.log(`🎯 Planned Action: ${thoughtResult.action}`)
    console.log(`📊 Confidence: ${(thoughtResult.confidence * 100).toFixed(1)}%`)

    // Step 2: Execute the planned action
    const executionResult = await this.executeAction(thoughtResult)
    
    if (executionResult.executionSuccess) {
      console.log(`✅ Action executed successfully`)
    } else {
      console.log(`❌ Action execution failed: ${executionResult.error}`)
    }

    return executionResult
  }
}

export { AIAgent }
