require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || '';

// Hosted Postgres (Supabase, Neon, Render…) terminates TLS with its own chain,
// which is not in the Node trust store — so verification is relaxed for those
// rather than for a local socket. DATABASE_SSL forces the choice either way.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const ssl = process.env.DATABASE_SSL === 'off' ? false
  : process.env.DATABASE_SSL === 'on' || !isLocal ? { rejectUnauthorized: false }
    : false;

// On a serverless platform every warm instance holds its own pool, so each one
// stays small and lets the provider's pooler do the multiplexing.
const max = Number(process.env.PG_POOL_MAX) || (process.env.VERCEL ? 1 : 10);

const pool = new Pool({ connectionString, ssl, max });

module.exports = { pool };
