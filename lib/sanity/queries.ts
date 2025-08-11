import {groq} from 'next-sanity'

export const allProductsQuery = groq`*[_type == "product"]|order(title asc){
  _id,
  title,
  "slug": slug.current,
  priceEUR,
  turnaround,
  sampleType
}`

export const productBySlugQuery = groq`*[_type=="product" && slug.current==$slug][0]{
  _id,
  title,
  "slug": slug.current,
  priceEUR,
  turnaround,
  sampleType,
  markers,
  whyItMatters,
  symptoms,
  whatYouGet,
  stripePriceIdOneTime,
  stripePriceIdSubscription
}`
