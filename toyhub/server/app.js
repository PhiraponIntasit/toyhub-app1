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

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false, error: 'database unreachable' });
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
