import { NextResponse } from 'next/server'
import { provisionProduct } from '@/lib/provisionProduct'

// Sanity webhook endpoint. Configure webhook with:
//  URL: <site>/api/webhooks/sanity/product
//  Filter: _type == "product" && defined(priceEUR)
//  Events: create, update, publish (ignore delete)
//  Secret header: Authorization: Bearer <PROVISION_SECRET>

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') || ''
  const expected = `Bearer ${process.env.PROVISION_SECRET}`
  if (!process.env.PROVISION_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const text = await req.text()
  let payload: any
  try { payload = JSON.parse(text) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const docType = payload?._type || payload?.document?._type
  if (docType !== 'product') return NextResponse.json({ skipped: true, reason: 'Not product' })
  const id: string | undefined = payload._id || payload.document?._id
  if (!id) return NextResponse.json({ skipped: true, reason: 'Missing id' })
  if (payload?.transition === 'delete' || payload?.action === 'delete') {
    return NextResponse.json({ skipped: true, reason: 'Delete event' })
  }
  try {
    const result = await provisionProduct({ id })
    return NextResponse.json({ provisioned: true, ...result })
  } catch (err: any) {
    const status = err?.status || 500
    return NextResponse.json({ error: err?.message || 'Provision failed' }, { status })
  }
}



