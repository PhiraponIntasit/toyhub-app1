const Stripe = require('stripe');

// Trimmed because a key pasted into .env often carries a stray space or a
// wrapped line with it, and Stripe then rejects every call with "Invalid API
// Key" — an error that gives no hint about where the fault actually is.
const secretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
const publishableKey = (process.env.STRIPE_PUBLISHABLE_KEY || '').trim();
// Both halves are needed: the server creates the PaymentIntent with the secret
// key and the browser mounts the card form with the publishable one. Treating
// a half-filled pair as configured only produces a payment form that never
// loads, so it counts as not configured and says which half is missing.
const isConfigured = !!secretKey && !!publishableKey;

if (!!secretKey !== !!publishableKey) {
  console.warn(
    `[stripe] only ${secretKey ? 'STRIPE_SECRET_KEY' : 'STRIPE_PUBLISHABLE_KEY'} is set — ` +
    `${secretKey ? 'STRIPE_PUBLISHABLE_KEY' : 'STRIPE_SECRET_KEY'} is missing, so checkout stays disabled. ` +
    'Both come from https://dashboard.stripe.com/test/apikeys'
  );
}

if (secretKey && !/^sk_(test|live)_[A-Za-z0-9]{50,}$/.test(secretKey)) {
  console.warn(
    `[stripe] STRIPE_SECRET_KEY is ${secretKey.length} characters and does not look like a complete key ` +
    '(expected sk_test_… or sk_live_… at roughly 107). The usual cause is a key that wrapped onto a ' +
    'second line in .env, so only the first part was read. Checkout will fail with "Invalid API Key".'
  );
}

const stripe = isConfigured ? new Stripe(secretKey) : null;

module.exports = { stripe, isConfigured, publishableKey };
