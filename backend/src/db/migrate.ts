import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

async function main() {
  console.log('[migrate] Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] Complete.');
  await pool.end();
}

main().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
