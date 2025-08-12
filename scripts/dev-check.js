// Simple, dependency-free .env preflight checker for dev/build.
// Usage: `node scripts/dev-check.js`

const fs = require('fs');
const path = require('path');

const ENV_CANDIDATES = ['.env', '.env.local', '.env.development.local'];

function parseDotenvString(input) {
  const out = {};
  input.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) return;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  });
  return out;
}

function loadEnvFile() {
  for (const file of ENV_CANDIDATES) {
    const p = path.resolve(process.cwd(), file);
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      return { file, vars: parseDotenvString(raw) };
    }
  }
  return { file: null, vars: {} };
}

function fail(msg) {
  console.error('\n❌  ' + msg);
  process.exit(1);
}

function warn(msg) {
  console.warn('⚠️   ' + msg);
}

(function main() {
  const { file, vars } = loadEnvFile();
  const env = { ...vars, ...process.env }; // file takes precedence if present

  if (!file) {
    warn('No .env file found. Create one by copying .env.example → .env');
  } else {
    console.log(`🔎 Using env file: ${file}`);
  }

  const required = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SITE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'EU_FUNCTION_REGION',
  ];

  const missing = required.filter((k) => !env[k] || !String(env[k]).trim());
  if (missing.length) {
    fail(`Missing required env vars: ${missing.join(', ')}\n→ Copy .env.example to .env and fill these values.`);
  }

  // Database sanity
  const db = String(env.DATABASE_URL);
  if (!/^postgres(ql)?:\/\//i.test(db)) {
    fail('DATABASE_URL must be a valid Postgres connection string (postgres:// or postgresql://)');
  }
  if (!/sslmode=require/.test(db)) {
    warn('DATABASE_URL is missing sslmode=require (recommended for serverless Postgres like Neon/Supabase).');
  }

  // NextAuth secret length
  if (String(env.NEXTAUTH_SECRET).length < 32) {
    warn('NEXTAUTH_SECRET looks short. Use a long, random 32+ character string.');
  }

  // Soft-optional groups
  const stripeKeys = ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUB_KEY'];
  if (stripeKeys.some((k) => !env[k])) {
    warn('Stripe keys not set. Checkout and webhooks will be disabled or mocked in dev.');
  }

  const sanityKeys = ['SANITY_PROJECT_ID', 'SANITY_DATASET'];
  if (sanityKeys.some((k) => !env[k]) && env.CMS_DOWN_FALLBACK !== 'mdx') {
    warn('Sanity not configured. Set CMS_DOWN_FALLBACK=mdx to render without CMS in dev.');
  }

  console.log('✅  Env check passed. You are good to go.\n');
})();

