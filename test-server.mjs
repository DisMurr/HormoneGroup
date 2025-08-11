import 'dotenv/config'

console.log('Testing server connectivity...')

const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const secret = process.env.PROVISION_SECRET

console.log(`Server URL: ${base}`)
console.log(`Has secret: ${!!secret}`)

try {
  // Test basic connectivity
  console.log('\n1. Testing basic server connectivity...')
  const healthResponse = await fetch(`${base}/api/agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.AGENT_ADMIN_TOKEN}`
    },
    body: JSON.stringify({ input: 'health check' })
  })
  
  if (healthResponse.ok) {
    const healthData = await healthResponse.json()
    console.log('✅ Server is responding:', healthData)
  } else {
    console.log('❌ Server health check failed:', healthResponse.status, healthResponse.statusText)
  }

  // Test provision endpoint
  console.log('\n2. Testing provision endpoint...')
  const provisionResponse = await fetch(`${base}/api/admin/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`
    },
    body: JSON.stringify({ slug: 'complete-workflow-test-3' })
  })
  
  if (provisionResponse.ok) {
    const provisionData = await provisionResponse.json()
    console.log('✅ Provision endpoint works:', provisionData)
  } else {
    const errorText = await provisionResponse.text()
    console.log('❌ Provision endpoint failed:', provisionResponse.status, provisionResponse.statusText)
    console.log('Error details:', errorText)
  }

} catch (error) {
  console.error('❌ Connection error:', error.message)
}
