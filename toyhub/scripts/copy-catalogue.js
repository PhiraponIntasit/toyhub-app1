// Copies pieces from one database's catalogue into another's — the shelf built
// up on a laptop, moved to the deployed shop without typing it again.
//
//   node scripts/copy-catalogue.js <source-url> [target-url]
//
// The target defaults to DATABASE_URL. Only the products table is touched, and
// a piece whose id is already on the target is left exactly as it is: the
// script adds, it never overwrites. Orders, customers and wishlists stay where
// they are, since they belong to the shop that took them.
const { Pool } = require('pg');

const COLUMNS = [
  'id', 'name', 'line', 'category', 'scale', 'price', 'status', 'release_window',
  'featured', 'featured_at', 'images', 'stock', 'description', 'details',
  'box_w_cm', 'box_l_cm', 'box_h_cm', 'weight_g'
];

const describe = (url) => {
  try { const u = new URL(url); return `${u.hostname}:${u.port || '5432'}${u.pathname}`; }
  catch (e) { return 'unusable connection string'; }
};

const poolFor = (url) => new Pool({
  connectionString: url,
  ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : { rejectUnauthorized: false },
  max: 2
});

async function main() {
  const [sourceUrl, targetUrl = process.env.DATABASE_URL] = process.argv.slice(2);
  if (!sourceUrl || !targetUrl) {
    console.error('Usage: node scripts/copy-catalogue.js <source-url> [target-url]');
    console.error('The target defaults to DATABASE_URL.');
    process.exit(1);
  }
  if (sourceUrl === targetUrl) {
    console.error('The source and the target are the same database.');
    process.exit(1);
  }

  console.log('From:', describe(sourceUrl));
  console.log('To:  ', describe(targetUrl));

  const source = poolFor(sourceUrl);
  const target = poolFor(targetUrl);
  try {
    const { rows } = await source.query(`SELECT ${COLUMNS.join(', ')} FROM products ORDER BY created_at`);
    const { rows: there } = await target.query('SELECT id FROM products');
    const known = new Set(there.map((r) => r.id));

    let copied = 0;
    for (const row of rows) {
      if (known.has(row.id)) continue;
      await target.query(
        `INSERT INTO products (${COLUMNS.join(', ')})
         VALUES (${COLUMNS.map((_, i) => '$' + (i + 1)).join(', ')})`,
        COLUMNS.map((c) => row[c])
      );
      console.log('  +', row.name);
      copied++;
    }
    console.log(copied ? `Copied ${copied} of ${rows.length} pieces; the rest were already there.`
      : `Nothing to do — all ${rows.length} pieces are already on the target.`);
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });
