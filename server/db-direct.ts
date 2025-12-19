import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('DATABASE_URL_DIRECT/DATABASE_URL not set. Migrations will fail without a database connection.');
}

try {
  const url = new URL(connectionString || '');
  const hostInfo = `${url.hostname}:${url.port || '5432'}${url.pathname}`;
  const sslmode = url.searchParams.get('sslmode') || 'none';
  console.info(`[DB-DIRECT] Using host ${hostInfo} sslmode=${sslmode}`);
} catch {
  console.warn('[DB-DIRECT] Invalid connection string format');
}

export const directPool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 20000,
  keepAlive: true
});

directPool.on('error', (err) => {
  console.error('Postgres direct pool error', err);
});
