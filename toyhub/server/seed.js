const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool, target } = require('./db');
const { SEED_PRODUCTS, SEED_ADMIN, SEED_CUSTOMER } = require('./lib/seed');

// A password that came from the environment is the deployment's own, and the
// terminal it is printed in is shared over someone's shoulder often enough.
const shown = (account) => (process.env.ADMIN_PASSWORD && account.role === 'admin' ? '(the one in ADMIN_PASSWORD)' : account.password);

async function seedAccount(account) {
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [account.email]);
  if (rows.length) {
    console.log(account.role === 'admin' ? 'Admin' : 'Demo customer', 'account already present, skipping');
    return;
  }
  const hash = await bcrypt.hash(account.password, 10);
  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, phone, address, role) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [crypto.randomUUID(), account.email, hash, account.name, account.phone, account.address, account.role]
  );
  console.log('Seeded', account.role, 'account:', account.email, '/', shown(account));
}

async function seed() {
  console.log('Database:', target());
  const { rows: existing } = await pool.query('SELECT count(*)::int AS n FROM products');
  if (existing[0].n === 0) {
    for (const p of SEED_PRODUCTS) {
      await pool.query(
        `INSERT INTO products (id, name, line, category, scale, price, status, release_window, featured, featured_at, images, stock, description, details, box_w_cm, box_l_cm, box_h_cm, weight_g)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [p.id, p.name, p.line, p.category, p.scale, p.price, p.status, p.release_window, p.featured, p.featured_at, p.images, p.stock, p.description, p.details, p.box_w_cm, p.box_l_cm, p.box_h_cm, p.weight_g]
      );
    }
    console.log('Seeded', SEED_PRODUCTS.length, 'products');
  } else {
    console.log('Products already present, skipping product seed');
  }

  await seedAccount(SEED_ADMIN);
  await seedAccount(SEED_CUSTOMER);
}

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { seed };
