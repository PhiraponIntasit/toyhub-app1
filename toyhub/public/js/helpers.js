export const DEPOSIT_PCT = 30;
export const CARRIAGE = 890;
export const MAX_FEATURED = 4;
export const CATS = ['Figures', 'Statues', 'Busts', 'Dioramas', 'Accessories'];
export const STATUSES = ['In stock', 'Pre-order', 'Sold out'];
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
