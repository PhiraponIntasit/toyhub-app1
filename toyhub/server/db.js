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

// Which server this pool talks to, credentials left out. Printed by the
// migration and the seed, and served by /api/health: the cost of running one
// of them against the wrong database is high enough that it should never have
// to be inferred.
function target() {
  if (!connectionString) return 'not configured';
  try {
    const u = new URL(connectionString);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch (e) {
    // The value holds a password, so describe its shape rather than print it.
    const faults = [];
    if (!/^postgres(ql)?:\/\//.test(connectionString)) faults.push('does not start with postgresql:// — something is in front of it, such as psql, a quote mark or DATABASE_URL=');
    if (/\s/.test(connectionString)) faults.push('contains a space or a line break');
    if (/["']/.test(connectionString)) faults.push('contains a quote mark');
    if (/[[\]]/.test(connectionString)) faults.push('still has the [YOUR-PASSWORD] placeholder brackets');
    return 'unusable connection string: it ' + (faults.join('; it ') || 'could not be parsed');
  }
}

module.exports = { pool, target };
