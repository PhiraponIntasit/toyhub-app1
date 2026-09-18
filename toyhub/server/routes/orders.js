const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { requireAuth, requireMember, requireAdmin } = require('../middleware/auth');
const { stripe, isConfigured, publishableKey } = require('../lib/stripe');
const mailer = require('../lib/mailer');
const { CARRIAGE, DEPOSIT_PCT, stockOf, soldOutOf, dueOf, serializeOrder } = require('../lib/helpers');

const router = express.Router();
const money = (n) => '฿' + Number(n || 0).toLocaleString('en-US');

async function loadOrder(ref) {
  const { rows: orderRows } = await pool.query('SELECT * FROM orders WHERE ref = $1', [ref]);
  if (!orderRows[0]) return null;
  const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_ref = $1 ORDER BY id ASC', [ref]);
  const { rows: emails } = await pool.query('SELECT * FROM email_log WHERE order_ref = $1 ORDER BY created_at ASC', [ref]);
  return serializeOrder(orderRows[0], items, emails);
}

// Recomputes cart lines from the DB (never trusts client-sent prices/stock).
async function resolveLines(cartEntries) {
  const ids = cartEntries.map((e) => e.id);
  if (!ids.length) return { error: 'Your cart is empty.' };
  const { rows: products } = await pool.query('SELECT * FROM products WHERE id = ANY($1)', [ids]);
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const lines = [];
  for (const entry of cartEntries) {
    const p = byId[entry.id];
    if (!p || entry.qty <= 0) continue;
    if (soldOutOf(p)) return { error: `${p.name} is sold out.` };
    if (entry.qty > stockOf(p)) return { error: `Only ${stockOf(p)} left of ${p.name}.` };
    const mode = p.status === 'Pre-order' && entry.mode === 'deposit' ? 'deposit' : 'full';
    lines.push({ product: p, qty: entry.qty, mode });
  }
  if (!lines.length) return { error: 'Your cart is empty.' };
  return { lines };
}

function totalsOf(lines) {
  const subtotal = lines.reduce((t, l) => t + dueOf(l.product, l.mode) * l.qty, 0);
  const balance = lines.reduce((t, l) => t + (Number(l.product.price) - dueOf(l.product, l.mode)) * l.qty, 0);
  const shipsNow = lines.some((l) => l.mode === 'full');
  const shipping = shipsNow ? CARRIAGE : 0;
  return { subtotal, shipping, total: subtotal + shipping, balance };
}

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
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(totals.total * 100),
    currency: 'thb',
    payment_method_types: ['card'],
    metadata
  });
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

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['payment_method'] });
  if (intent.metadata.userId !== req.user.id) return res.status(403).json({ error: 'This payment does not belong to your account.' });
  if (intent.status !== 'succeeded') return res.status(400).json({ error: 'Payment has not completed yet.' });

  const items = JSON.parse(intent.metadata.items || '[]');
  const entries = items.map((it) => ({ id: it.id, qty: it.qty, mode: it.mode }));
  const { lines, error } = await resolveLines(entries);
  if (error) return res.status(409).json({ error: `Payment captured, but ${error.toLowerCase()} Contact the shop with your payment reference: ${paymentIntentId}` });
  const totals = totalsOf(lines);

  const cardLast4 = intent.payment_method && intent.payment_method.card ? intent.payment_method.card.last4 : '';

  let ref;
  for (let attempt = 0; attempt < 5; attempt++) {
    ref = 'TH-' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).toUpperCase().slice(-6);
    try {
      await pool.query(
        `INSERT INTO orders (ref, user_id, name, email, phone, address, subtotal, shipping, total, balance, card_last4, status, payment_status, payment_intent_id, confirmed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Confirmed','paid',$12, now())`,
        [ref, req.user.id, req.user.name, req.user.email, req.user.phone, req.user.address,
          totals.subtotal, totals.shipping, totals.total, totals.balance, cardLast4, paymentIntentId]
      );
      break;
    } catch (e) {
      if (e.code === '23505' && attempt < 4) continue;
      throw e;
    }
  }

  for (const l of lines) {
    await pool.query(
      `INSERT INTO order_items (order_ref, product_id, name, qty, unit_price, unit_due, mode, status, release_window)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ref, l.product.id, l.product.name, l.qty, Number(l.product.price), dueOf(l.product, l.mode), l.mode, l.product.status, l.product.release_window]
    );
    const left = Math.max(0, stockOf(l.product) - l.qty);
    await pool.query(
      `UPDATE products SET stock = $1, status = CASE WHEN $1 = 0 THEN 'Sold out' ELSE status END WHERE id = $2`,
      [left, l.product.id]
    );
  }

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

router.get('/orders/mine', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') return res.json({ orders: [] });
  const { rows } = await pool.query('SELECT ref FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  const orders = [];
  for (const r of rows) orders.push(await loadOrder(r.ref));
  res.json({ orders });
});

router.get('/admin/orders', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT ref FROM orders ORDER BY created_at DESC');
  const orders = [];
  for (const r of rows) orders.push(await loadOrder(r.ref));
  res.json({ orders });
});

const ORDER_STATUSES = ['Confirmed', 'Producing', 'Ready to ship', 'Completed', 'Cancelled'];

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

router.post('/admin/orders/:ref/ship', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders WHERE ref = $1', [req.params.ref]);
  const order = rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found.' });
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
