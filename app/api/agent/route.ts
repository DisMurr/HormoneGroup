// app/api/agent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from 'next-sanity'
import { PrismaClient } from '@prisma/client'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status })
}

type ProvisionResult = {
  ok?: boolean
  slug?: string
  sanityId?: string
  stripeProductId?: string
  stripePriceIdOneTime?: string
  priceId?: string
  [k: string]: any
}

async function provisionProduct({
  slug,
  id,
}: {
  slug?: string
  id?: string
}): Promise<ProvisionResult> {
  if (!process.env.PROVISION_SECRET) {
    return { ok: false, error: 'PROVISION_SECRET is not set in env' }
  }
  const res = await fetch(`${BASE}/api/admin/provision`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.PROVISION_SECRET}`,
    },
    body: JSON.stringify({ slug, id }),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as ProvisionResult
  if (!res.ok) {
    return { ok: false, error: json?.error || `Provision failed ${res.status}` }
  }
  return { ok: true, ...json }
}

async function createCheckout({
  priceId,
  successPath = '/thanks',
  cancelPath = '/tests',
}: {
  priceId: string
  successPath?: string
  cancelPath?: string
}): Promise<{ ok: boolean; url?: string; [k: string]: any }> {
  const res = await fetch(`${BASE}/api/checkout/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ priceId, successPath, cancelPath }),
    cache: 'no-store',
  })
  const json = await res.json().catch(async () => ({ error: await res.text().catch(() => '') }))
  if (!res.ok) {
    return { ok: false, error: json?.error || `Checkout failed ${res.status}` }
  }
  return { ok: true, ...json }
}

/** very small helper to pull slug/id from free text */
function extractTargets(input: string) {
  const id = input.match(/\b(?:_id|id)\s*[:=]\s*([a-z0-9][\w-]+)/i)?.[1]
  const fromProductPhrase = input.match(/product\s+([a-z0-9][a-z0-9-]*)/i)?.[1]
  const fromTestsPath = input.match(/tests\/([a-z0-9][a-z0-9-]*)/i)?.[1]
  const slug = fromProductPhrase || fromTestsPath
  return { slug, id }
}

// Stripe Agent functionality
async function handleStripeOperations(input: string, adminCredentials?: any) {
  const stripeKey = adminCredentials?.stripe?.secretKey || process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return { error: 'No Stripe secret key available' }
  }

  const stripe = new Stripe(stripeKey)
  const isLiveMode = stripeKey.startsWith('sk_live')

  try {
    // Handle different Stripe operations based on input
    if (input.toLowerCase().includes('setup') || input.toLowerCase().includes('environment')) {
      const account = await stripe.accounts.retrieve()
      
      // Update environment files
      const envUpdates = {
        production: {
          'STRIPE_SECRET_KEY': adminCredentials?.stripe?.secretKey,
          'NEXT_PUBLIC_STRIPE_PUB_KEY': adminCredentials?.stripe?.publishableKey,
          'NEXT_PUBLIC_SITE_URL': 'https://hormonegroup.ie'
        },
        local: {
          'STRIPE_SECRET_KEY': isLiveMode ? 'sk_test_REPLACE_WITH_TEST_KEY' : adminCredentials?.stripe?.secretKey,
          'NEXT_PUBLIC_STRIPE_PUB_KEY': isLiveMode ? 'pk_test_REPLACE_WITH_TEST_KEY' : adminCredentials?.stripe?.publishableKey,
          'NEXT_PUBLIC_SITE_URL': 'http://localhost:3000'
        }
      }

      return {
        ok: true,
        account: {
          id: account.id,
          email: account.email,
          country: account.country,
          mode: isLiveMode ? 'live' : 'test'
        },
        envUpdates,
        message: isLiveMode ? 
          'Live keys configured for production. Get test keys from Stripe dashboard for local development.' :
          'Test keys configured. Environment setup complete.'
      }
    }

    // Handle workflow commands
    if (input.toLowerCase().includes('workflow') || input.toLowerCase().includes('full test')) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      
      // Test checkout session creation
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: 'Workflow Test Product'
              },
              unit_amount: 2900 // €29
            },
            quantity: 1
          }
        ],
        success_url: `${baseUrl}/thanks?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/tests`
      })

      return {
        ok: true,
        workflow: {
          checkoutUrl: session.url,
          sessionId: session.id,
          testProduct: 'Workflow Test Product',
          amount: '€29.00'
        },
        message: 'Workflow test session created. Use this URL to complete the payment flow.',
        instructions: [
          '1. Visit the checkout URL',
          '2. Complete test payment (use 4242424242424242)',
          '3. Check webhook handling in terminal',
          '4. Verify order saved to database'
        ]
      }
    }

    if (input.toLowerCase().includes('webhook')) {
      const webhooks = await stripe.webhookEndpoints.list({ limit: 10 })
      return {
        ok: true,
        webhooks: webhooks.data.map(w => ({
          id: w.id,
          url: w.url,
          status: w.status,
          events: w.enabled_events
        }))
      }
    }

    if (input.toLowerCase().includes('product')) {
      const products = await stripe.products.list({ limit: 10 })
      return {
        ok: true,
        products: products.data.map(p => ({
          id: p.id,
          name: p.name,
          active: p.active,
          metadata: p.metadata
        }))
      }
    }

    if (input.toLowerCase().includes('price')) {
      const prices = await stripe.prices.list({ limit: 10 })
      return {
        ok: true,
        prices: prices.data.map(p => ({
          id: p.id,
          product: p.product,
          unitAmount: p.unit_amount,
          currency: p.currency,
          active: p.active
        }))
      }
    }

    // Default: account info
    const account = await stripe.accounts.retrieve()
    return {
      ok: true,
      account: {
        id: account.id,
        email: account.email,
        country: account.country,
        businessName: account.business_profile?.name,
        mode: isLiveMode ? 'live' : 'test'
      }
    }

  } catch (error: any) {
    return { error: `Stripe operation failed: ${error.message}` }
  }
}

