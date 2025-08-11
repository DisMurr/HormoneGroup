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

const res = await fetch(`${url}/api/agent`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ input: message })
})
const json = await res.json()
console.log(JSON.stringify(json, null, 2))
