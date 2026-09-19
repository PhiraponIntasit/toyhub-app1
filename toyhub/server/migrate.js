const fs = require('fs');
const path = require('path');
const { pool, target } = require('./db');

async function migrate() {
  console.log('Database:', target());
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log('Running migration', file);
    await pool.query(sql);
  }
  console.log('Migrations complete');
}

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { migrate };
