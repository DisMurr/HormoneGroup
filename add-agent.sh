# --- START: add-agent.sh ---
set -euo pipefail

echo "⏳ Installing OpenAI SDK…"
npm i openai

echo "⏳ Scaffolding agent files…"
mkdir -p lib/agent app/api/agent scripts

# lib/agent/openai.ts
cat > lib/agent/openai.ts <<'TS'
import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠ OPENAI_API_KEY not set. The agent will fail until you add it to .env')
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
TS

# lib/agent/tools.ts
cat > lib/agent/tools.ts <<'TS'
import { sanityClient, tokenClient } from '@/lib/sanity/client'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

/**
 * Tool specs (Chat Completions style)
 * The model sees these JSON Schemas and will call them with args.
 */
export const toolSpecs = [
  {
    type: 'function',
    function: {
      name: 'provisionProduct',
      description:
        'Create/ensure Stripe Product + Price for a Sanity product and write back IDs to Sanity. Accepts slug or _id.',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Sanity product slug' },
          id: { type: 'string', description: 'Sanity _id of the product' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createCheckout',
      description:
        'Create a Stripe Checkout Session for a given priceId and return a URL. Uses your existing /api/checkout/create.',
      parameters: {
        type: 'object',
        properties: {
          priceId: { type: 'string' },
          quantity: { type: 'integer', default: 1 },
          successPath: { type: 'string', default: '/thanks' },
          cancelPath: { type: 'string', default: '/' }
        },
        required: ['priceId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'sanityFetchProduct',
      description:
        'Fetch a product by slug or _id from Sanity (returns price fields, title, etc).',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          id: { type: 'string' }
        }
      }
    }
  }
] as const

export type ToolResult = Record<string, unknown>

export const toolHandlers: Record<
  string,
  (args: any) => Promise<ToolResult>
> = {
  async provisionProduct({ slug, id }) {
    if (!process.env.PROVISION_SECRET) {
      throw new Error('PROVISION_SECRET not set')
    }
    const res = await fetch(`${BASE}/api/admin/provision`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.PROVISION_SECRET}`
      },
      body: JSON.stringify({ slug, id })
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`provision failed: ${res.status} ${JSON.stringify(json)}`)

    // Best effort: read the price back from Sanity after provisioning
    const q = `*[_type=="product" && ${
      id ? `_id==$id` : `slug.current==$slug`
    }][0]{_id,title,"slug":slug.current,stripePriceIdOneTime,priceEUR}`
    const doc = await sanityClient.fetch(q, { slug, id })
    return { ok: true, result: json, sanity: doc }
  },

  async createCheckout({ priceId, quantity = 1, successPath = '/thanks', cancelPath = '/' }) {
    const res = await fetch(`${BASE}/api/checkout/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priceId, quantity, successPath, cancelPath })
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`checkout failed: ${res.status} ${JSON.stringify(json)}`)
    return { ok: true, url: json.url }
  },

  async sanityFetchProduct({ slug, id }) {
    const q = `*[_type=="product" && ${id ? `_id==$id` : `slug.current==$slug`}][0]{
      _id,title,"slug":slug.current,priceEUR,turnaround,sampleType,markers,
      whyItMatters,symptoms,whatYouGet,stripePriceIdOneTime,stripePriceIdSubscription
    }`
    const doc = await sanityClient.fetch(q, { slug, id })
    return { ok: true, product: doc }
  }
}
TS

# lib/agent/runAgent.ts
cat > lib/agent/runAgent.ts <<'TS'
import { openai } from './openai'
import { toolHandlers, toolSpecs } from './tools'

type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }

/** A tiny loop that lets the model call your tools until it has a final answer. */
export async function runAgent(input: string, thread: Msg[] = [], system?: string) {
  const messages: any[] = [
    { role: 'system', content: system || defaultSystem },
    ...thread,
    { role: 'user', content: input }
  ]

  while (true) {
    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      tools: toolSpecs as any,
      tool_choice: 'auto'
    })

    const choice = resp.choices[0]
    const msg = choice.message

    // If the model wants to call tools:
    if (msg.tool_calls && msg.tool_calls.length) {
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls })

      for (const call of msg.tool_calls) {
        const name = call.function.name
        const args = safeJson(call.function.arguments)
        const fn = toolHandlers[name]
        let result: any
        try {
          result = fn ? await fn(args) : { error: `Unknown tool: ${name}` }
        } catch (e: any) {
          result = { error: e?.message || 'Tool threw' }
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result)
        })
      }
      continue
    }

    // Final answer
    return { final: msg, messages }
  }
}

const defaultSystem = `You are the HormoneGroup Ops Agent.
- You can provision Stripe Products/Prices for Sanity products, create Checkout Sessions, and read/patch Sanity.
- Prefer one clear action at a time, then return concise results (IDs, URLs).`

function safeJson(raw?: string) {
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
TS

# app/api/agent/route.ts
cat > app/api/agent/route.ts <<'TS'
import { NextRequest, NextResponse } from 'next/server'
import { runAgent } from '@/lib/agent/runAgent'

export const dynamic = 'force-dynamic' // we call external APIs

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth
  if (!process.env.AGENT_ADMIN_TOKEN || token !== process.env.AGENT_ADMIN_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { input, thread, system } = await req.json().catch(() => ({}))
  if (!input) return NextResponse.json({ error: 'Missing input' }, { status: 400 })

  try {
    const { final, messages } = await runAgent(input, thread, system)
    return NextResponse.json({
      reply: final?.content ?? '',
      tool_calls: final?.tool_calls ?? [],
      messages
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Agent failed' }, { status: 500 })
  }
}
TS

# scripts/agent-ask.mjs
cat > scripts/agent-ask.mjs <<'JS'
import 'dotenv/config'

const input = process.argv.slice(2).join(' ') || 'Provision the product by slug "testosterone-check", then give me a checkout URL.'
const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const res = await fetch(`${base}/api/agent`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${process.env.AGENT_ADMIN_TOKEN || ''}`
  },
  body: JSON.stringify({ input })
})
const json = await res.json()
console.log(JSON.stringify(json, null, 2))
JS

echo "⏳ Adding npm script…"
npm pkg set scripts."agent:ask"="node -r dotenv/config scripts/agent-ask.mjs"

echo "⏳ Appending env hints…"
awk 'BEGIN{p=1} /# --- AGENT START ---/{p=0} {if(p) print} END{}' .env.example > .env.example.tmp 2>/dev/null || true
mv -f .env.example.tmp .env.example 2>/dev/null || true
cat >> .env.example <<'ENV'

# --- AGENT START ---
# OpenAI for the agent
OPENAI_API_KEY=sk-XXX
OPENAI_MODEL=gpt-4o-mini

# Secure the /api/agent endpoint
AGENT_ADMIN_TOKEN=some-long-random-token

# Already used by your provision route:
PROVISION_SECRET=your-provision-shared-secret

# Public site origin for callbacks to your own routes
NEXT_PUBLIC_SITE_URL=http://localhost:3000
# --- AGENT END ---
ENV

echo "✅ Done. Set OPENAI_API_KEY + AGENT_ADMIN_TOKEN in your .env, then:"
echo "   npm run dev"
echo "   npm run agent:ask -- \"Provision product testosterone-check and give me the checkout URL\""
# --- END: add-agent.sh ---
