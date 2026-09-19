const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireMember, requireAdmin } = require('../middleware/auth');
const { stripe, isConfigured, publishableKey } = require('../lib/stripe');
const mailer = require('../lib/mailer');
const { DEPOSIT_PCT } = require('../lib/helpers');
const { loadOrder, loadOrders, resolveLines, totalsOf, writeOrder, carriageOutstanding, settleBalance } = require('../lib/orders');

const router = express.Router();
const money = (n) => '฿' + Number(n || 0).toLocaleString('en-US');

function cartEntriesFromBody(body) {
  const cart = (body && body.cart) || {};
  const mode = (body && body.mode) || {};
  return Object.keys(cart)
    .map((id) => ({ id, qty: Number(cart[id]) || 0, mode: mode[id] === 'full' ? 'full' : 'deposit' }))
    .filter((e) => e.qty > 0);
}

router.get('/config', (req, res) => {
  res.json({ stripeConfigured: isConfigured, stripePublishableKey: publishableKey });
});

router.post('/checkout/create-intent', requireMember, async (req, res) => {
  if (!isConfigured) {
    return res.status(503).json({ error: 'Payment gateway not configured yet — the shop needs to add Stripe test keys.' });
  }
  const entries = cartEntriesFromBody(req.body);
  const { lines, error } = await resolveLines(entries);
  if (error) return res.status(400).json({ error });
  const totals = totalsOf(lines);
  if (totals.total <= 0) return res.status(400).json({ error: 'Nothing due right now.' });

  const metadata = {
    userId: req.user.id,
    items: JSON.stringify(lines.map((l) => ({ id: l.product.id, qty: l.qty, mode: l.mode })))
  };
  let intent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: Math.round(totals.total * 100),
      currency: 'thb',
      payment_method_types: ['card'],
      metadata
    });
  } catch (err) {
    // Without this the visitor only sees "something went wrong": a rejected key
    // or a currency the account cannot take looks identical to a server crash.
    console.error('Stripe rejected paymentIntents.create —', err.type, err.code || '', err.message);
    return res.status(502).json({ error: `Payment gateway: ${err.message}` });
  }
  res.json({ clientSecret: intent.client_secret, publishableKey, amount: totals.total, totals });
});

router.post('/checkout/finalize', requireMember, async (req, res) => {
  if (!isConfigured) return res.status(503).json({ error: 'Payment gateway not configured.' });
  const paymentIntentId = String((req.body && req.body.paymentIntentId) || '');
  if (!paymentIntentId) return res.status(400).json({ error: 'Missing payment reference.' });

  const { rows: existing } = await pool.query('SELECT ref FROM orders WHERE payment_intent_id = $1', [paymentIntentId]);
  if (existing[0]) {
    const order = await loadOrder(existing[0].ref);
    return res.json({ order });
  }

  let intent;
  try {
    intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['payment_method'] });
  } catch (err) {
    console.error('Stripe rejected paymentIntents.retrieve —', err.type, err.code || '', err.message);
    return res.status(502).json({ error: `Payment gateway: ${err.message}` });
  }
  if (intent.metadata.userId !== req.user.id) return res.status(403).json({ error: 'This payment does not belong to your account.' });
  if (intent.status !== 'succeeded') return res.status(400).json({ error: 'Payment has not completed yet.' });

  const items = JSON.parse(intent.metadata.items || '[]');
  const entries = items.map((it) => ({ id: it.id, qty: it.qty, mode: it.mode }));
  const { lines, error } = await resolveLines(entries);
  if (error) return res.status(409).json({ error: `Payment captured, but ${error.toLowerCase()} Contact the shop with your payment reference: ${paymentIntentId}` });
  const totals = totalsOf(lines);

  const cardLast4 = intent.payment_method && intent.payment_method.card ? intent.payment_method.card.last4 : '';

  const ref = await writeOrder({ user: req.user, lines, totals, cardLast4, paymentIntentId });

  const itemsDesc = lines.map((l) => `${l.qty} × ${l.product.name}` + (l.product.status === 'Pre-order'
    ? (l.mode === 'full' ? ' (paid in full, ships ' + (l.product.release_window || 'TBA') + ')' : ` (${DEPOSIT_PCT}% deposit, ships ` + (l.product.release_window || 'TBA') + ')')
    : '')).join('\n');
  await mailer.send({
    orderRef: ref, kind: 'confirmation', to: req.user.email,
    subject: `ToyHub order ${ref} confirmed`,
    body: `Thank you, ${req.user.name}.\n\n${itemsDesc}\n\nCharged ${money(totals.total)} to the card ending ${cardLast4}.` +
      (totals.balance > 0 ? `\nBalance on shipping: ${money(totals.balance)} (plus carriage).` : '')
  });

  const order = await loadOrder(ref);
  res.json({ order });
});

