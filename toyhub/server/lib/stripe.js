const Stripe = require('stripe');

const secretKey = process.env.STRIPE_SECRET_KEY || '';
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
const isConfigured = !!secretKey;
const stripe = isConfigured ? new Stripe(secretKey) : null;

module.exports = { stripe, isConfigured, publishableKey };
