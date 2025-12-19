import { Pool } from 'pg';
import dotenv from 'dotenv';

// Cargar variables desde .env.local (prioridad) o .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL;

let pool: Pool | null = null;

if (!connectionString) {
  console.warn('DATABASE_URL is not set. API routes will fail without a database connection.');
} else {
  // Log host/DB (sin credenciales) para depurar
  try {
    const url = new URL(connectionString || '');
    const hostInfo = `${url.hostname}:${url.port || '5432'}${url.pathname}`;
    const sslmode = url.searchParams.get('sslmode') || 'none';
    console.info(`[DB] Using host ${hostInfo} sslmode=${sslmode}`);
  } catch (e) {
    console.warn('[DB] Invalid DATABASE_URL format');
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 20000,
    keepAlive: true
  });

  pool.on('error', (err) => {
    console.error('Postgres pool error', err);
  });
}

export const query = (text: string, params?: unknown[]) => {
  if (!pool) {
    throw new Error('DATABASE_URL is not configured en el entorno');
  }
  return pool.query(text, params);
};

export const hasDbConnection = () => !!pool;
