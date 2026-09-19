const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, pool } = require('./helper');
const { resolveLines, totalsOf, writeOrder, loadOrder, loadOrders } = require('../server/lib/orders');
const { CARRIAGE } = require('../server/lib/helpers');

// Stripe is not involved below: these exercise the part that runs once a
// payment has already succeeded, which is where the money is at stake.
const buyer = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Test Buyer', email: 'buyer@example.com', phone: '0812345678', address: '9 Test Road'
};

test.before(async () => {
  await start();
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, phone, address, role)
     VALUES ($1,$2,'x',$3,$4,$5,'user') ON CONFLICT (id) DO NOTHING`,
    [buyer.id, buyer.email, buyer.name, buyer.phone, buyer.address]
  );
});
test.after(stop);

async function stockOfProduct(id) {
  const { rows } = await pool.query('SELECT stock, status FROM products WHERE id = $1', [id]);
  return rows[0];
}

test('lines are priced from the database, not from what the client sent', async () => {
  const { lines } = await resolveLines([{ id: 'p2', qty: 1, mode: 'full' }]);
  assert.equal(lines[0].product.price, 12900);
  assert.equal(lines[0].qty, 1);
});

test('a cart cannot ask for more than the shelf holds', async () => {
  const tooMany = await resolveLines([{ id: 'p2', qty: 999, mode: 'full' }]);
  assert.match(tooMany.error, /Only 6 left/);

  const soldOut = await resolveLines([{ id: 'p7', qty: 1, mode: 'full' }]);
  assert.match(soldOut.error, /sold out/i);

  const empty = await resolveLines([]);
  assert.match(empty.error, /empty/i);
});

test('carriage is charged only when something ships now', async () => {
  const { lines: shipping } = await resolveLines([{ id: 'p2', qty: 1, mode: 'full' }]);
  assert.equal(totalsOf(shipping).shipping, CARRIAGE);

  const { lines: deposit } = await resolveLines([{ id: 'p1', qty: 1, mode: 'deposit' }]);
  const t = totalsOf(deposit);
  assert.equal(t.shipping, 0, 'a deposit-only order pays carriage when it ships');
  assert.equal(t.subtotal, 7470);
  assert.equal(t.balance, 24900 - 7470);
});

test('writing an order records its lines and takes the stock with it', async () => {
  const before = await stockOfProduct('p2');
  const { lines } = await resolveLines([{ id: 'p2', qty: 2, mode: 'full' }]);
  const totals = totalsOf(lines);

  const ref = await writeOrder({ user: buyer, lines, totals, cardLast4: '4242', paymentIntentId: 'pi_test_lines' });
  assert.match(ref, /^TH-/);

  const order = await loadOrder(ref);
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].qty, 2);
  assert.equal(order.total, 12900 * 2 + CARRIAGE);
  assert.equal(order.cardLast4, '4242');
  assert.equal(order.status, 'Confirmed');

  const after = await stockOfProduct('p2');
  assert.equal(Number(after.stock), Number(before.stock) - 2);
});

test('taking the last unit marks the piece sold out', async () => {
  const { rows } = await pool.query("SELECT stock FROM products WHERE id = 'p10'");
  const { lines } = await resolveLines([{ id: 'p10', qty: Number(rows[0].stock), mode: 'full' }]);
  await writeOrder({ user: buyer, lines, totals: totalsOf(lines), cardLast4: '4242', paymentIntentId: 'pi_test_last' });

  const after = await stockOfProduct('p10');
  assert.equal(Number(after.stock), 0);
  assert.equal(after.status, 'Sold out');
});

test('a failed write leaves no order and no stock taken', async () => {
  const before = await stockOfProduct('p5');
  const { lines } = await resolveLines([{ id: 'p5', qty: 1, mode: 'full' }]);
  // order_items.mode is constrained to deposit/full, so this aborts the
  // transaction after the order row is in but before its lines are.
  const doomed = [Object.assign({}, lines[0], { mode: 'not-a-mode' })];

  await assert.rejects(() => writeOrder({
    user: buyer, lines: doomed, totals: totalsOf(lines), cardLast4: '4242', paymentIntentId: 'pi_test_rollback'
  }));

  const { rows } = await pool.query("SELECT ref FROM orders WHERE payment_intent_id = 'pi_test_rollback'");
  assert.equal(rows.length, 0, 'the order row was rolled back with its lines');
  const after = await stockOfProduct('p5');
  assert.equal(Number(after.stock), Number(before.stock), 'stock was not consumed');
});

test('loading many orders does not scale its queries with the count', async () => {
  const { rows } = await pool.query('SELECT ref FROM orders');
  const refs = rows.map((r) => r.ref);
  assert.ok(refs.length >= 2);

  let queries = 0;
  const realQuery = pool.query.bind(pool);
  pool.query = (...args) => { queries++; return realQuery(...args); };
  try {
    const orders = await loadOrders(refs);
    assert.equal(orders.length, refs.length);
    assert.equal(queries, 3, 'three queries regardless of how many orders');
  } finally {
    pool.query = realQuery;
  }
});
