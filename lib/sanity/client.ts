import { createClient } from 'next-sanity'

export const projectId = process.env.SANITY_PROJECT_ID || ''
export const dataset = process.env.SANITY_DATASET || 'production'
export const apiVersion = process.env.SANITY_API_VERSION || '2024-07-01'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === 'production',
})

export const tokenClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token: process.env.SANITY_READ_TOKEN,
})
