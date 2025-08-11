import { groq } from 'next-sanity'

export const siteSettingsQuery = groq`*[_type == "siteSettings"][0]{
  title, description,
  email, phone,
  "logo": logo,
  "ogImage": ogImage,
  nav->{items[]{title, href}},
  footer->{email, phone, policies[]{title, href}}
}`

export const allProductsQuery = groq`*[_type == "product" && defined(slug.current)]|order(priceEUR asc){
  _id,
  title,
  "slug": slug.current,
  priceEUR,
  biomarkerCount,
  turnaround,
  bullets,
}`

export const productBySlugQuery = groq`*[_type == "product" && slug.current == $slug][0]{
  _id, title, "slug": slug.current, priceEUR, biomarkerCount, turnaround,
  bullets, measures, whyItMatters, symptoms, whatYouGet,
  stripePriceIdOneTime, stripePriceIdSubscription
}`

export const faqsByGroupQuery = groq`*[_type == "faq" && group == $group]|order(question asc){
  _id, question, answer, group
}`

export const postsListQuery = groq`*[_type == "post"]|order(publishedAt desc){
  _id, title, "slug": slug.current, excerpt, author, publishedAt, mainImage
}`

export const postBySlugQuery = groq`*[_type == "post" && slug.current == $slug][0]{
  _id, title, "slug": slug.current, excerpt, author, publishedAt, mainImage, body
}`

export const testimonialsQuery = groq`*[_type == "testimonial"]{_id, name, quote, role, location}`

export const benefitsQuery = groq`*[_type == "benefit"]{_id, title, description, icon}`
