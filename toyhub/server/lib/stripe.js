const Stripe = require('stripe');

// Trimmed because a key pasted into .env often carries a stray space or a
// wrapped line with it, and Stripe then rejects every call with "Invalid API
// Key" — an error that gives no hint about where the fault actually is.
const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
const publishableKey = (process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
const isConfigured = !!secretKey;

if (isConfigured && !/^sk_(test|live)_[A-Za-z0-9]{50,}$/.test(secretKey)) {
  console.warn(
    `[stripe] STRIPE_SECRET_KEY is ${secretKey.length} characters and does not look like a complete key ` +
    '(expected sk_test_… or sk_live_… at roughly 107). The usual cause is a key that wrapped onto a ' +
    'second line in .env, so only the first part was read. Checkout will fail with "Invalid API Key".'
  );
}

const stripe = isConfigured ? new Stripe(secretKey) : null;

module.exports = { stripe, isConfigured, publishableKey };
