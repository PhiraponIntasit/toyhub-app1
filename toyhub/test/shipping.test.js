const test = require('node:test');
const assert = require('node:assert/strict');
const { billableKg, isMeasured, carriageFor, UNMEASURED_CARRIAGE } = require('../server/lib/shipping');

// 42 × 42 × 62 = 109,368 cm³ / 5000 = 21.87 kg volumetric against 6.5 kg actual
const statue = { box_w_cm: 42, box_l_cm: 42, box_h_cm: 62, weight_g: 6500 };
// A bust is dense and small: 34 × 30 × 40 = 40,800 / 5000 = 8.16 against 5.2 kg
const bust = { box_w_cm: 34, box_l_cm: 30, box_h_cm: 40, weight_g: 5200 };
// Heavier than its box is large: 24 × 18 × 8 = 3,456 / 5000 = 0.69 against 0.9 kg
const nameplates = { box_w_cm: 24, box_l_cm: 18, box_h_cm: 8, weight_g: 900 };
const unmeasured = { box_w_cm: 0, box_l_cm: 0, box_h_cm: 0, weight_g: 0 };

const line = (product, qty, mode) => ({ product, qty, mode: mode || 'full' });

test('a light, bulky piece is billed on its volume', () => {
  assert.equal(billableKg(statue), 22, 'rounded up from 21.87 to the half kilo');
  assert.equal(billableKg(bust), 8.5);
});

test('a small, dense piece is billed on its actual weight', () => {
  assert.equal(billableKg(nameplates), 1, 'actual 0.9 kg beats volumetric 0.69');
});

test('a piece with no box measured is not measured', () => {
  assert.equal(isMeasured(unmeasured), false);
  assert.equal(isMeasured(statue), true);
  assert.equal(isMeasured({ box_w_cm: 10, box_l_cm: 0, box_h_cm: 10 }), false, 'one missing side is not a box');
});

test('carriage is the zone table applied once to the whole consignment', () => {
  // 22 kg: base 120 covers the first kilo, 21 more at 35
  assert.equal(carriageFor([line(statue, 1)]), 120 + 21 * 35);
  // two of them is 44 kg, not two base charges
  assert.equal(carriageFor([line(statue, 2)]), 120 + 43 * 35);
  // and a mixed order adds the weights before the table is applied
  assert.equal(carriageFor([line(statue, 1), line(bust, 1)]), Math.round(120 + 29.5 * 35), 'to the baht');
});

test('a piece held on deposit is not carried yet', () => {
  assert.equal(carriageFor([line(statue, 1, 'deposit')]), 0);
  // only the line travelling now is weighed
  assert.equal(carriageFor([line(statue, 1, 'deposit'), line(nameplates, 1, 'full')]), 120);
});

test('an unmeasured piece falls back to a flat rate per unit', () => {
  assert.equal(carriageFor([line(unmeasured, 1)]), UNMEASURED_CARRIAGE);
  assert.equal(carriageFor([line(unmeasured, 3)]), UNMEASURED_CARRIAGE * 3);
  // measured and unmeasured in one order: the table, plus the flat rate
  assert.equal(carriageFor([line(nameplates, 1), line(unmeasured, 1)]), 120 + UNMEASURED_CARRIAGE);
});

test('an empty consignment costs nothing', () => {
  assert.equal(carriageFor([]), 0);
});

test('an unknown zone falls back to the Thailand table rather than failing', () => {
  assert.equal(carriageFor([line(nameplates, 1)], 'XX'), carriageFor([line(nameplates, 1)], 'TH'));
});
