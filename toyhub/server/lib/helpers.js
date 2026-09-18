const DEPOSIT_PCT = 30;
const CARRIAGE = 890;
const MAX_FEATURED = 4;

function stockOf(p) { return p.stock == null ? 0 : Number(p.stock); }
function soldOutOf(p) { return p.status === 'Sold out' || stockOf(p) <= 0; }
function depositOf(p) { return Math.round(Number(p.price) * DEPOSIT_PCT / 100); }
function dueOf(p, mode) { return p.status === 'Pre-order' && mode !== 'full' ? depositOf(p) : Number(p.price); }

// Maps a DB row (snake_case) to the API's camelCase product shape.
function serializeProduct(row) {
  return {
    id: row.id, name: row.name, line: row.line, category: row.category, scale: row.scale,
    price: row.price, status: row.status, release: row.release_window, edition: row.edition,
    featured: row.featured, featuredAt: Number(row.featured_at) || 0,
    images: row.images || [], stock: row.stock, description: row.description
  };
}

function serializeOrder(row, items, emails) {
  return {
    ref: row.ref, name: row.name, email: row.email, phone: row.phone, address: row.address,
    subtotal: row.subtotal, shipping: row.shipping, total: row.total, balance: row.balance,
    cardLast4: row.card_last4, status: row.status, tracking: row.tracking,
    confirmedAt: row.confirmed_at, shippedAt: row.shipped_at, createdAt: row.created_at,
    items: (items || []).map((it) => ({
      productId: it.product_id, name: it.name, qty: it.qty, price: it.unit_price,
      due: it.unit_due, mode: it.mode, status: it.status, release: it.release_window
    })),
    emails: (emails || []).map((e) => ({ kind: e.kind, to: e.to_email, subject: e.subject, body: e.body, at: e.created_at }))
  };
}

module.exports = { DEPOSIT_PCT, CARRIAGE, MAX_FEATURED, stockOf, soldOutOf, depositOf, dueOf, serializeProduct, serializeOrder };
