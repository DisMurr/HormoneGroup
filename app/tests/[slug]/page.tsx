import {notFound} from 'next/navigation'
import {sanityClient} from '@/lib/sanity/client'
import {productBySlugQuery} from '@/lib/sanity/queries'

export default async function ProductPage({params}:{params:{slug:string}}){
  const product = await sanityClient.fetch(productBySlugQuery, {slug: params.slug})
  if(!product) return notFound()
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold">{product.title}</h1>
      <p className="mt-2 text-gray-700">€{product.priceEUR} • {product.sampleType} • {product.turnaround}</p>

      <section className="mt-6">
        <h2 className="font-medium">What this test measures</h2>
        <ul className="list-disc ml-6 mt-2">
          {(product.markers || []).map((m:string)=> <li key={m}>{m}</li>)}
        </ul>
      </section>
    </main>
  )
}
