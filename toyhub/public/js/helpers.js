export const DEPOSIT_PCT = 30;
// Mirrors server/lib/shipping.js so the cart can show what checkout will
// charge. The server recomputes it from the database and has the final say.
const VOLUMETRIC_DIVISOR = 5000;
const UNMEASURED_CARRIAGE = 100;
const ZONE_TH = { base: 120, includedKg: 1, perKg: 35 };

export const isMeasured = (p) => Number(p.boxW) > 0 && Number(p.boxL) > 0 && Number(p.boxH) > 0;
export const billableKg = (p) => {
  const volumetric = (Number(p.boxW) * Number(p.boxL) * Number(p.boxH)) / VOLUMETRIC_DIVISOR;
  return Math.ceil(Math.max(volumetric, Number(p.weightG) / 1000, 0) * 2) / 2;
};
export function carriageFor(lines) {
  const shipping = lines.filter((l) => l.mode === 'full');
  if (!shipping.length) return 0;
  let kg = 0;
  let unmeasured = 0;
  for (const l of shipping) {
    if (isMeasured(l.product)) kg += billableKg(l.product) * l.qty;
    else unmeasured += l.qty;
  }
  const measured = kg > 0
    ? ZONE_TH.base + Math.max(0, Math.ceil((kg - ZONE_TH.includedKg) * 2) / 2) * ZONE_TH.perKg
    : 0;
  return Math.round(measured + unmeasured * UNMEASURED_CARRIAGE);
}
export const MAX_FEATURED = 4;
export const CATS = ['Figures', 'Statues', 'Busts', 'Dioramas', 'Accessories'];
export const STATUSES = ['In stock', 'Pre-order', 'Sold out'];
// The brands the shop starts with. An administrator adds others from the piece
// dialog, and they join this list for as long as a piece carries them.
export const BRANDS = ['Inart', 'UPFinegures/LPZZ', 'Hot Toys'];
export const brandsOf = (products) =>
  Array.from(new Set(BRANDS.concat((products || []).map((p) => p.line)))).filter(Boolean).sort();
export const ACCENT = 'var(--color-accent-700)';
export const INK = 'var(--color-text)';

export const money = (n) => '฿' + Number(n || 0).toLocaleString('en-US');
export const dateLabel = (t) => t ? new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
export const imgsOf = (p) => (p.images && p.images.length ? p.images : []).filter(Boolean);
export const stockOf = (p) => Number(p.stock) || 0;
export const soldOutOf = (p) => p.status === 'Sold out' || stockOf(p) <= 0;
export const depositOf = (p) => Math.round(Number(p.price) * DEPOSIT_PCT / 100);
export const dueOf = (p, mode) => (p.status === 'Pre-order' && mode !== 'full' ? depositOf(p) : Number(p.price));
export const bgUrl = (u) => (u ? `url("${u}")` : 'none');

const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; };
export const pickRandom = (list, n, seed) => list.slice().sort((a, b) => hash(a.id + seed) - hash(b.id + seed)).slice(0, n);
export const featuredOrder = (list) => list.filter((p) => p.featured).sort((a, b) => (a.featuredAt || 0) - (b.featuredAt || 0));

export function loadLocal(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
}
export function saveLocal(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage unavailable */ }
}
