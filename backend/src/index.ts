import 'dotenv/config';
import app from './app.js';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './db/client.js';

const PORT = process.env.PORT || 3001;

async function start() {
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations complete.');
  } catch (e) {
    console.error('Migrations failed:', e);
  }

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch(console.error);
