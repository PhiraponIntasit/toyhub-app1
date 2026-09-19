const DEPOSIT_PCT = 30;
const MAX_FEATURED = 4;

function stockOf(p) { return p.stock == null ? 0 : Number(p.stock); }
function soldOutOf(p) { return p.status === 'Sold out' || stockOf(p) <= 0; }
function depositOf(p) { return Math.round(Number(p.price) * DEPOSIT_PCT / 100); }
function dueOf(p, mode) { return p.status === 'Pre-order' && mode !== 'full' ? depositOf(p) : Number(p.price); }

// Maps a DB row (snake_case) to the API's camelCase product shape.
function serializeProduct(row) {
  return {
    id: row.id, name: row.name, line: row.line, category: row.category, scale: row.scale,
    price: row.price, status: row.status, release: row.release_window,
    featured: row.featured, featuredAt: Number(row.featured_at) || 0,
    images: row.images || [], stock: row.stock, description: row.description,
    details: row.details || '',
    boxW: Number(row.box_w_cm) || 0, boxL: Number(row.box_l_cm) || 0,
    boxH: Number(row.box_h_cm) || 0, weightG: Number(row.weight_g) || 0
  };
}

function serializeOrder(row, items, emails) {
  return {
    ref: row.ref, name: row.name, email: row.email, phone: row.phone, address: row.address,
    subtotal: row.subtotal, shipping: row.shipping, total: row.total, balance: row.balance,
    cardLast4: row.card_last4, status: row.status, tracking: row.tracking,
    confirmedAt: row.confirmed_at, shippedAt: row.shipped_at, createdAt: row.created_at,
    balanceShipping: Number(row.balance_shipping) || 0,
    balanceRequestedAt: row.balance_requested_at, balancePaidAt: row.balance_paid_at,
    // What the customer owes right now: nothing until the shop has asked.
    balanceDue: row.balance_requested_at && !row.balance_paid_at
      ? Number(row.balance) + (Number(row.balance_shipping) || 0)
      : 0,
    items: (items || []).map((it) => ({
      productId: it.product_id, name: it.name, qty: it.qty, price: it.unit_price,
      due: it.unit_due, mode: it.mode, status: it.status, release: it.release_window
    })),
    emails: (emails || []).map((e) => ({ kind: e.kind, to: e.to_email, subject: e.subject, body: e.body, at: e.created_at }))
  };
}

module.exports = { DEPOSIT_PCT, MAX_FEATURED, stockOf, soldOutOf, depositOf, dueOf, serializeProduct, serializeOrder };