// Sanity Agent functionality
async function handleSanityOperations(input: string, adminCredentials?: any) {
  const projectId = adminCredentials?.sanity?.projectId || process.env.SANITY_PROJECT_ID
  const dataset = adminCredentials?.sanity?.dataset || process.env.SANITY_DATASET
  const apiVersion = adminCredentials?.sanity?.apiVersion || process.env.SANITY_API_VERSION || '2025-08-11'
  const readToken = adminCredentials?.sanity?.readToken || process.env.SANITY_READ_TOKEN
  const writeToken = adminCredentials?.sanity?.writeToken || process.env.SANITY_WRITE_TOKEN

  if (!projectId || !dataset) {
    return { error: 'Missing Sanity project ID or dataset' }
  }

  const readClient = createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false
  })

  const writeClient = createClient({
    projectId,
    dataset,
    apiVersion,
    token: writeToken,
    useCdn: false
  })

  try {
    // Handle different Sanity operations based on input
    if (input.toLowerCase().includes('setup') || input.toLowerCase().includes('environment')) {
      return {
        ok: true,
        projectInfo: {
          projectId,
          dataset,
          apiVersion,
          hasWriteToken: !!writeToken,
          studioUrl: `https://${projectId}.sanity.studio`,
          manageUrl: `https://www.sanity.io/manage/personal/project/${projectId}`
        },
        envUpdates: {
          'SANITY_PROJECT_ID': projectId,
          'SANITY_DATASET': dataset,
          'SANITY_API_VERSION': apiVersion,
          'SANITY_READ_TOKEN': readToken || 'your-sanity-read-token',
          'SANITY_WRITE_TOKEN': writeToken || 'your-sanity-write-token',
          'NEXT_PUBLIC_SANITY_PROJECT_ID': projectId,
          'NEXT_PUBLIC_SANITY_DATASET': dataset
        },
        message: writeToken ? 
          'Sanity configuration complete with write access' :
          'Sanity configured. Add SANITY_WRITE_TOKEN for write operations'
      }
    }

    if (input.toLowerCase().includes('product')) {
      const query = `*[_type == "product"]{
        _id,
        title,
        "slug": slug.current,
        priceEUR,
        stripeProductId,
        stripePriceIdOneTime,
        _createdAt,
        _updatedAt
      }`
      
      const products = await readClient.fetch(query)
      return {
        ok: true,
        products: products.map((product: any) => ({
          id: product._id,
          title: product.title,
          slug: product.slug,
          priceEUR: product.priceEUR,
          stripeProductId: product.stripeProductId,
          stripePriceIdOneTime: product.stripePriceIdOneTime,
          hasStripeIntegration: !!(product.stripeProductId && product.stripePriceIdOneTime)
        }))
      }
    }

    if (input.toLowerCase().includes('document')) {
      const query = `*[0...20]{ _id, _type, _createdAt, _updatedAt, title, name, slug }`
      const documents = await readClient.fetch(query)
      return {
        ok: true,
        documents: documents.map((doc: any) => ({
          id: doc._id,
          type: doc._type,
          title: doc.title || doc.name || 'Untitled',
          slug: doc.slug?.current || doc.slug
        }))
      }
    }

    if (input.toLowerCase().includes('schema') || input.toLowerCase().includes('type')) {
      const typesQuery = `array::unique(*[]._type)`
      const types = await readClient.fetch(typesQuery)
      
      const typeCounts: any = {}
      for (const type of types) {
        const count = await readClient.fetch(`count(*[_type == "${type}"])`)
        typeCounts[type] = count
      }
      
      return {
        ok: true,
        schemaTypes: typeCounts
      }
    }

    if (input.toLowerCase().includes('sync') || input.toLowerCase().includes('stripe')) {
      const products = await readClient.fetch(`*[_type == "product"]{
        _id, title, "slug": slug.current, stripeProductId, stripePriceIdOneTime
      }`)
      
      const syncStatus = {
        totalProducts: products.length,
        syncedProducts: products.filter((p: any) => p.stripeProductId && p.stripePriceIdOneTime).length,
        unsyncedProducts: products.filter((p: any) => !p.stripeProductId || !p.stripePriceIdOneTime)
      }
      
      return {
        ok: true,
        syncStatus,
        needsSync: syncStatus.unsyncedProducts.map((p: any) => ({
          id: p._id,
          title: p.title,
          slug: p.slug
        }))
      }
    }

    // Default: project info
    return {
      ok: true,
      projectInfo: {
        projectId,
        dataset,
        apiVersion,
        hasWriteToken: !!writeToken,
        studioUrl: `https://${projectId}.sanity.studio`,
        manageUrl: `https://www.sanity.io/manage/personal/project/${projectId}`
      }
    }

  } catch (error: any) {
    return { error: `Sanity operation failed: ${error.message}` }
  }
}

