const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, client, pool } = require('./helper');
const { resolveLines, totalsOf, writeOrder, loadOrder, carriageOutstanding, settleBalance } = require('../server/lib/orders');

// A pre-order taken on a deposit, carried through to the day the piece lands
// and the rest of the money is asked for. Stripe is never configured in the
// suite, so the two payment endpoints are checked for their refusal and the
// settlement itself goes through the same function the route calls.
const buyer = {
  name: 'Balance Buyer', email: 'balance@example.com', phone: '0898765432',
  address: '4 Deposit Lane', password: 'test1234', confirm: 'test1234'
};

let asBuyer, asAdmin, depositRef, paidInFullRef;

test.before(async () => {
  await start();

  asBuyer = client();
  const signed = await asBuyer('POST', '/api/auth/signup', buyer);
  const user = Object.assign({}, buyer, { id: signed.body.user.id });

  asAdmin = client();
  await asAdmin('POST', '/api/auth/login', { email: 'admin@toyhub.co', password: 'admin1234' });

  const { lines } = await resolveLines([{ id: 'p1', qty: 1, mode: 'deposit' }]);
  depositRef = await writeOrder({ user, lines, totals: totalsOf(lines), cardLast4: '4242', paymentIntentId: 'pi_balance_deposit' });

  const full = await resolveLines([{ id: 'p2', qty: 1, mode: 'full' }]);
  paidInFullRef = await writeOrder({ user, lines: full.lines, totals: totalsOf(full.lines), cardLast4: '4242', paymentIntentId: 'pi_balance_full' });
});
test.after(stop);

test('a deposit leaves a balance, but nothing is owed until the shop asks', async () => {
  const order = (await asBuyer('GET', '/api/orders/mine')).body.orders.find((o) => o.ref === depositRef);
  assert.equal(order.balance, 24900 - 7470);
  assert.equal(order.balanceDue, 0, 'the customer is not chased before the piece exists');
  assert.equal(order.balanceShipping, 0);
  assert.equal(order.status, 'Confirmed');
});

test('only an administrator may ask for a balance', async () => {
  assert.equal((await client()('POST', `/api/admin/orders/${depositRef}/request-balance`)).status, 401);
  assert.equal((await asBuyer('POST', `/api/admin/orders/${depositRef}/request-balance`)).status, 403);
});

test('asking for the balance quotes the carriage, emails it and holds the order', async () => {
  const carriage = await carriageOutstanding(depositRef);
  assert.ok(carriage > 0, 'the piece is measured, so it is billed on its box');

  const res = await asAdmin('POST', `/api/admin/orders/${depositRef}/request-balance`);
  assert.equal(res.status, 200);
  const order = res.body.order;
  assert.equal(order.status, 'Balance due');
  assert.equal(order.balanceShipping, carriage, 'the quote is frozen on the order');
  assert.equal(order.balanceDue, order.balance + carriage);
  assert.ok(order.balanceRequestedAt);

  const email = order.emails.find((e) => e.kind === 'balance');
  assert.equal(email.to, buyer.email);
  assert.match(email.body, /Insured carriage/);
  assert.match(email.body, new RegExp('Due now: ฿' + order.balanceDue.toLocaleString('en-US')), 'the email names the figure asked for');
});

test('an order with nothing owed cannot be asked for a balance', async () => {
  const res = await asAdmin('POST', `/api/admin/orders/${paidInFullRef}/request-balance`);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /nothing left to pay/i);

  const missing = await asAdmin('POST', '/api/admin/orders/TH-NOPE/request-balance');
  assert.equal(missing.status, 404);
});

test('nothing ships while the balance is outstanding', async () => {
  const res = await asAdmin('POST', `/api/admin/orders/${depositRef}/ship`, { tracking: 'TH999' });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /has not been paid/i);

  const order = await loadOrder(depositRef);
  assert.equal(order.tracking, '', 'no tracking number was recorded');
  assert.equal(order.status, 'Balance due');
});

test('settling the balance clears it, adds the carriage and frees the order', async () => {
  const before = await loadOrder(depositRef);
  const { rows } = await pool.query('SELECT * FROM orders WHERE ref = $1', [depositRef]);

  const paid = await settleBalance(rows[0], 'pi_balance_settled');
  assert.equal(paid, before.balanceDue);

  const after = await loadOrder(depositRef);
  assert.equal(after.balance, 0);
  assert.equal(after.balanceDue, 0);
  assert.equal(after.shipping, before.shipping + before.balanceShipping);
  assert.equal(after.total, before.total + paid, 'the order now shows everything the customer paid');
  assert.equal(after.status, 'Ready to ship');
  assert.ok(after.balancePaidAt);

  const shipped = await asAdmin('POST', `/api/admin/orders/${depositRef}/ship`, { tracking: 'TH123456789' });
  assert.equal(shipped.status, 200);
  assert.equal(shipped.body.order.status, 'Completed');
  assert.equal(shipped.body.order.tracking, 'TH123456789');
});

test('a balance cannot be taken without a payment gateway', async () => {
  const intent = await asBuyer('POST', `/api/orders/${depositRef}/balance-intent`);
  assert.equal(intent.status, 503);
  const finalize = await asBuyer('POST', `/api/orders/${depositRef}/balance-finalize`, { paymentIntentId: 'pi_x' });
  assert.equal(finalize.status, 503);

  assert.equal((await client()('POST', `/api/orders/${depositRef}/balance-intent`)).status, 401);
});
