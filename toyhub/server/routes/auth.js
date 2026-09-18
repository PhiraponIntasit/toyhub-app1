const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../db');

const router = express.Router();

function serializeUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, address: u.address, role: u.role };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

router.get('/me', (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

router.post('/signup', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const email = String(b.email || '').trim();
  const phone = String(b.phone || '').trim();
  const address = String(b.address || '').trim();
  const password = String(b.password || '');
  const confirm = String(b.confirm || '');

  let error = '';
  if (!name) error = 'A full name is required.';
  else if (!EMAIL_RE.test(email)) error = 'A valid email address is required.';
  else if (phone.replace(/\D/g, '').length < 9) error = 'A telephone number is required.';
  else if (!address) error = 'A shipping address is required.';
  else if (password.length < 6) error = 'The password needs at least six characters.';
  else if (password !== confirm) error = 'The two passwords do not match.';
  if (error) return res.status(400).json({ error });

  const existing = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  if (existing.rows.length) return res.status(400).json({ error: 'An account already uses that email.' });

  const hash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();
  const { rows } = await pool.query(
    `INSERT INTO users (id, email, password_hash, name, phone, address, role) VALUES ($1,$2,$3,$4,$5,$6,'user') RETURNING *`,
    [id, email, hash, name, phone, address]
  );
  req.session.userId = id;
  res.json({ user: serializeUser(rows[0]) });
});

router.post('/login', async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim();
  const password = String((req.body && req.body.password) || '');
  const { rows } = await pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
  const u = rows[0];
  const ok = u && (await bcrypt.compare(password, u.password_hash));
  if (!ok) return res.status(400).json({ error: 'That email and password do not match an account.' });
  req.session.userId = u.id;
  res.json({ user: serializeUser(u) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

module.exports = { router, serializeUser };
