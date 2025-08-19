import Link from 'next/link'
import {sanityClient} from '@/lib/sanity/client'
import {allProductsQuery} from '@/lib/sanity/queries'

type Product = {
  _id: string
  title: string
  slug: string
  priceEUR?: number
  turnaround?: string
  sampleType?: string
}

async function getProducts(): Promise<Product[]> {
  if (process.env.CMS_DOWN_FALLBACK === 'mdx') {
    return [
      { _id: 'prod-testosterone-check', title: 'Testosterone Check', slug: 'testosterone-check', priceEUR: 69, turnaround: '1–2 working days', sampleType: 'DBS' },
      { _id: 'prod-female-hormone-panel', title: 'Female Hormone Panel', slug: 'female-hormone-panel', priceEUR: 99, turnaround: '1–2 working days', sampleType: 'DBS' },
      { _id: 'prod-thyroid-basic', title: 'Thyroid Basic', slug: 'thyroid-basic', priceEUR: 59, turnaround: '1–2 working days', sampleType: 'DBS' }
    ]
  }
  try {
    return await sanityClient.fetch(allProductsQuery, {}, { next: { revalidate: 60 } })
  } catch (err) {
    console.error('Sanity fetch failed', err)
    return []
  }
}

export default async function TestsPage() {
  const products = await getProducts()
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-semibold mb-6">Our Tests</h1>
      {products.length === 0 ? (
        <p>No products available.</p>
      ) : (
        <ul className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <li key={p._id} className="rounded border p-4">
              <h2 className="text-lg font-medium">{p.title}</h2>
              {p.priceEUR != null && <p className="mt-1">€{p.priceEUR}</p>}
              <p className="text-sm text-gray-600 mt-1">{[p.sampleType, p.turnaround].filter(Boolean).join(' • ')}</p>
              <Link href={`/tests/${p.slug}`} className="mt-3 inline-block underline">View details</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
