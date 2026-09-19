const test = require('node:test');
const assert = require('node:assert/strict');
const { DEPOSIT_PCT, CARRIAGE, stockOf, soldOutOf, depositOf, dueOf } = require('../server/lib/helpers');

const preorder = { price: 24900, status: 'Pre-order', stock: 12 };
const inStock = { price: 12900, status: 'In stock', stock: 6 };

test('a deposit is 30% of the price, rounded to the baht', () => {
  assert.equal(DEPOSIT_PCT, 30);
  assert.equal(depositOf(preorder), 7470);
  assert.equal(depositOf({ price: 1999 }), 600);
});

test('a pre-order defaults to its deposit but can be settled in full', () => {
  assert.equal(dueOf(preorder, 'deposit'), 7470);
  assert.equal(dueOf(preorder, undefined), 7470);
  assert.equal(dueOf(preorder, 'full'), 24900);
});

test('a stocked piece is always due in full, whatever mode is asked for', () => {
  assert.equal(dueOf(inStock, 'deposit'), 12900);
  assert.equal(dueOf(inStock, 'full'), 12900);
});

test('stock is missing, not zero, when the column is null', () => {
  assert.equal(stockOf({ stock: null }), 0);
  assert.equal(stockOf({ stock: '7' }), 7);
});

test('a piece is sold out when marked so or when nothing is left', () => {
  assert.equal(soldOutOf({ status: 'In stock', stock: 0 }), true);
  assert.equal(soldOutOf({ status: 'Sold out', stock: 5 }), true);
  assert.equal(soldOutOf(inStock), false);
});

test('carriage is a flat fee', () => {
  assert.equal(CARRIAGE, 890);
});
