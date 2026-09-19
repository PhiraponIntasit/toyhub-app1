// Carriers bill collectibles on volumetric weight, not on what the piece
// weighs: a 3 kg resin statue in a 50x40x60 foam box is charged as 24 kg. So
// carriage is worked out from the packed box, and scale — which says nothing
// about box size, a 1/3 bust being smaller than a 1/12 diorama — is not used.

// Cubic centimetres to a billed kilo. 5000 is the air-freight convention every
// carrier quoting Thailand uses; 6000 appears on some road rates.
const VOLUMETRIC_DIVISOR = 5000;

// A piece nobody has measured yet ships at a flat rate per unit. It is
// deliberately low: the shop absorbs the difference rather than overcharging a
// customer for a guess, and the gap is the reason to go and measure the box.
const UNMEASURED_CARRIAGE = 100;

// Thailand only for now. Adding a country means adding a row and asking the
// customer which one they are in — nothing else in the calculation changes.
const ZONES = {
  TH: { label: 'Thailand', base: 120, includedKg: 1, perKg: 35 }
};
const DEFAULT_ZONE = 'TH';

const isMeasured = (p) =>
  Number(p.box_w_cm) > 0 && Number(p.box_l_cm) > 0 && Number(p.box_h_cm) > 0;

// What one unit is billed as, in kilos, rounded up to the half kilo carriers
// quote in.
function billableKg(p) {
  const volumetric = (Number(p.box_w_cm) * Number(p.box_l_cm) * Number(p.box_h_cm)) / VOLUMETRIC_DIVISOR;
  const actual = Number(p.weight_g) / 1000;
  return Math.ceil(Math.max(volumetric, actual, 0) * 2) / 2;
}

// One carriage for the order rather than one per piece: the shop sends a single
// consignment, so the billed weights are added up and the table applied once.
// Only lines being paid in full travel now — a piece held on deposit is carried
// when it ships, and is quoted then.
function carriageFor(lines, zone) {
  const rate = ZONES[zone] || ZONES[DEFAULT_ZONE];
  const shipping = lines.filter((l) => l.mode === 'full');
  if (!shipping.length) return 0;

  let kg = 0;
  let unmeasured = 0;
  for (const l of shipping) {
    if (isMeasured(l.product)) kg += billableKg(l.product) * l.qty;
    else unmeasured += l.qty;
  }

  const measuredCost = kg > 0
    ? rate.base + Math.max(0, Math.ceil((kg - rate.includedKg) * 2) / 2) * rate.perKg
    : 0;
  return Math.round(measuredCost + unmeasured * UNMEASURED_CARRIAGE);
}

module.exports = { ZONES, DEFAULT_ZONE, VOLUMETRIC_DIVISOR, UNMEASURED_CARRIAGE, isMeasured, billableKg, carriageFor };
