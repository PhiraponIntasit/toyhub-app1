const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') return res.json({ productIds: [] });
  const { rows } = await pool.query('SELECT product_id FROM wishlist WHERE user_id = $1', [req.user.id]);
  res.json({ productIds: rows.map((r) => r.product_id) });
});

router.post('/:productId/toggle', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Saved pieces belong to member accounts — see the Demand tab.' });
  }
  const { productId } = req.params;
  const { rows } = await pool.query(
    'SELECT 1 FROM wishlist WHERE user_id = $1 AND product_id = $2', [req.user.id, productId]
  );
  let saved;
  if (rows.length) {
    await pool.query('DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2', [req.user.id, productId]);
    saved = false;
  } else {
    const { rows: prod } = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
    if (!prod.length) return res.status(404).json({ error: 'Piece not found.' });
    await pool.query('INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2)', [req.user.id, productId]);
    saved = true;
  }
  res.json({ saved });
});

router.get('/admin/demand', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT p.id, p.name, p.status, p.stock, count(w.user_id)::int AS count
    FROM products p JOIN wishlist w ON w.product_id = p.id
    GROUP BY p.id, p.name, p.status, p.stock
    HAVING count(w.user_id) > 0
    ORDER BY count DESC
  `);
  res.json({ demand: rows });
});

module.exports = router;
