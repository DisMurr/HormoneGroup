import 'server-only'
import {createClient} from 'next-sanity'

export const apiVersion =
  process.env.SANITY_API_VERSION || '2025-08-11'
export const dataset = process.env.SANITY_DATASET || 'production'
export const projectId = process.env.SANITY_PROJECT_ID!
export const useCdn = process.env.NODE_ENV === 'production'
const token = process.env.SANITY_READ_TOKEN

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn,
  perspective: 'published',
})

export const tokenClient = token
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false,
      token,
      perspective: 'published',
    })
  : null























