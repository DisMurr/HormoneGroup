// scripts/agent-ask.mjs
import 'dotenv/config'

const cmd = process.argv[2] || ''
const rest = process.argv.slice(3).join(' ')
const input = rest || cmd // keep old behavior

const url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const token = process.env.AGENT_ADMIN_TOKEN

if (!token) {
  console.error('AGENT_ADMIN_TOKEN missing')
  process.exit(1)
}

let message = input
if (cmd === 'provision') message = `Provision product ${rest}`
if (cmd === 'checkout')  message = `Create a checkout session for product ${rest}`
if (cmd === 'stripe') message = `Manage Stripe: ${rest}`
if (cmd === 'setup-stripe') message = `Setup Stripe environment and keys automatically`
if (cmd === 'sanity') message = `Manage Sanity: ${rest}`
if (cmd === 'setup-sanity') message = `Setup Sanity environment and configuration automatically`
if (cmd === 'database' || cmd === 'db') message = `Manage Database: ${rest}`
if (cmd === 'setup-database') message = `Setup Database environment and configuration automatically`

// Include admin credentials for automated key/token generation
const adminCredentials = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
  },
  sanity: {
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET,
    readToken: process.env.SANITY_READ_TOKEN,
    writeToken: process.env.SANITY_WRITE_TOKEN,
    apiVersion: process.env.SANITY_API_VERSION
  },
  database: {
    url: process.env.DATABASE_URL
  },
  nextAuth: {
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    modelHeavy: process.env.OPENAI_MODEL_HEAVY
  },
  provision: {
    secret: process.env.PROVISION_SECRET
  }
}

const res = await fetch(`${url}/api/agent`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ 
    input: message,
    adminCredentials: adminCredentials
  })
})
const json = await res.json()
console.log(JSON.stringify(json, null, 2))
