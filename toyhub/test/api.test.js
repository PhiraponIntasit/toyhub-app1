const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, client, member } = require('./helper');

test.before(start);
test.after(stop);

test('the catalogue is public', async () => {
  const res = await client()('GET', '/api/products');
  assert.equal(res.status, 200);
  assert.equal(res.body.products.length, 12);
});

test('signup refuses an incomplete or inconsistent registration', async () => {
  const call = client();
  const missingPhone = await call('POST', '/api/auth/signup', Object.assign({}, member, { phone: '' }));
  assert.equal(missingPhone.status, 400);
  assert.match(missingPhone.body.error, /telephone/i);

  const mismatch = await call('POST', '/api/auth/signup', Object.assign({}, member, { confirm: 'different' }));
  assert.equal(mismatch.status, 400);
  assert.match(mismatch.body.error, /do not match/i);

  const shortPassword = await call('POST', '/api/auth/signup', Object.assign({}, member, { password: 'abc', confirm: 'abc' }));
  assert.equal(shortPassword.status, 400);
  assert.match(shortPassword.body.error, /six characters/i);
});

test('signing up starts a session and the email cannot be reused', async () => {
  const call = client();
  const created = await call('POST', '/api/auth/signup', member);
  assert.equal(created.status, 200);
  assert.equal(created.body.user.email, member.email);
  assert.equal(created.body.user.role, 'user');

  const me = await call('GET', '/api/auth/me');
  assert.equal(me.body.user.email, member.email);

  const duplicate = await client()('POST', '/api/auth/signup', member);
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.body.error, /already uses that email/i);
});

test('the password is never returned and a wrong one is refused', async () => {
  const call = client();
  const wrong = await call('POST', '/api/auth/login', { email: member.email, password: 'not-the-password' });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.user, undefined);

  const right = await call('POST', '/api/auth/login', { email: member.email, password: member.password });
  assert.equal(right.status, 200);
  assert.equal(right.body.user.password_hash, undefined);
  assert.equal(right.body.user.passwordHash, undefined);
});

test('logging out ends the session', async () => {
  const call = client();
  await call('POST', '/api/auth/login', { email: member.email, password: member.password });
  await call('POST', '/api/auth/logout');
  const me = await call('GET', '/api/auth/me');
  assert.equal(me.body.user, null);
});

test('only an administrator may change the catalogue', async () => {
  const anon = client();
  assert.equal((await anon('POST', '/api/products', { name: 'Smuggled in' })).status, 401);

  const asMember = client();
  await asMember('POST', '/api/auth/login', { email: member.email, password: member.password });
  assert.equal((await asMember('POST', '/api/products', { name: 'Smuggled in' })).status, 403);
  assert.equal((await asMember('GET', '/api/admin/orders')).status, 403);

  const admin = client();
  await admin('POST', '/api/auth/login', { email: 'admin@toyhub.co', password: 'admin1234' });
  const created = await admin('POST', '/api/products', { name: 'Test Piece', price: 500, stock: 2, category: 'Figures', status: 'In stock' });
  assert.equal(created.status, 200);
  assert.equal(created.body.product.name, 'Test Piece');

  const deleted = await admin('DELETE', `/api/products/${created.body.product.id}`);
  assert.equal(deleted.status, 200);
  const after = await anon('GET', '/api/products');
  assert.equal(after.body.products.length, 12);
});

test("What's Included survives a round trip, and edition is gone", async () => {
  const admin = client();
  await admin('POST', '/api/auth/login', { email: 'admin@toyhub.co', password: 'admin1234' });

  const details = 'One figure, fully assembled\nDisplay base\nTwo interchangeable hands';
  const created = await admin('POST', '/api/products', {
    name: 'Details Piece', price: 500, stock: 2, category: 'Figures', status: 'In stock', details
  });
  assert.equal(created.body.product.details, details, 'line breaks are kept verbatim');
  assert.equal('edition' in created.body.product, false);

  const edited = await admin('PUT', `/api/products/${created.body.product.id}`, {
    name: 'Details Piece', price: 500, stock: 2, category: 'Figures', status: 'In stock', details: 'Just the figure'
  });
  assert.equal(edited.body.product.details, 'Just the figure');

  const listed = (await client()('GET', '/api/products')).body.products
    .find((p) => p.id === created.body.product.id);
  assert.equal(listed.details, 'Just the figure');

  await admin('DELETE', `/api/products/${created.body.product.id}`);
});

test('a wishlist belongs to a signed-in member and toggles', async () => {
  assert.equal((await client()('GET', '/api/wishlist')).status, 401);

  const call = client();
  await call('POST', '/api/auth/login', { email: member.email, password: member.password });
  assert.deepEqual((await call('GET', '/api/wishlist')).body.productIds, []);

  assert.equal((await call('POST', '/api/wishlist/p1/toggle')).body.saved, true);
  assert.deepEqual((await call('GET', '/api/wishlist')).body.productIds, ['p1']);
  assert.equal((await call('POST', '/api/wishlist/p1/toggle')).body.saved, false);
  assert.deepEqual((await call('GET', '/api/wishlist')).body.productIds, []);
});

test('an enquiry reaches the administrator inbox', async () => {
  const anon = client();
  const incomplete = await anon('POST', '/api/messages', { name: '', email: '', body: '' });
  assert.equal(incomplete.status, 400);

  const sent = await anon('POST', '/api/messages', {
    name: 'Somchai', email: 'somchai@example.com', subject: 'An order or tracking', body: 'Where is my parcel?'
  });
  assert.equal(sent.status, 200);

  const admin = client();
  await admin('POST', '/api/auth/login', { email: 'admin@toyhub.co', password: 'admin1234' });
  const inbox = await admin('GET', '/api/messages/admin');
  assert.equal(inbox.body.messages.length, 1);
  assert.equal(inbox.body.messages[0].body, 'Where is my parcel?');
});

test('checkout is refused when the payment gateway is not configured', async () => {
  const call = client();
  await call('POST', '/api/auth/login', { email: member.email, password: member.password });
  const res = await call('POST', '/api/checkout/create-intent', { cart: { p2: 1 }, mode: {} });
  assert.equal(res.status, 503);
  assert.match(res.body.error, /not configured/i);
});

test('the health check reports on the database', async () => {
  const res = await client()('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});
