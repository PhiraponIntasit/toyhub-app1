CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  line TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Figures',
  scale TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'In stock' CHECK (status IN ('In stock', 'Pre-order', 'Sold out')),
  release_window TEXT NOT NULL DEFAULT '',
  edition TEXT NOT NULL DEFAULT '',
  featured BOOLEAN NOT NULL DEFAULT false,
  featured_at BIGINT NOT NULL DEFAULT 0,
  images TEXT[] NOT NULL DEFAULT '{}',
  stock INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlist (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  handled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  ref TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  subtotal INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  balance INTEGER NOT NULL DEFAULT 0,
  card_last4 TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (status IN ('Confirmed', 'Producing', 'Ready to ship', 'Completed', 'Cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_intent_id TEXT NOT NULL DEFAULT '',
  tracking TEXT NOT NULL DEFAULT '',
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_ref TEXT NOT NULL REFERENCES orders(ref) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  unit_due INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'full' CHECK (mode IN ('deposit', 'full')),
  status TEXT NOT NULL,
  release_window TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS email_log (
  id SERIAL PRIMARY KEY,
  order_ref TEXT NOT NULL REFERENCES orders(ref) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('confirmation', 'tracking')),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS order_items_order_ref_idx ON order_items(order_ref);
CREATE INDEX IF NOT EXISTS email_log_order_ref_idx ON email_log(order_ref);
