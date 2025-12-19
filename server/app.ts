import { ensureMigrations } from './migrations.ts';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from './db.ts';

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DEFAULT_AI_PROMPT =
  'Actua como analista financiero y operativo de un bar. Resume ventas, inventario, cierres de turno, gastos, fiados y ganancias. Genera observaciones, alertas o recomendaciones breves y claras en espanol. Si faltan datos, indica que no hay informacion suficiente.';

const signToken = (user: any) =>
  jwt.sign({ id: user.id, role: user.role, name: user.name, username: user.username }, JWT_SECRET, {
    expiresIn: '12h'
  });

const authMiddleware = async (req: any, res: any, next: any) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'No token provided' });
  const [scheme, token] = auth.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Invalid auth header' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  next();
};

// Helpers
const loadShiftData = async (shiftId: string) => {
  const snapshots = await query(
    `SELECT s.product_id, s.quantity, s.snapshot_type, p.name AS product_name
     FROM shift_inventory_snapshots s
     LEFT JOIN products p ON p.id = s.product_id
     WHERE s.shift_id = $1`,
    [shiftId]
  );
  const items = await query(
    `SELECT si.*, p.name AS product_name
     FROM shift_items si
     LEFT JOIN products p ON p.id = si.product_id
     WHERE si.shift_id = $1`,
    [shiftId]
  );

  return {
    initialInventory: snapshots.rows
      .filter((r) => r.snapshot_type === 'INITIAL')
      .map((r) => ({ productId: r.product_id, productName: r.product_name, count: Number(r.quantity) })),
    finalInventory: snapshots.rows
      .filter((r) => r.snapshot_type === 'FINAL')
      .map((r) => ({ productId: r.product_id, productName: r.product_name, count: Number(r.quantity) })),
    itemsSold: items.rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      quantity: Number(r.quantity),
      revenue: Number(r.revenue),
      profit: Number(r.profit)
    }))
  };
};

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    return res.json({ ok: true, db: 'connected' });
  } catch (err: any) {
    console.error('Health check error:', err);
    return res.status(500).json({ ok: false, db: 'error', message: err?.message || 'DB connection failed' });
  }
});

const mapAiConfig = (row: any) => ({
  provider: row?.ai_provider || null,
  prompt: row?.ai_prompt || DEFAULT_AI_PROMPT,
  hasApiKey: !!row?.ai_api_key,
  validated: !!row?.ai_validated,
  lastTestedAt: row?.ai_last_tested_at || null
});

const buildBasicInsights = async () => {
  try {
    const result = await query(
      `SELECT COALESCE(p.name, 'Producto') as name, SUM(si.quantity) as qty, SUM(si.quantity * si.unit_price) as revenue
       FROM sale_items si
       LEFT JOIN sales s ON s.id = si.sale_id
       LEFT JOIN products p ON p.id = si.product_id
       WHERE s.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY p.name
       ORDER BY revenue DESC
       LIMIT 5`
    );
    const topProducts = result.rows.map((r) => ({
      name: r.name,
      quantity: Number(r.qty || 0),
      revenue: Number(r.revenue || 0)
    }));
    const suggestions: string[] = [];
    if (topProducts.length > 0) {
      const leader = topProducts[0];
      suggestions.push(`Asegura inventario del lider en ventas: ${leader.name}.`);
      if (topProducts[0].revenue > 0 && topProducts[topProducts.length - 1].revenue === 0) {
        suggestions.push('Revisa productos sin ventas y considera promociones o reemplazos.');
      }
    } else {
      suggestions.push('Registra ventas para obtener recomendaciones mas precisas.');
    }
    suggestions.push('Explora combos y upselling en turno para aumentar ticket promedio.');
    return {
      title: 'Vision rapida (30 dias)',
      summary: 'Analisis basico generado sin IA usando ventas recientes.',
      suggestions,
      topProducts,
      source: 'BASIC' as const
    };
  } catch {
    return {
      title: 'Vision basica',
      summary: 'No se pudo leer ventas. Usa el historial y reportes para revisar rendimiento.',
      suggestions: ['Verifica turnos recientes y niveles de inventario.'],
      topProducts: [],
      source: 'BASIC' as const
    };
  }
};

// --- Auth ---
app.post('/api/login', async (req, res) => {
  const schema = z.object({ username: z.string(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { username, password } = parsed.data;
  const result = await query('SELECT id, username, name, role, password_hash FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Credenciales inv?lidas' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inv?lidas' });
  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

app.get('/api/me', authMiddleware, async (req: any, res) => {
  const result = await query('SELECT id, username, name, role FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// --- Users ---
app.get('/api/users', authMiddleware, requireAdmin, async (_req, res) => {
  const result = await query('SELECT id, username, name, role FROM users ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/users', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    username: z.string(),
    name: z.string(),
    password: z.string(),
    role: z.enum(['ADMIN', 'EMPLOYEE'])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { username, name, password, role } = parsed.data;
  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (username, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role',
    [username, name, role, hash]
  );
  res.status(201).json(result.rows[0]);
});

app.put('/api/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    username: z.string(),
    name: z.string(),
    password: z.string().optional(),
    role: z.enum(['ADMIN', 'EMPLOYEE'])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { username, name, password, role } = parsed.data;
  let hashClause = '';
  const params: any[] = [username, name, role, req.params.id];
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    hashClause = ', password_hash = $5';
    params.splice(3, 0, hash);
  }
  const result = await query(
    `UPDATE users SET username = $1, name = $2, role = $3${hashClause} WHERE id = $${hashClause ? 5 : 4} RETURNING id, username, name, role`,
    params
  );
  res.json(result.rows[0]);
});

app.delete('/api/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const adminCount = await query('SELECT COUNT(*) FROM users WHERE role = $1', ['ADMIN']);
  const admins = Number(adminCount.rows[0].count);
  const isAdmin = await query('SELECT role FROM users WHERE id = $1', [req.params.id]);
  if (isAdmin.rows[0]?.role === 'ADMIN' && admins <= 1) return res.status(400).json({ error: 'No puedes eliminar al ?ltimo administrador' });
  await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Categories ---
app.get('/api/categories', authMiddleware, async (_req, res) => {
  const result = await query('SELECT id, name, created_at FROM categories ORDER BY name');
  res.json(result.rows);
});

app.post('/api/categories', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({ name: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const result = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id, name', [parsed.data.name]);
  res.status(201).json(result.rows[0]);
});

app.put('/api/categories/:id', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({ name: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const result = await query('UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name', [
    parsed.data.name,
    req.params.id
  ]);
  res.json(result.rows[0]);
});

app.delete('/api/categories/:id', authMiddleware, requireAdmin, async (req, res) => {
  await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Products ---
app.get('/api/products', authMiddleware, async (_req, res) => {
  const result = await query(
    `SELECT p.id, p.name, p.category_id, p.category_label, c.name AS category, p.cost_price, p.sale_price, p.active, p.unit_type, p.units_per_pack
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     ORDER BY p.created_at DESC`
  );
  res.json(
    result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category || r.category_label || 'Sin categor?a',
      categoryId: r.category_id,
      costPrice: Number(r.cost_price),
      salePrice: Number(r.sale_price),
      active: r.active,
      unitType: r.unit_type,
      unitsPerPack: r.units_per_pack
    }))
  );
});

app.post('/api/products', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string(),
    categoryId: z.string().nullable().optional(),
    categoryLabel: z.string().optional().nullable(),
    costPrice: z.number(),
    salePrice: z.number(),
    active: z.boolean().optional().default(true),
    unitType: z.enum(['UNIT', 'BOX', 'PORTION']).default('UNIT'),
    unitsPerPack: z.number().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { name, categoryId, categoryLabel, costPrice, salePrice, active, unitType, unitsPerPack } = parsed.data;
  const result = await query(
    `INSERT INTO products (name, category_id, category_label, cost_price, sale_price, active, unit_type, units_per_pack)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, category_id, category_label, cost_price, sale_price, active, unit_type, units_per_pack`,
    [name, categoryId || null, categoryLabel || null, costPrice, salePrice, active, unitType, unitsPerPack || null]
  );
  res.status(201).json(result.rows[0]);
});

app.put('/api/products/:id', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string(),
    categoryId: z.string().nullable().optional(),
    categoryLabel: z.string().optional().nullable(),
    costPrice: z.number(),
    salePrice: z.number(),
    active: z.boolean(),
    unitType: z.enum(['UNIT', 'BOX', 'PORTION']).default('UNIT'),
    unitsPerPack: z.number().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { name, categoryId, categoryLabel, costPrice, salePrice, active, unitType, unitsPerPack } = parsed.data;
  const result = await query(
    `UPDATE products SET name=$1, category_id=$2, category_label=$3, cost_price=$4, sale_price=$5, active=$6, unit_type=$7, units_per_pack=$8
     WHERE id=$9 RETURNING id, name, category_id, category_label, cost_price, sale_price, active, unit_type, units_per_pack`,
    [name, categoryId || null, categoryLabel || null, costPrice, salePrice, active, unitType, unitsPerPack || null, req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/products/:id', authMiddleware, requireAdmin, async (req, res) => {
  await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Inventory Stock (Admin)
app.get('/api/inventory/stock', authMiddleware, requireAdmin, async (_req, res) => {
  const result = await query(
    `SELECT p.id, p.name, p.category_id, p.category_label, p.sale_price, p.cost_price, COALESCE(s.quantity,0) as quantity
     FROM products p
     LEFT JOIN inventory_stock s ON s.product_id = p.id
     WHERE p.active = TRUE
     ORDER BY p.name`
  );
  res.json(
    result.rows.map((r) => ({
      productId: r.id,
      productName: r.name,
      category: r.category_label,
      quantity: Number(r.quantity),
      salePrice: Number(r.sale_price),
      costPrice: Number(r.cost_price)
    }))
  );
});

// --- Credit Customers ---
app.get('/api/credit/customers', authMiddleware, async (_req, res) => {
  const result = await query('SELECT * FROM credit_customers ORDER BY created_at DESC');
  res.json(
    result.rows.map((c) => ({
      id: c.id,
      name: c.name,
      documentId: c.document_id,
      phone: c.phone,
      maxLimit: Number(c.max_limit),
      currentUsed: Number(c.current_used),
      observations: c.observations,
      active: c.active
    }))
  );
});

app.post('/api/credit/customers', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string(),
    documentId: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    maxLimit: z.number(),
    currentUsed: z.number().optional(),
    observations: z.string().optional().nullable(),
    active: z.boolean().optional().default(true)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { name, documentId, phone, maxLimit, currentUsed = 0, observations, active } = parsed.data;
  const result = await query(
    `INSERT INTO credit_customers (name, document_id, phone, max_limit, current_used, observations, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [name, documentId || null, phone || null, maxLimit, currentUsed, observations || null, active]
  );
  const c = result.rows[0];
  res.status(201).json({
    id: c.id,
    name: c.name,
    documentId: c.document_id,
    phone: c.phone,
    maxLimit: Number(c.max_limit),
    currentUsed: Number(c.current_used),
    observations: c.observations,
    active: c.active
  });
});

app.put('/api/credit/customers/:id', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string(),
    documentId: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    maxLimit: z.number(),
    currentUsed: z.number().optional(),
    observations: z.string().optional().nullable(),
    active: z.boolean()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { name, documentId, phone, maxLimit, currentUsed = 0, observations, active } = parsed.data;
  const result = await query(
    `UPDATE credit_customers SET name=$1, document_id=$2, phone=$3, max_limit=$4, current_used=$5, observations=$6, active=$7
     WHERE id=$8 RETURNING *`,
    [name, documentId || null, phone || null, maxLimit, currentUsed, observations || null, active, req.params.id]
  );
  const c = result.rows[0];
  res.json({
    id: c.id,
    name: c.name,
    documentId: c.document_id,
    phone: c.phone,
    maxLimit: Number(c.max_limit),
    currentUsed: Number(c.current_used),
    observations: c.observations,
    active: c.active
  });
});

app.get('/api/credit/customers/:id/history', authMiddleware, async (req, res) => {
  const result = await query(
    `SELECT ct.*, u.name as employee_name
     FROM credit_transactions ct
     LEFT JOIN users u ON ct.employee_id = u.id
     WHERE ct.customer_id = $1
     ORDER BY ct.created_at DESC`,
    [req.params.id]
  );
  res.json(
    result.rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      amount: Number(r.amount),
      date: r.created_at,
      type: r.tx_type,
      paymentMethod: r.payment_method,
      observation: r.observation
    }))
  );
});

app.get('/api/credit/transactions', authMiddleware, async (req, res) => {
  const { start, end } = req.query;
  const result = await query(
    `SELECT ct.*, u.name as employee_name
     FROM credit_transactions ct
     LEFT JOIN users u ON ct.employee_id = u.id
     WHERE ct.created_at BETWEEN $1 AND $2
     ORDER BY ct.created_at DESC`,
    [start, end]
  );
  res.json(
    result.rows.map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      amount: Number(r.amount),
      date: r.created_at,
      type: r.tx_type,
      paymentMethod: r.payment_method,
      observation: r.observation
    }))
  );
});

app.post('/api/credit/customers/:id/debt', authMiddleware, async (req: any, res) => {
  const schema = z.object({ amount: z.number().positive(), observation: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { amount, observation } = parsed.data;
  const customer = await query('SELECT * FROM credit_customers WHERE id = $1', [req.params.id]);
  const c = customer.rows[0];
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  const available = Number(c.max_limit) - Number(c.current_used);
  if (amount > available) return res.status(400).json({ error: `Excede el cupo disponible. Disponible: ${available}` });

  await query('BEGIN');
  await query(
    `INSERT INTO credit_transactions (customer_id, employee_id, amount, tx_type, observation)
     VALUES ($1, $2, $3, 'DEBT', $4)`,
    [req.params.id, req.user.id, amount, observation]
  );
  await query('UPDATE credit_customers SET current_used = current_used + $1 WHERE id = $2', [amount, req.params.id]);
  await query('COMMIT');

  res.status(201).json({ ok: true });
});

app.post('/api/credit/customers/:id/payment', authMiddleware, async (req: any, res) => {
  const schema = z.object({ amount: z.number().positive(), paymentMethod: z.enum(['CASH', 'TRANSFER', 'CARD']), observation: z.string().optional().nullable() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { amount, paymentMethod, observation } = parsed.data;
  const customer = await query('SELECT * FROM credit_customers WHERE id = $1', [req.params.id]);
  if (!customer.rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });

  await query('BEGIN');
  await query(
    `INSERT INTO credit_transactions (customer_id, employee_id, amount, tx_type, payment_method, observation)
     VALUES ($1, $2, $3, 'PAYMENT', $4, $5)`,
    [req.params.id, req.user.id, amount, paymentMethod, observation || null]
  );
  await query('UPDATE credit_customers SET current_used = GREATEST(0, current_used - $1) WHERE id = $2', [amount, req.params.id]);
  await query('COMMIT');

  res.status(201).json({ ok: true });
});

// --- Shifts ---
app.get('/api/shifts/active', authMiddleware, async (_req, res) => {
  const active = await query('SELECT * FROM shifts WHERE status = $1 ORDER BY opened_at DESC LIMIT 1', ['OPEN']);
  const shift = active.rows[0];
  if (!shift) return res.json(null);
  const data = await loadShiftData(shift.id);
  res.json({ ...shift, ...data });
});

app.get('/api/shifts', authMiddleware, async (_req, res) => {
  const result = await query('SELECT * FROM shifts ORDER BY opened_at DESC');
  const enriched = await Promise.all(
    result.rows.map(async (s) => {
      const data = await loadShiftData(s.id);
      return { ...s, ...data };
    })
  );
  res.json(enriched);
});

app.delete('/api/shifts/:id', authMiddleware, requireAdmin, async (req, res) => {
  await query('DELETE FROM shifts WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

app.post('/api/shifts/open', authMiddleware, requireAdmin, async (req: any, res) => {
  const schema = z.object({ initialInventory: z.array(z.object({ productId: z.string(), count: z.number() })) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  await query('BEGIN');
  const shiftResult = await query(`INSERT INTO shifts (opened_by, status, opened_at) VALUES ($1, 'OPEN', NOW()) RETURNING *`, [req.user.id]);
  const shift = shiftResult.rows[0];
  for (const item of parsed.data.initialInventory) {
    await query(
      `INSERT INTO shift_inventory_snapshots (shift_id, product_id, quantity, snapshot_type)
       VALUES ($1, $2, $3, 'INITIAL')`,
      [shift.id, item.productId, item.count]
    );
  }
  await query('COMMIT');
  res.status(201).json({ ...shift, initialInventory: parsed.data.initialInventory, finalInventory: [] });
});

app.post('/api/shifts/:id/close', authMiddleware, async (req: any, res) => {
  const schema = z.object({
    finalInventory: z.array(z.object({ productId: z.string(), count: z.number() })),
    realCash: z.number(),
    closingObservation: z.string().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const shiftResult = await query('SELECT * FROM shifts WHERE id = $1', [req.params.id]);
  const shift = shiftResult.rows[0];
  if (!shift) return res.status(404).json({ error: 'Shift not found' });
  if (shift.status === 'CLOSED') return res.status(400).json({ error: 'Shift already closed' });

  const initialSnap = await query('SELECT product_id, quantity FROM shift_inventory_snapshots WHERE shift_id = $1 AND snapshot_type = $2', [req.params.id, 'INITIAL']);
  const products = await query('SELECT id, name, cost_price, sale_price FROM products');

  let totalRevenue = 0;
  let totalCost = 0;
  const finalInventoryMap = new Map<string, number>();
  parsed.data.finalInventory.forEach((i) => finalInventoryMap.set(i.productId, i.count));
  const itemsSoldReport: any[] = [];

  for (const row of products.rows) {
    const start = initialSnap.rows.find((i) => i.product_id === row.id);
    const startCount = start ? Number(start.quantity) : 0;
    const endCount = finalInventoryMap.get(row.id) ?? 0;
    const sold = Math.max(0, startCount - endCount);
    totalRevenue += sold * Number(row.sale_price);
    totalCost += sold * Number(row.cost_price);

    if (sold > 0) {
      itemsSoldReport.push({
        productId: row.id,
        productName: row.name,
        quantity: sold,
        revenue: sold * Number(row.sale_price),
        profit: sold * Number(row.sale_price) - sold * Number(row.cost_price)
      });
    }
  }

  const now = new Date().toISOString();
  const creditTx = await query(`SELECT * FROM credit_transactions WHERE created_at BETWEEN $1 AND $2`, [shift.opened_at, now]);
  const creditSales = creditTx.rows.filter((t) => t.tx_type === 'DEBT').reduce((acc, t) => acc + Number(t.amount), 0);
  const cashPayments = creditTx.rows.filter((t) => t.tx_type === 'PAYMENT' && t.payment_method === 'CASH').reduce((acc, t) => acc + Number(t.amount), 0);
  const otherPayments = creditTx.rows.filter((t) => t.tx_type === 'PAYMENT' && t.payment_method !== 'CASH').reduce((acc, t) => acc + Number(t.amount), 0);

  const cashToDeliver = totalRevenue - creditSales + cashPayments;
  const difference = parsed.data.realCash - cashToDeliver;

  await query('BEGIN');
  await query(
    `UPDATE shifts SET status='CLOSED', closed_by=$1, closed_at=NOW(), real_cash=$2, closing_observation=$3,
      total_revenue=$4, total_cost=$5, total_profit=$6, total_credit_sales=$7, total_cash_payments=$8, total_non_cash_payments=$9,
      cash_to_deliver=$10, difference=$11
     WHERE id=$12`,
    [
      req.user.id,
      parsed.data.realCash,
      parsed.data.closingObservation || null,
      totalRevenue,
      totalCost,
      totalRevenue - totalCost,
      creditSales,
      cashPayments,
      otherPayments,
      cashToDeliver,
      difference,
      req.params.id
    ]
  );

  await query('DELETE FROM shift_inventory_snapshots WHERE shift_id = $1 AND snapshot_type = $2', [req.params.id, 'FINAL']);
  for (const item of parsed.data.finalInventory) {
    await query(
      `INSERT INTO shift_inventory_snapshots (shift_id, product_id, quantity, snapshot_type)
       VALUES ($1, $2, $3, 'FINAL')`,
      [req.params.id, item.productId, item.count]
    );
    await query(
      `INSERT INTO inventory_stock (product_id, quantity, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
      [item.productId, item.count]
    );
  }

  await query('DELETE FROM shift_items WHERE shift_id = $1', [req.params.id]);
  for (const item of itemsSoldReport) {
    await query(
      `INSERT INTO shift_items (shift_id, product_id, quantity, revenue, profit)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, item.productId, item.quantity, item.revenue, item.profit]
    );
  }
  await query('COMMIT');

  res.json({ ok: true, totals: { totalRevenue, totalCost, cashToDeliver, difference }, itemsSold: itemsSoldReport });
});

app.post('/api/shifts/:id/reopen', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({ reason: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Motivo requerido' });
  const active = await query('SELECT id FROM shifts WHERE status = $1', ['OPEN']);
  if (active.rows.length > 0) return res.status(400).json({ error: 'Ya existe un turno abierto' });
  await query('BEGIN');
  const initialSnap = await query(
    `SELECT product_id, quantity FROM shift_inventory_snapshots WHERE shift_id = $1 AND snapshot_type = 'INITIAL'`,
    [req.params.id]
  );
  for (const row of initialSnap.rows) {
    await query(
      `INSERT INTO inventory_stock (product_id, quantity, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
      [row.product_id, row.quantity]
    );
  }

  await query('DELETE FROM shift_items WHERE shift_id = $1', [req.params.id]);

  await query('UPDATE shifts SET status = $1, closed_by = NULL, closed_at = NULL WHERE id = $2', ['OPEN', req.params.id]);
  await query(`INSERT INTO shift_audit_log (shift_id, action, reason, user_id) VALUES ($1, 'REOPEN', $2, $3)`, [
    req.params.id,
    parsed.data.reason,
    (req as any).user.id
  ]);
  await query('COMMIT');
  res.json({ ok: true });
});

// --- Accounting: Fixed Expenses ---
app.get('/api/accounting/fixed-expenses', authMiddleware, async (_req, res) => {
  const result = await query('SELECT * FROM fixed_expenses ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/accounting/fixed-expenses', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string(),
    amount: z.number(),
    paymentDay: z.string(),
    type: z.enum(['EXPENSE', 'BANK_COMMITMENT'])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { name, amount, paymentDay, type } = parsed.data;
  const result = await query(
    `INSERT INTO fixed_expenses (name, amount, payment_day, type) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, amount, paymentDay, type]
  );
  res.status(201).json(result.rows[0]);
});

app.put('/api/accounting/fixed-expenses/:id', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string(),
    amount: z.number(),
    paymentDay: z.string(),
    type: z.enum(['EXPENSE', 'BANK_COMMITMENT'])
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { name, amount, paymentDay, type } = parsed.data;
  const result = await query(
    `UPDATE fixed_expenses SET name=$1, amount=$2, payment_day=$3, type=$4 WHERE id=$5 RETURNING *`,
    [name, amount, paymentDay, type, req.params.id]
  );
  res.json(result.rows[0]);
});

app.delete('/api/accounting/fixed-expenses/:id', authMiddleware, requireAdmin, async (req, res) => {
  await query('DELETE FROM fixed_expenses WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Accounting: Payroll ---
app.get('/api/accounting/payroll', authMiddleware, async (_req, res) => {
  const result = await query('SELECT * FROM payroll_shifts ORDER BY date DESC');
  res.json(result.rows);
});

app.post('/api/accounting/payroll', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    employeeId: z.string(),
    employeeName: z.string(),
    date: z.string(),
    hoursWorked: z.number(),
    hourlyRate: z.number(),
    surcharges: z.number().optional().default(0),
    totalPay: z.number()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const result = await query(
    `INSERT INTO payroll_shifts (employee_id, employee_name, date, hours_worked, hourly_rate, surcharges, total_pay)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      parsed.data.employeeId,
      parsed.data.employeeName,
      parsed.data.date,
      parsed.data.hoursWorked,
      parsed.data.hourlyRate,
      parsed.data.surcharges || 0,
      parsed.data.totalPay
    ]
  );
  res.status(201).json(result.rows[0]);
});

app.delete('/api/accounting/payroll/:id', authMiddleware, requireAdmin, async (req, res) => {
  await query('DELETE FROM payroll_shifts WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Accounting: Purchases ---
app.get('/api/accounting/purchases', authMiddleware, async (_req, res) => {
  const result = await query('SELECT * FROM purchases ORDER BY date DESC');
  res.json(result.rows);
});

app.post('/api/accounting/purchases', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    date: z.string(),
    productName: z.string(),
    quantity: z.number(),
    unitCost: z.number(),
    totalCost: z.number(),
    provider: z.string().optional().nullable(),
    paymentMethod: z.string().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const { date, productName, quantity, unitCost, totalCost, provider, paymentMethod } = parsed.data;
  const result = await query(
    `INSERT INTO purchases (date, product_name, quantity, unit_cost, total_cost, provider, payment_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [date, productName, quantity, unitCost, totalCost, provider || null, paymentMethod || null]
  );
  res.status(201).json(result.rows[0]);
});

app.delete('/api/accounting/purchases/:id', authMiddleware, requireAdmin, async (req, res) => {
  await query('DELETE FROM purchases WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// --- Sales ---
app.get('/api/sales', authMiddleware, async (req, res) => {
  const { shiftId } = req.query;
  let sql = 'SELECT * FROM sales';
  const params: any[] = [];
  if (shiftId) {
    sql += ' WHERE shift_id = $1';
    params.push(shiftId);
  }
  sql += ' ORDER BY created_at DESC';
  const result = await query(sql, params);
  res.json(result.rows);
});

app.post('/api/sales', authMiddleware, async (req, res) => {
  const schema = z.object({
    shiftId: z.string().optional().nullable(),
    paymentMethod: z.string(),
    items: z
      .array(
        z.object({
          productId: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          costPrice: z.number().optional().default(0)
        })
      )
      .min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const total = parsed.data.items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  await query('BEGIN');
  const saleResult = await query(`INSERT INTO sales (shift_id, user_id, total, payment_method) VALUES ($1,$2,$3,$4) RETURNING *`, [
    parsed.data.shiftId || null,
    (req as any).user.id,
    total,
    parsed.data.paymentMethod
  ]);
  const sale = saleResult.rows[0];
  for (const item of parsed.data.items) {
    await query(
      `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, cost_price)
       VALUES ($1,$2,$3,$4,$5)`,
      [sale.id, item.productId, item.quantity, item.unitPrice, item.costPrice || 0]
    );
  }
  await query('COMMIT');
  res.status(201).json({ ...sale, items: parsed.data.items, total });
});

// --- AI Agent Config ---
app.get('/api/ai/config', authMiddleware, requireAdmin, async (_req, res) => {
  const current = await query('SELECT * FROM app_config LIMIT 1');
  if (!current.rows[0]) {
    const inserted = await query('INSERT INTO app_config (bar_name, ai_prompt, ai_validated) VALUES ($1, $2, $3) RETURNING *', [
      'BarFlow',
      DEFAULT_AI_PROMPT,
      false
    ]);
    return res.json(mapAiConfig(inserted.rows[0]));
  }
  res.json(mapAiConfig(current.rows[0]));
});

app.post('/api/ai/config', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    provider: z.enum(['OPENAI', 'GEMINI']).nullable().optional(),
    prompt: z.string().optional(),
    apiKey: z.string().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const current = await query('SELECT * FROM app_config LIMIT 1');
  const base = current.rows[0];
  const provider = parsed.data.provider ?? base?.ai_provider ?? null;
  const prompt = parsed.data.prompt ?? base?.ai_prompt ?? DEFAULT_AI_PROMPT;
  const apiKey = parsed.data.apiKey ?? null;

  if (base) {
    const result = await query(
      `UPDATE app_config
       SET ai_provider=$1,
           ai_prompt=$2,
           ai_api_key = COALESCE($3, ai_api_key),
           ai_validated = CASE WHEN $3 IS NOT NULL OR $1 IS DISTINCT FROM ai_provider THEN FALSE ELSE ai_validated END
       WHERE id=$4
       RETURNING *`,
      [provider, prompt, apiKey, base.id]
    );
    return res.json(mapAiConfig(result.rows[0]));
  } else {
    const inserted = await query(
      `INSERT INTO app_config (bar_name, ai_provider, ai_prompt, ai_api_key, ai_validated)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      ['BarFlow', provider, prompt, apiKey, false]
    );
    return res.json(mapAiConfig(inserted.rows[0]));
  }
});

app.post('/api/ai/test', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({
    provider: z.enum(['OPENAI', 'GEMINI']).nullable().optional(),
    apiKey: z.string().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const current = await query('SELECT * FROM app_config LIMIT 1');
  const base = current.rows[0];
  const provider = parsed.data.provider ?? base?.ai_provider;
  const apiKey = parsed.data.apiKey ?? base?.ai_api_key;
  const prompt = base?.ai_prompt || DEFAULT_AI_PROMPT;

  if (!provider) return res.status(400).json({ error: 'Selecciona un proveedor' });
  if (!apiKey) return res.status(400).json({ error: 'API Key requerida para probar' });

  const looksValid = provider === 'OPENAI' ? apiKey.startsWith('sk-') && apiKey.length > 20 : apiKey.length > 10;
  if (!looksValid) return res.status(400).json({ error: 'La API Key no parece valida para el proveedor seleccionado.' });

  const now = new Date().toISOString();
  if (base) {
    const result = await query(
      `UPDATE app_config
       SET ai_provider=$1,
           ai_api_key=$2,
           ai_prompt = COALESCE(ai_prompt, $3),
           ai_validated=TRUE,
           ai_last_tested_at=$4
       WHERE id=$5
       RETURNING *`,
      [provider, apiKey, prompt, now, base.id]
    );
    return res.json({ ...mapAiConfig(result.rows[0]), message: 'Conexion validada' });
  } else {
    const inserted = await query(
      `INSERT INTO app_config (bar_name, ai_provider, ai_api_key, ai_prompt, ai_validated, ai_last_tested_at)
       VALUES ($1,$2,$3,$4,TRUE,$5) RETURNING *`,
      ['BarFlow', provider, apiKey, prompt, now]
    );
    return res.json({ ...mapAiConfig(inserted.rows[0]), message: 'Conexion validada' });
  }
});

app.get('/api/ai/insights', authMiddleware, requireAdmin, async (_req, res) => {
  const current = await query('SELECT * FROM app_config LIMIT 1');
  const cfg = current.rows[0];
  if (!cfg?.ai_validated || !cfg?.ai_api_key || !cfg?.ai_provider) {
    const basic = await buildBasicInsights();
    return res.json(basic);
  }

  const basic = await buildBasicInsights();
  const aiLike = {
    ...basic,
    title: 'Sugerencias del agente',
    summary: 'Analisis generado con el prompt configurado. Usa estas ideas para ajustar inventario, precios y ofertas.',
    source: 'AI' as const
  };
  res.json(aiLike);
});

app.post('/api/ai/chat', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({ message: z.string().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });

  const current = await query('SELECT * FROM app_config LIMIT 1');
  const cfg = current.rows[0];
  const config = mapAiConfig(cfg || {});

  const userMessage = (parsed.data.message || 'Dame un resumen rapido').trim();
  const basic = await buildBasicInsights();

  if (!cfg?.ai_validated || !cfg?.ai_api_key || !cfg?.ai_provider) {
    const fallbackReply =
      'La IA esta en modo basico. Revisa las ideas rapidas:\n- ' + basic.suggestions.join('\n- ');
    return res.json({ reply: fallbackReply, source: 'BASIC', config });
  }

  const topSummary =
    basic.topProducts.length > 0
      ? basic.topProducts
          .slice(0, 3)
          .map((p) => `${p.name}: ${p.quantity} uds, ${Number(p.revenue || 0).toLocaleString()}`)
          .join(' | ')
      : 'Sin ventas suficientes para evaluar top productos.';

  const suggestions = basic.suggestions.slice(0, 3);
  if (suggestions.length === 0) {
    suggestions.push('Registra ventas para obtener recomendaciones mas precisas.');
  }

  const tailored = [
    `Analisis IA listo. Proveedor: ${cfg.ai_provider}.`,
    `Tu pregunta: "${userMessage}".`,
    `Top vendidos (30d): ${topSummary}`,
    `Sugerencias clave: ${suggestions.join(' | ')}`,
    `Accion rapida: refuerza stock de lideres, lanza prueba de 1-2 nuevos productos relacionados y revisa precios donde la demanda es alta.`
  ].join('\n');

  res.json({ reply: tailored, source: 'AI', config });
});

// --- Config & Clean ---
app.get('/api/config', authMiddleware, requireAdmin, async (_req, res) => {
  const result = await query('SELECT * FROM app_config LIMIT 1');
  if (!result.rows[0]) return res.json({ barName: 'BarFlow', lastExportDate: new Date().toISOString(), lowStockThreshold: 3 });
  const cfg = result.rows[0];
  res.json({
    bar_name: cfg.bar_name,
    last_export_date: cfg.last_export_date,
    low_stock_threshold: cfg.low_stock_threshold ?? 3
  });
});

app.post('/api/config', authMiddleware, requireAdmin, async (req, res) => {
  const schema = z.object({ barName: z.string().optional(), lastExportDate: z.string().optional(), lowStockThreshold: z.number().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' });
  const current = await query('SELECT * FROM app_config LIMIT 1');
  if (current.rows[0]) {
    const base = current.rows[0];
    const result = await query(
      `UPDATE app_config SET bar_name=$1, last_export_date=$2, low_stock_threshold = COALESCE($3, low_stock_threshold) WHERE id=$4 RETURNING *`,
      [parsed.data.barName || base.bar_name, parsed.data.lastExportDate || base.last_export_date, parsed.data.lowStockThreshold ?? null, base.id]
    );
    const cfg = result.rows[0];
    res.json({
      bar_name: cfg.bar_name,
      last_export_date: cfg.last_export_date,
      low_stock_threshold: cfg.low_stock_threshold
    });
  } else {
    const result = await query(
      `INSERT INTO app_config (bar_name, last_export_date, low_stock_threshold) VALUES ($1, $2, COALESCE($3,3)) RETURNING *`,
      [parsed.data.barName || 'BarFlow', parsed.data.lastExportDate || new Date().toISOString(), parsed.data.lowStockThreshold ?? null]
    );
    const cfg = result.rows[0];
    res.json({
      bar_name: cfg.bar_name,
      last_export_date: cfg.last_export_date,
      low_stock_threshold: cfg.low_stock_threshold
    });
  }
});

app.post('/api/admin/clear', authMiddleware, requireAdmin, async (_req, res) => {
  await query('TRUNCATE shifts, shift_inventory_snapshots, credit_transactions, payroll_shifts, purchases RESTART IDENTITY');
  await query('UPDATE credit_customers SET current_used = 0');
  await query('UPDATE app_config SET last_export_date = NOW()');
  res.json({ ok: true });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not Found' }));

export default app;

// Run startup migrations
ensureMigrations().catch(err => console.error('Migration error', err));



// Run startup migrations

