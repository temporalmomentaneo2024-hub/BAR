import { directPool } from './db-direct.ts';

export const ensureMigrations = async () => {
  const connString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || '';
  try {
    const url = new URL(connString);
    const hostInfo = `${url.hostname}:${url.port || '5432'}${url.pathname}`;
    const sslmode = url.searchParams.get('sslmode') || 'none';
    console.info(
      `[DB] Running migrations using ${process.env.DATABASE_URL_DIRECT ? 'DATABASE_URL_DIRECT' : 'DATABASE_URL'} host=${hostInfo} sslmode=${sslmode}`
    );
  } catch {
    console.warn('[DB] Running migrations with an unparseable connection string');
  }

  const client = await directPool.connect().catch((err) => {
    console.error('[DB] Migration connect failed', err);
    throw err;
  });

  try {
    // Add category_label to products
    await client.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS category_label TEXT`);

    // Low stock threshold in app_config
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 3`);

    // AI Agent settings
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_provider TEXT`);
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_api_key TEXT`);
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_prompt TEXT`);
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_validated BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_last_tested_at TIMESTAMPTZ`);

    // Inventory stock table
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_stock (
        product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
        quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Shift items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id),
        quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
        revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
        profit NUMERIC(14,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_shift_items_shift ON shift_items(shift_id)`);
  } finally {
    client.release();
  }
};
