const { pool } = require('../db');

async function loadUser(req, res, next) {
  req.user = null;
  if (req.session && req.session.userId) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    req.user = rows[0] || null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

// A "member" is a signed-in, non-admin account — the only role allowed to buy.
function requireMember(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required.' });
  if (req.user.role === 'admin') return res.status(403).json({ error: 'Administrator accounts cannot place orders.' });
  next();
}

module.exports = { loadUser, requireAuth, requireAdmin, requireMember };
