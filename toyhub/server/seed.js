const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('./db');
const { SEED_PRODUCTS, SEED_ADMIN } = require('./lib/seed');

async function seed() {
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

  const { rows: adminExisting } = await pool.query('SELECT id FROM users WHERE email = $1', [SEED_ADMIN.email]);
  if (adminExisting.length === 0) {
    const hash = await bcrypt.hash(SEED_ADMIN.password, 10);
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, phone, address, role) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [crypto.randomUUID(), SEED_ADMIN.email, hash, SEED_ADMIN.name, SEED_ADMIN.phone, SEED_ADMIN.address, SEED_ADMIN.role]
    );
    console.log('Seeded admin account:', SEED_ADMIN.email, '/', SEED_ADMIN.password);
  } else {
    console.log('Admin account already present, skipping');
  }
}

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { seed };
