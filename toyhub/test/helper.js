// The suite truncates every table, so it refuses to touch whatever
// DATABASE_URL happens to be pointing at — a test database must be named.
// Set before requiring db.js: dotenv leaves an already-set variable alone.
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL to a throwaway database — the suite truncates every table.');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// No test may reach the real Stripe API, so the suite always runs against the
// unconfigured-gateway path whatever the developer has in .env.
process.env.STRIPE_SECRET_KEY = '';
process.env.STRIPE_PUBLISHABLE_KEY = '';

const { pool } = require('../server/db');
const { migrate } = require('../server/migrate');
const { seed } = require('../server/seed');

let server;

// Every run starts from the same schema and seed rows so assertions about
// stock and catalogue size hold regardless of what a previous run left behind.
async function start() {
  if (server) return baseUrl();
  await migrate();
  await pool.query('TRUNCATE order_items, orders, email_log, wishlist, messages, products, users RESTART IDENTITY CASCADE');
  await seed();
  const app = require('../server/app');
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return baseUrl();
}

function baseUrl() {
  return `http://127.0.0.1:${server.address().port}`;
}

async function stop() {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = null;
  await pool.end();
}

// A fetch bound to one cookie jar, so a test can act as a signed-in visitor.
function client() {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(baseUrl() + path, {
      method,
      headers: Object.assign({ cookie }, body === undefined ? {} : { 'content-type': 'application/json' }),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* not json — a static asset or an html error */ }
    return { status: res.status, body: json, text };
  };
}

const member = {
  name: 'Test Member', email: 'member@example.com', phone: '0812345678',
  address: '1 Test Road', password: 'test1234', confirm: 'test1234'
};

module.exports = { start, stop, client, baseUrl, member, pool };
