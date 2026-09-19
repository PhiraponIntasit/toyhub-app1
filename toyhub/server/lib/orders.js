// Order reading and writing, kept out of the route layer so it can be tested
// without going through Stripe or HTTP.
const { pool } = require('../db');
const { stockOf, soldOutOf, dueOf, serializeOrder } = require('./helpers');
const { carriageFor } = require('./shipping');

// Three queries whatever the order count — the admin and account lists would
// otherwise issue three per order.
async function loadOrders(refs) {
  if (!refs.length) return [];
  const [{ rows: orderRows }, { rows: items }, { rows: emails }] = await Promise.all([
    pool.query('SELECT * FROM orders WHERE ref = ANY($1) ORDER BY created_at DESC', [refs]),
    pool.query('SELECT * FROM order_items WHERE order_ref = ANY($1) ORDER BY id ASC', [refs]),
    pool.query('SELECT * FROM email_log WHERE order_ref = ANY($1) ORDER BY created_at ASC', [refs])
  ]);
  const itemsBy = {};
  for (const it of items) (itemsBy[it.order_ref] = itemsBy[it.order_ref] || []).push(it);
  const emailsBy = {};
  for (const em of emails) (emailsBy[em.order_ref] = emailsBy[em.order_ref] || []).push(em);
  return orderRows.map((o) => serializeOrder(o, itemsBy[o.ref] || [], emailsBy[o.ref] || []));
}

async function loadOrder(ref) {
  const [order] = await loadOrders([ref]);
  return order || null;
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

function totalsOf(lines, zone) {
  const subtotal = lines.reduce((t, l) => t + dueOf(l.product, l.mode) * l.qty, 0);
  const balance = lines.reduce((t, l) => t + (Number(l.product.price) - dueOf(l.product, l.mode)) * l.qty, 0);
  const shipping = carriageFor(lines, zone);
  return { subtotal, shipping, total: subtotal + shipping, balance };
}

const newRef = () => 'TH-' + (Date.now().toString(36) + Math.random().toString(36).slice(2, 4)).toUpperCase().slice(-6);

// The order, its lines and the stock they consume go in together or not at all:
// a failure part-way through used to leave a paid order with missing lines and
// stock already spent. Stock is decremented in SQL rather than from the value
// read earlier, so two checkouts racing cannot overwrite each other's figure.
async function writeOrder({ user, lines, totals, cardLast4, paymentIntentId }) {
  const client = await pool.connect();
  try {
    for (let attempt = 0; ; attempt++) {
      const ref = newRef();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO orders (ref, user_id, name, email, phone, address, subtotal, shipping, total, balance, card_last4, status, payment_status, payment_intent_id, confirmed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Confirmed','paid',$12, now())`,
          [ref, user.id, user.name, user.email, user.phone, user.address,
            totals.subtotal, totals.shipping, totals.total, totals.balance, cardLast4, paymentIntentId]
        );
        for (const l of lines) {
          await client.query(
            `INSERT INTO order_items (order_ref, product_id, name, qty, unit_price, unit_due, mode, status, release_window)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [ref, l.product.id, l.product.name, l.qty, Number(l.product.price), dueOf(l.product, l.mode), l.mode, l.product.status, l.product.release_window]
          );
          await client.query(
            `UPDATE products
                SET stock = GREATEST(0, stock - $1),
                    status = CASE WHEN GREATEST(0, stock - $1) = 0 THEN 'Sold out' ELSE status END
              WHERE id = $2`,
            [l.qty, l.product.id]
          );
        }
        await client.query('COMMIT');
        return ref;
      } catch (e) {
        await client.query('ROLLBACK');
        if (e.code === '23505' && attempt < 4) continue;
        throw e;
      }
    }
  } finally {
    client.release();
  }
}

module.exports = { loadOrders, loadOrder, resolveLines, totalsOf, writeOrder };
