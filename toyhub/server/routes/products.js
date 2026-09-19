const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { serializeProduct, MAX_FEATURED } = require('../lib/helpers');

const router = express.Router();
const STATUSES = ['In stock', 'Pre-order', 'Sold out'];
const CATEGORIES = ['Figures', 'Statues', 'Busts', 'Dioramas', 'Accessories'];

async function allProducts() {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at ASC');
  return rows;
}

// Mirrors the prototype's cap: at most MAX_FEATURED products featured at once,
// releasing whichever was featured longest when a new one pushes past it.
async function enforceFeaturedCap() {
  const { rows } = await pool.query(
    'SELECT id, name, featured_at FROM products WHERE featured = true ORDER BY featured_at ASC'
  );
  let released = null;
  let over = rows;
  while (over.length > MAX_FEATURED) {
    const oldest = over[0];
    released = oldest.name;
    await pool.query('UPDATE products SET featured = false, featured_at = 0 WHERE id = $1', [oldest.id]);
    over = over.slice(1);
  }
  return released;
}

router.get('/', async (req, res) => {
  const rows = await allProducts();
  res.json({ products: rows.map(serializeProduct) });
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Piece not found.' });
  res.json({ product: serializeProduct(rows[0]) });
});

router.post('/', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'A piece needs a name before it can be saved.' });

  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const status = STATUSES.includes(b.status) ? b.status : 'In stock';
  const category = CATEGORIES.includes(b.category) ? b.category : 'Figures';
  const price = Number(b.price) || 0;
  let stock = Math.max(0, Number(b.stock) || 0);
  let finalStatus = status;
  if (stock === 0 && finalStatus !== 'Pre-order') finalStatus = 'Sold out';
  const featured = !!b.featured;
  const images = Array.isArray(b.images) ? b.images.filter(Boolean) : [];

  const { rows } = await pool.query(
    `INSERT INTO products (id, name, line, category, scale, price, status, release_window, edition, featured, featured_at, images, stock, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [id, name, String(b.line || '').trim(), category, String(b.scale || '').trim(), price, finalStatus,
      String(b.release || '').trim(), String(b.edition || '').trim(), featured, featured ? Date.now() : 0,
      images, stock, String(b.description || '').trim()]
  );
  const released = await enforceFeaturedCap();
  const { rows: refreshed } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  res.json({ product: serializeProduct(refreshed[0]), released });
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { rows: existingRows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  const prev = existingRows[0];
  if (!prev) return res.status(404).json({ error: 'Piece not found.' });

  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'A piece needs a name before it can be saved.' });

  const status = STATUSES.includes(b.status) ? b.status : prev.status;
  const category = CATEGORIES.includes(b.category) ? b.category : prev.category;
  const price = Number(b.price) || 0;
  let stock = Math.max(0, Number(b.stock) || 0);
  let finalStatus = status;
  if (stock === 0 && finalStatus !== 'Pre-order') finalStatus = 'Sold out';
  const featured = !!b.featured;
  const featuredAt = featured ? (prev.featured && prev.featured_at ? prev.featured_at : Date.now()) : 0;
  const images = Array.isArray(b.images) ? b.images.filter(Boolean) : [];

  await pool.query(
    `UPDATE products SET name=$1, line=$2, category=$3, scale=$4, price=$5, status=$6, release_window=$7,
       edition=$8, featured=$9, featured_at=$10, images=$11, stock=$12, description=$13 WHERE id=$14`,
    [name, String(b.line || '').trim(), category, String(b.scale || '').trim(), price, finalStatus,
      String(b.release || '').trim(), String(b.edition || '').trim(), featured, featuredAt,
      images, stock, String(b.description || '').trim(), req.params.id]
  );
  const released = await enforceFeaturedCap();
  const { rows: refreshed } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  res.json({ product: serializeProduct(refreshed[0]), released });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
