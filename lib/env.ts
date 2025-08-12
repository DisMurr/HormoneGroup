// Centralised environment helpers for runtime guardrails

export const IS_PROD = process.env.NODE_ENV === 'production'
export const IS_LIVE_STRIPE = !!process.env.STRIPE_SECRET_KEY?.startsWith('sk_live')

export const FLAGS = {
  affiliates: process.env.AFFILIATES_ENABLED === 'true',
  loyalty: process.env.LOYALTY_ENABLED === 'true',
}

export const EU_REGION = process.env.EU_FUNCTION_REGION

export default {
  IS_PROD,
  IS_LIVE_STRIPE,
  FLAGS,
  EU_REGION,
}
