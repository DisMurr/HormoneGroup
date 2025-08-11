import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'title', maxLength: 96 } }),
    defineField({ name: 'priceEUR', type: 'number', description: 'EUR price', validation: (r) => r.required() }),
    defineField({ name: 'biomarkerCount', type: 'number', validation: (r) => r.min(0) }),
    defineField({ name: 'turnaround', type: 'string', description: 'e.g., 1–2 business days' }),
    defineField({ name: 'bullets', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'measures', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'whyItMatters', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'symptoms', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'whatYouGet', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'stripePriceIdOneTime', type: 'string', description: 'Stripe Price ID for one-time purchase' }),
    defineField({ name: 'stripePriceIdSubscription', type: 'string', description: 'Stripe Price ID for subscription' }),
  ],
})
