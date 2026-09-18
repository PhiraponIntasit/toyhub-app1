const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

router.post('/', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  const subject = String(b.subject || 'Something else').trim();
  const ref = String(b.ref || '').trim();
  const body = String(b.body || '').trim();

  let error = '';
  if (!name) error = 'Please give a name we can reply to.';
  else if (!EMAIL_RE.test(email)) error = 'A valid email address is required.';
  else if (body.length < 10) error = 'Tell us a little more so we can help.';
  if (error) return res.status(400).json({ error });

  const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await pool.query(
    `INSERT INTO messages (id, name, email, subject, ref, body) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, name, email, subject, ref, body]
  );
  res.json({ ok: true, sentTo: email });
});

router.get('/admin', requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM messages ORDER BY created_at DESC');
  res.json({
    messages: rows.map((m) => ({
      id: m.id, name: m.name, email: m.email, subject: m.subject, ref: m.ref,
      body: m.body, handled: m.handled, at: m.created_at
    }))
  });
});

router.put('/admin/:id/toggle', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE messages SET handled = NOT handled WHERE id = $1 RETURNING handled', [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Message not found.' });
  res.json({ handled: rows[0].handled });
});

router.delete('/admin/:id', requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM messages WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
