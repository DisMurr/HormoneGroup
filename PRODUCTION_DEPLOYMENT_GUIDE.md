# PRODUCTION DEPLOYMENT GUIDE

Important: All values shown below are placeholders. Do not commit real secrets to version control. Configure real values via environment variables in your hosting platform.

## Production deployment checklist

### Webhooks configured
- Stripe Webhook
  - URL: https://hormonegroup.ie/api/stripe/webhook
  - Webhook ID: <STRIPE_WEBHOOK_ID>
  - Secret: <STRIPE_WEBHOOK_SECRET>
  - Events: checkout.session.completed, payment_intent.succeeded, product.*, price.*

- Sanity Webhook (manual setup)
  - URL: https://hormonegroup.ie/api/admin/provision
  - Filter: `_type == "product" && defined(slug.current) && !(_id in path("drafts.**"))`
  - Header: Authorization: Bearer <PROVISION_SECRET>

### Environment variables (Vercel/production)
```bash
# App
NEXT_PUBLIC_SITE_URL=https://hormonegroup.ie

# Stripe
STRIPE_SECRET_KEY=<STRIPE_SECRET_KEY>
NEXT_PUBLIC_STRIPE_PUB_KEY=<STRIPE_PUBLISHABLE_KEY>
STRIPE_WEBHOOK_SECRET=<STRIPE_WEBHOOK_SECRET>

# Sanity
SANITY_PROJECT_ID=fnv8ttx3
SANITY_DATASET=production
SANITY_WRITE_TOKEN=<SANITY_WRITE_TOKEN>
SANITY_READ_TOKEN=<SANITY_READ_TOKEN>
SANITY_API_VERSION=2024-07-01

# Database / Auth
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
NEXTAUTH_URL=https://hormonegroup.ie
NEXTAUTH_SECRET=<NEXTAUTH_SECRET>

# Admin tokens
AGENT_ADMIN_TOKEN=<AGENT_ADMIN_TOKEN>
PROVISION_SECRET=<PROVISION_SECRET>

# Public Sanity config
NEXT_PUBLIC_SANITY_PROJECT_ID=fnv8ttx3
NEXT_PUBLIC_SANITY_DATASET=production
```

## Deploy steps (summary)
1) Deploy to Vercel (vercel --prod) and add the env vars above in the dashboard or via CLI
2) Run database migrations: `npx prisma migrate deploy && npx prisma generate`
3) Configure the Sanity webhook with the Authorization header: `Bearer <PROVISION_SECRET>`
4) Verify the admin agent endpoint with a test call using the bearer token

Example verification curl:
```bash
curl https://hormonegroup.ie/api/agent \
  -H "Authorization: Bearer <AGENT_ADMIN_TOKEN>" \
  -d '{"input":"health check"}'
```

## Manual verification
1) Create a product in Sanity (ensure priceEUR is set) and publish
2) Confirm the provisioning route created Stripe product/price
3) Visit a product page and complete a test checkout (Stripe test card 4242...)
4) Confirm the order appears in the admin orders list and in the database

Keep examples clearly fake. If a real secret is ever committed, rotate it immediately (Stripe, Sanity, database, etc.).
