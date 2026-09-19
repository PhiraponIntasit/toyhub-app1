require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db');
const { loadUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth').router;
const productRoutes = require('./routes/products');
const wishlistRoutes = require('./routes/wishlist');
const messageRoutes = require('./routes/messages');
const orderRoutes = require('./routes/orders');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

app.use(session({
  store: new pgSession({ pool, createTableIfMissing: true }),
  name: 'toyhub.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));

app.use(loadUser);

// Which endpoint the pool was pointed at, with the credentials left out — the
// most common deployment mistake is a connection string that reaches the wrong
// host or port, and "unreachable" on its own does not say which.
function dbTarget() {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) return 'not configured';
  try {
    const u = new URL(raw);
    return `${u.hostname}:${u.port || '5432'}`;
  } catch (e) {
    // The value holds a password, so describe its shape rather than print it.
    // These four are what a connection string pasted by hand gets wrong.
    const faults = [];
    if (!/^postgres(ql)?:\/\//.test(raw)) faults.push('does not start with postgresql:// — something is in front of it, such as psql, a quote mark or DATABASE_URL=');
    if (/\s/.test(raw)) faults.push('contains a space or a line break');
    if (/["']/.test(raw)) faults.push('contains a quote mark');
    if (/[[\]]/.test(raw)) faults.push('still has the [YOUR-PASSWORD] placeholder brackets');
    return 'unusable connection string: it ' + (faults.join('; it ') || 'could not be parsed');
  }
}

const POOLER_NOTE = 'Supabase answers a direct connection over IPv6 only — use the transaction pooler on port 6543.';
const DB_HINTS = {
  '28P01': 'The password in DATABASE_URL was rejected. A password with @ : / # in it has to be percent-encoded.',
  '3D000': 'That database name does not exist on the server.',
  ENOTFOUND: 'That hostname does not resolve. Check it was copied whole.',
  ETIMEDOUT: `The host never answered. ${POOLER_NOTE}`,
  ENETUNREACH: `There is no route to that host. ${POOLER_NOTE}`,
  ECONNREFUSED: 'Nothing is listening on that port.'
};

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: dbTarget() });
  } catch (e) {
    console.error('health: database unreachable —', e.code || '', e.message);
    res.status(503).json({
      ok: false, error: 'database unreachable', db: dbTarget(),
      code: e.code || '', hint: DB_HINTS[e.code] || e.message
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api', orderRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

module.exports = app;