// Settling a balance is its own payment: a second intent against the order,
// not a change to the one that took the deposit.
router.post('/orders/:ref/balance-intent', requireMember, async (req, res) => {
  if (!isConfigured) return res.status(503).json({ error: 'Payment gateway not configured.' });
  const { rows } = await pool.query('SELECT * FROM orders WHERE ref = $1 AND user_id = $2', [req.params.ref, req.user.id]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (!order.balance_requested_at) return res.status(400).json({ error: 'The shop has not asked for this balance yet.' });
  if (order.balance_paid_at) return res.status(400).json({ error: 'This balance is already paid.' });

  const due = Number(order.balance) + Number(order.balance_shipping);
  if (due <= 0) return res.status(400).json({ error: 'Nothing left to pay.' });

  let intent;
  try {
    intent = await stripe.paymentIntents.create({
      amount: Math.round(due * 100), currency: 'thb', payment_method_types: ['card'],
      metadata: { userId: req.user.id, orderRef: order.ref, kind: 'balance' }
    });
  } catch (err) {
    console.error('Stripe rejected the balance intent —', err.type, err.code || '', err.message);
    return res.status(502).json({ error: `Payment gateway: ${err.message}` });
  }
  res.json({ clientSecret: intent.client_secret, publishableKey, due });
});

router.post('/orders/:ref/balance-finalize', requireMember, async (req, res) => {
  if (!isConfigured) return res.status(503).json({ error: 'Payment gateway not configured.' });
  const paymentIntentId = String((req.body && req.body.paymentIntentId) || '');
  if (!paymentIntentId) return res.status(400).json({ error: 'Missing payment reference.' });

  const { rows } = await pool.query('SELECT * FROM orders WHERE ref = $1 AND user_id = $2', [req.params.ref, req.user.id]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.balance_paid_at) return res.json({ order: await loadOrder(order.ref) });

  let intent;
  try {
    intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    console.error('Stripe rejected the balance retrieve —', err.type, err.code || '', err.message);
    return res.status(502).json({ error: `Payment gateway: ${err.message}` });
  }
  if (intent.metadata.orderRef !== order.ref) return res.status(403).json({ error: 'This payment belongs to another order.' });
  if (intent.status !== 'succeeded') return res.status(400).json({ error: 'Payment has not completed yet.' });

  const paid = await settleBalance(order, paymentIntentId);
  await mailer.send({
    orderRef: order.ref, kind: 'balance-paid', to: order.email,
    subject: `ToyHub order ${order.ref} — balance received`,
    body: `Thank you — ${money(paid)} received.\n\nYour piece is being packed and you will have a tracking number shortly.`
  });
  res.json({ order: await loadOrder(order.ref) });
});

router.get('/orders/mine', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') return res.json({ orders: [] });
  const { rows } = await pool.query('SELECT ref FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ orders: await loadOrders(rows.map((r) => r.ref)) });
});

router.get('/admin/orders', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT ref FROM orders ORDER BY created_at DESC');
  res.json({ orders: await loadOrders(rows.map((r) => r.ref)) });
});

const ORDER_STATUSES = ['Confirmed', 'Producing', 'Balance due', 'Ready to ship', 'Completed', 'Cancelled'];

router.put('/admin/orders/:ref/status', requireAdmin, async (req, res) => {
  const status = String((req.body && req.body.status) || '');
  if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status.' });
  const { rows } = await pool.query('UPDATE orders SET status = $1 WHERE ref = $2 RETURNING ref', [status, req.params.ref]);
  if (!rows[0]) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order: await loadOrder(req.params.ref) });
});

router.put('/admin/orders/:ref/tracking', requireAdmin, async (req, res) => {
  const tracking = String((req.body && req.body.tracking) || '');
  const { rows } = await pool.query('UPDATE orders SET tracking = $1 WHERE ref = $2 RETURNING ref', [tracking, req.params.ref]);
  if (!rows[0]) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order: await loadOrder(req.params.ref) });
});

// The piece has arrived: work out what is still owed and ask for it. The
// carriage is fixed here at the figure the customer is about to be shown.
router.post('/admin/orders/:ref/request-balance', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE ref = $1', [req.params.ref]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (Number(order.balance) <= 0) return res.status(400).json({ error: 'This order has nothing left to pay.' });
  if (order.balance_paid_at) return res.status(400).json({ error: 'The balance on this order is already paid.' });

  const carriage = await carriageOutstanding(req.params.ref);
  await pool.query(
    `UPDATE orders SET status = 'Balance due', balance_shipping = $1, balance_requested_at = now() WHERE ref = $2`,
    [carriage, req.params.ref]
  );

  const due = Number(order.balance) + carriage;
  await mailer.send({
    orderRef: req.params.ref, kind: 'balance', to: order.email,
    subject: `ToyHub order ${req.params.ref} — balance due`,
    body: `Your reserved piece has arrived at the shop.\n\n` +
      `Balance on the piece: ${money(order.balance)}\nInsured carriage: ${money(carriage)}\n` +
      `Due now: ${money(due)}\n\n` +
      `Settle it from your orders page and we will send it on its way.`
  });
  res.json({ order: await loadOrder(req.params.ref) });
});

router.post('/admin/orders/:ref/ship', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE ref = $1', [req.params.ref]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  // Goods do not leave with money outstanding.
  if (Number(order.balance) > 0 && !order.balance_paid_at) {
    return res.status(409).json({ error: 'The balance on this order has not been paid yet.' });
  }
  const tracking = String((req.body && req.body.tracking) || order.tracking || '').trim();
  if (!tracking) return res.status(400).json({ error: 'Enter a tracking number first.' });

  await pool.query(
    `UPDATE orders SET tracking = $1, status = 'Completed', shipped_at = now() WHERE ref = $2`,
    [tracking, req.params.ref]
  );
  await mailer.send({
    orderRef: req.params.ref, kind: 'tracking', to: order.email,
    subject: `ToyHub order ${req.params.ref} shipped`,
    body: `Your order ${req.params.ref} has shipped.\nTracking number: ${tracking}\n\nThe order is now marked Completed.`
  });
  res.json({ order: await loadOrder(req.params.ref) });
});

router.delete('/admin/orders/:ref', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM orders WHERE ref = $1', [req.params.ref]);
  res.json({ ok: true });
});

module.exports = router;
