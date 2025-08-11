import 'dotenv/config'

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: npm run provision <slug|sanityId>')
    process.exit(1)
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const secret = process.env.PROVISION_SECRET
  if (!secret) {
    console.error('Missing PROVISION_SECRET in .env')
    process.exit(1)
  }

  // Heuristic: sanity ids often contain dashes; slug could too, but allow explicit prefix prod-
  const isId = /^[a-z0-9]+[-][a-z0-9-]+$/i.test(arg) || arg.startsWith('prod-')
  const payload = isId ? { id: arg } : { slug: arg }

  const res = await fetch(`${base}/api/admin/provision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  console.log(text)
  process.exit(res.ok ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
