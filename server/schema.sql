-- Enable extensions for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN','EMPLOYEE')),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    category_label TEXT,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    unit_type TEXT NOT NULL DEFAULT 'UNIT' CHECK (unit_type IN ('UNIT','BOX','PORTION')),
    units_per_pack NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- SHIFTS
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opened_by UUID REFERENCES users(id),
    closed_by UUID REFERENCES users(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
    real_cash NUMERIC(14,2),
    closing_observation TEXT,
    total_revenue NUMERIC(14,2),
    total_cost NUMERIC(14,2),
    total_profit NUMERIC(14,2),
    total_credit_sales NUMERIC(14,2),
    total_cash_payments NUMERIC(14,2),
    total_non_cash_payments NUMERIC(14,2),
    cash_to_deliver NUMERIC(14,2),
    difference NUMERIC(14,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- SHIFT INVENTORY SNAPSHOTS
CREATE TABLE IF NOT EXISTS shift_inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('INITIAL','FINAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (shift_id, product_id, snapshot_type)
);

-- CURRENT INVENTORY STOCK
CREATE TABLE IF NOT EXISTS inventory_stock (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SHIFT ITEM DETAIL (sold quantities)
CREATE TABLE IF NOT EXISTS shift_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
    revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
    profit NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shift_items_shift ON shift_items(shift_id);

-- SHIFT AUDIT LOG
CREATE TABLE IF NOT EXISTS shift_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SALES
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id),
    total NUMERIC(14,2) NOT NULL,
    payment_method TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity NUMERIC(14,2) NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL,
    cost_price NUMERIC(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- CREDIT / FIAO
CREATE TABLE IF NOT EXISTS credit_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    document_id TEXT,
    phone TEXT,
    max_limit NUMERIC(14,2) NOT NULL DEFAULT 0,
    current_used NUMERIC(14,2) NOT NULL DEFAULT 0,
    observations TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES credit_customers(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES users(id),
    amount NUMERIC(14,2) NOT NULL,
    tx_type TEXT NOT NULL CHECK (tx_type IN ('DEBT','PAYMENT')),
    payment_method TEXT,
    observation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer ON credit_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at);

-- FIXED EXPENSES / BANK COMMITMENTS
CREATE TABLE IF NOT EXISTS fixed_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    payment_day TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EXPENSE','BANK_COMMITMENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PAYROLL / WORK SHIFTS
CREATE TABLE IF NOT EXISTS payroll_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES users(id),
    employee_name TEXT NOT NULL,
    date DATE NOT NULL,
    hours_worked NUMERIC(8,2) NOT NULL,
    hourly_rate NUMERIC(14,2) NOT NULL,
    surcharges NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_pay NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payroll_date ON payroll_shifts(date);

-- PURCHASES
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    product_name TEXT NOT NULL,
    quantity NUMERIC(14,2) NOT NULL,
    unit_cost NUMERIC(14,2) NOT NULL,
    total_cost NUMERIC(14,2) NOT NULL,
    provider TEXT,
    payment_method TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);

-- APP CONFIG
CREATE TABLE IF NOT EXISTS app_config (
    id SERIAL PRIMARY KEY,
    bar_name TEXT NOT NULL DEFAULT 'BarFlow',
    last_export_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    low_stock_threshold NUMERIC(10,2) NOT NULL DEFAULT 3,
    ai_provider TEXT,
    ai_api_key TEXT,
    ai_prompt TEXT,
    ai_validated BOOLEAN NOT NULL DEFAULT FALSE,
    ai_last_tested_at TIMESTAMPTZ
);

-- SEEDS
DO $$
DECLARE
    admin_exists BOOLEAN;
    default_config_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM users WHERE username = 'admin') INTO admin_exists;
    IF NOT admin_exists THEN
        INSERT INTO users (username, name, role, password_hash)
        VALUES ('admin', 'Administrador Principal', 'ADMIN', '$2a$10$kR7x1YgnSUZXoqBYwygJyOQ1OtSWT8gJtIhXCTITVEWil/92pT9X6'); -- password: 123
    END IF;

    SELECT EXISTS(SELECT 1 FROM app_config) INTO default_config_exists;
    IF NOT default_config_exists THEN
        INSERT INTO app_config (bar_name) VALUES ('Mi Bar Genial');
    END IF;
END$$;