// Database Agent functionality
async function handleDatabaseOperations(input: string, adminCredentials?: any) {
  const databaseUrl = adminCredentials?.database?.url || process.env.DATABASE_URL
  
  if (!databaseUrl) {
    return { error: 'Missing DATABASE_URL' }
  }

  let prisma: PrismaClient | null = null
  
  try {
    prisma = new PrismaClient()

    // Handle different Database operations based on input
    if (input.toLowerCase().includes('connection') || input.toLowerCase().includes('test')) {
      try {
        await prisma.$connect()
        const result = await prisma.$queryRaw`SELECT NOW() as current_time` as any[]
        return {
          ok: true,
          connected: true,
          currentTime: result[0]?.current_time,
          message: 'Database connection successful'
        }
      } catch (error: any) {
        return {
          ok: false,
          connected: false,
          error: error.message,
          message: 'Database connection failed'
        }
      }
    }

    if (input.toLowerCase().includes('stats') || input.toLowerCase().includes('count')) {
      const stats: any = {}
      
      try {
        stats.User = await prisma.user.count()
        stats.Session = await prisma.session.count()
        stats.Order = await prisma.order.count()
        stats.FormSubmission = await prisma.formSubmission.count()
        stats.VerificationToken = await prisma.verificationToken.count()
        
        return {
          ok: true,
          tableStats: stats,
          totalRecords: Object.values(stats).reduce((a: any, b: any) => a + b, 0)
        }
      } catch (error: any) {
        return { error: `Failed to get stats: ${error.message}` }
      }
    }

    if (input.toLowerCase().includes('order')) {
      try {
        const orders = await prisma.order.findMany({
          take: 10,
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
        
        return {
          ok: true,
          orders: orders.map(order => ({
            ...order,
            items: Array.isArray(order.items) ? order.items : [order.items]
          }))
        }
      } catch (error: any) {
        return { error: `Failed to get orders: ${error.message}` }
      }
    }

    if (input.toLowerCase().includes('user')) {
      try {
        const users = await prisma.user.findMany({
          take: 10,
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
        
        return {
          ok: true,
          users
        }
      } catch (error: any) {
        return { error: `Failed to get users: ${error.message}` }
      }
    }

    if (input.toLowerCase().includes('form')) {
      try {
        const forms = await prisma.formSubmission.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' }
        })
        
        return {
          ok: true,
          formSubmissions: forms
        }
      } catch (error: any) {
        return { error: `Failed to get form submissions: ${error.message}` }
      }
    }

    if (input.toLowerCase().includes('setup') || input.toLowerCase().includes('environment')) {
      const url = new URL(databaseUrl)
      return {
        ok: true,
        connectionInfo: {
          provider: url.protocol.replace(':', ''),
          host: url.hostname,
          port: url.port,
          database: url.pathname.replace('/', ''),
          username: url.username,
          ssl: url.searchParams.get('sslmode') || 'prefer'
        },
        envUpdates: {
          'DATABASE_URL': databaseUrl,
          'NEXTAUTH_URL': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET || 'your-nextauth-secret'
        },
        message: 'Database configuration ready'
      }
    }

    // Default: connection info + basic stats
    const connectionTest = await prisma.$connect()
    const userCount = await prisma.user.count()
    const orderCount = await prisma.order.count()
    
    return {
      ok: true,
      connected: true,
      stats: {
        users: userCount,
        orders: orderCount
      },
      message: 'Database operational'
    }

  } catch (error: any) {
    return { error: `Database operation failed: ${error.message}` }
  } finally {
    if (prisma) {
      await prisma.$disconnect()
    }
  }
}

export async function POST(req: NextRequest) {
  // auth
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!process.env.AGENT_ADMIN_TOKEN || token !== process.env.AGENT_ADMIN_TOKEN) {
    return unauthorized()
  }

  const body = await req.json().catch(() => ({} as any))
  const input = (body?.input ?? '').toString().trim()
  const adminCredentials = body?.adminCredentials
  const explicitSlug = (body?.slug ?? '').toString().trim() || undefined
  const explicitId = (body?.id ?? '').toString().trim() || undefined

  if (!input && !explicitSlug && !explicitId) {
    return bad('Missing input. Pass { input: "..."} or { slug: "..." }')
  }

  // Handle Stripe operations
  if (input.toLowerCase().includes('stripe') || input.toLowerCase().includes('setup stripe') || input.toLowerCase().includes('manage stripe')) {
    const result = await handleStripeOperations(input, adminCredentials)
    return NextResponse.json(result)
  }

  // Handle Sanity operations
  if (input.toLowerCase().includes('sanity') || input.toLowerCase().includes('setup sanity') || input.toLowerCase().includes('manage sanity')) {
    const result = await handleSanityOperations(input, adminCredentials)
    return NextResponse.json(result)
  }

  // Handle Database operations
  if (input.toLowerCase().includes('database') || input.toLowerCase().includes('setup database') || input.toLowerCase().includes('manage database') || input.toLowerCase().includes('db ')) {
    const result = await handleDatabaseOperations(input, adminCredentials)
    return NextResponse.json(result)
  }

  const { slug: parsedSlug, id: parsedId } = extractTargets(input)
  const slug = explicitSlug || parsedSlug
  const id = explicitId || parsedId

  if (!slug && !id) {
    return bad('Could not find a product slug or id in your instruction.')
  }

  // Step 1: provision (creates Stripe product/price & patches Sanity if missing)
  const provision = await provisionProduct({ slug, id })
  if (!provision.ok) {
    return bad(provision.error || 'Provision failed', 500)
  }

  // find a usable price id from the provision payload
  const priceId =
    provision.stripePriceIdOneTime ||
    provision.priceId ||
    provision?.stripe?.price?.id

  if (!priceId) {
    return bad('Provision succeeded but no priceId was returned.', 500)
  }

  // Step 2: checkout
  const cancelPath = slug ? `/tests/${slug}` : '/tests'
  const checkout = await createCheckout({ priceId, cancelPath })

  if (!checkout.ok || !checkout.url) {
    return bad(checkout?.error || 'Checkout failed', 500)
  }

  return NextResponse.json({
    ok: true,
    slug: slug ?? null,
    id: id ?? null,
    priceId,
    checkoutUrl: checkout.url,
    details: {
      provision,
    },
  })
}
