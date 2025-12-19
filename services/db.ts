import {
  Product,
  User,
  ShiftSession,
  AppConfig,
  CreditCustomer,
  CreditTransaction,
  PaymentMethod,
  FixedExpense,
  WorkShift,
  Purchase,
  AiAgentConfig,
  AiProvider,
  AiInsight,
  AiChatMessage
} from '../types';
import { STORAGE_KEYS, DEFAULT_AI_PROMPT } from '../constants';

// Resolve API base to avoid hitting the Vite dev server instead of API
const resolveApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return 'http://localhost:3000/api';
  return '/.netlify/functions/api';
};

const API_BASE = resolveApiBase();

const getToken = () => localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || '';

const DEFAULT_AI_CONFIG: AiAgentConfig = {
  provider: null,
  prompt: DEFAULT_AI_PROMPT,
  hasApiKey: false,
  validated: false,
  lastTestedAt: null
};

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}`);
    }
    const text = await res.text().catch(() => '');
    throw new Error(text || `Error ${res.status}`);
  }

  if (contentType.includes('application/json')) {
    return res.json();
  }

  // Unexpected response type
  throw new Error('Unexpected response from server');
};

export const loginUser = async (username: string, password: string) => {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error de autenticaciÃ³n');
  }
  return res.json();
};

// --- Initialization (ping backend) ---
export const initializeDB = async () => {
  await apiFetch('/health', { method: 'GET' });
};

// --- Products ---
export const getProducts = async (): Promise<Product[]> => {
  const data = await apiFetch<any[]>('/products');
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category || p.category_label || 'Sin categoríaa',
    categoryId: p.category_id || null,
    categoryLabel: p.category_label || null,
    costPrice: Number(p.costPrice ?? p.cost_price ?? p.cost_price ?? 0),
    salePrice: Number(p.salePrice ?? p.sale_price ?? p.sale_price ?? 0),
    active: p.active !== false,
    unitType: p.unitType || p.unit_type || 'UNIT',
    unitsPerPack: p.unitsPerPack || p.units_per_pack || null
  }));
};

export const saveProduct = async (product: Product): Promise<void> => {
  const payload = {
    name: product.name,
    categoryId: (product as any).categoryId || product.categoryId || null,
    categoryLabel: (product as any).categoryLabel || product.categoryLabel || product.category || null,
    costPrice: product.costPrice,
    salePrice: product.salePrice,
    active: product.active,
    unitType: (product as any).unitType || 'UNIT',
    unitsPerPack: (product as any).unitsPerPack || product.unitsPerPack || null
  };
  if (product.id) {
    await apiFetch(`/products/${product.id}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await apiFetch('/products', { method: 'POST', body: JSON.stringify(payload) });
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  await apiFetch(`/products/${id}`, { method: 'DELETE' });
};

// --- Users ---
export const getUsers = async (): Promise<User[]> => {
  const data = await apiFetch<any[]>('/users');
  return data.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role
  }));
};

export const saveUser = async (user: User): Promise<void> => {
  const payload: any = {
    username: user.username,
    name: user.name,
    password: user.password || '123',
    role: user.role
  };
  if (user.id) {
    await apiFetch(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) });
  }
};

export const deleteUser = async (id: string): Promise<void> => {
  await apiFetch(`/users/${id}`, { method: 'DELETE' });
};

// --- Sessions (Shifts) ---
const mapShift = (s: any): ShiftSession => ({
  id: s.id,
  openedBy: s.opened_by || s.openedBy,
  closedBy: s.closed_by || s.closedBy,
  openedAt: s.opened_at || s.openedAt,
  closedAt: s.closed_at || s.closedAt,
  status: s.status,
  initialInventory: (s.initialInventory || s.initial_inventory || []).map((i: any) => ({
    productId: i.productId || i.product_id,
    productName: i.productName || i.product_name || '',
    count: Number(i.count ?? i.quantity ?? 0)
  })),
  finalInventory: (s.finalInventory || s.final_inventory || []).map((i: any) => ({
    productId: i.productId || i.product_id,
    productName: i.productName || i.product_name || '',
    count: Number(i.count ?? i.quantity ?? 0)
  })),
  salesReport:
    s.salesReport ||
    (s.total_revenue !== undefined
      ? {
          totalRevenue: Number(s.total_revenue || 0),
          totalCost: Number(s.total_cost || 0),
          totalProfit: Number(s.total_profit || 0),
          totalCreditSales: Number(s.total_credit_sales || 0),
          totalCashPayments: Number(s.total_cash_payments || 0),
          totalNonCashPayments: Number(s.total_non_cash_payments || 0),
          cashToDeliver: Number(s.cash_to_deliver || 0),
          difference: Number(s.difference || 0),
          itemsSold: (s.itemsSold || s.items_sold || []).map((it: any) => ({
            productId: it.productId || it.product_id,
            productName: it.productName || it.product_name,
            quantity: Number(it.quantity),
            revenue: Number(it.revenue || 0),
            profit: Number(it.profit || 0)
          }))
        }
      : undefined),
  realCash: s.real_cash,
  closingObservation: s.closing_observation,
  auditLog: s.auditLog
});

export const getSessions = async (): Promise<ShiftSession[]> => {
  const data = await apiFetch<any[]>('/shifts');
  return data.map(mapShift);
};

export const getActiveSession = async (): Promise<ShiftSession | null> => {
  const data = await apiFetch<any | null>('/shifts/active');
  if (!data) return null;
  return mapShift(data);
};

export const startSession = async (_userId: string, initialInventory: any[]): Promise<ShiftSession> => {
  const res = await apiFetch<any>('/shifts/open', {
    method: 'POST',
    body: JSON.stringify({ initialInventory })
  });
  return mapShift(res);
};

export const closeSession = async (session: ShiftSession): Promise<void> => {
  await apiFetch(`/shifts/${session.id}/close`, {
    method: 'POST',
    body: JSON.stringify({
      finalInventory: session.finalInventory,
      realCash: session.realCash,
      closingObservation: session.closingObservation
    })
  });
};

export const reopenSession = async (sessionId: string, reason: string): Promise<void> => {
  await apiFetch(`/shifts/${sessionId}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
};

export const deleteShift = async (sessionId: string): Promise<void> => {
  await apiFetch(`/shifts/${sessionId}`, { method: 'DELETE' });
};

// --- Credit / Fiao System ---
export const getCreditCustomers = async (): Promise<CreditCustomer[]> => {
  const data = await apiFetch<any[]>('/credit/customers');
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    documentId: c.documentId || c.document_id,
    phone: c.phone,
    maxLimit: Number(c.maxLimit ?? c.max_limit ?? 0),
    currentUsed: Number(c.currentUsed ?? c.current_used ?? 0),
    observations: c.observations,
    active: c.active
  }));
};

export const saveCreditCustomer = async (customer: CreditCustomer): Promise<void> => {
  const payload = {
    name: customer.name,
    documentId: customer.documentId,
    phone: customer.phone,
    maxLimit: customer.maxLimit,
    currentUsed: customer.currentUsed,
    observations: customer.observations,
    active: customer.active
  };
  if (customer.id) {
    await apiFetch(`/credit/customers/${customer.id}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await apiFetch('/credit/customers', { method: 'POST', body: JSON.stringify(payload) });
  }
};

export const getCustomerHistory = async (customerId: string): Promise<CreditTransaction[]> => {
  const data = await apiFetch<any[]>(`/credit/customers/${customerId}/history`);
  return data.map((h) => ({
    id: h.id,
    customerId: h.customerId || h.customer_id,
    employeeId: h.employeeId || h.employee_id,
    employeeName: h.employeeName || h.employee_name,
    amount: Number(h.amount),
    date: h.date || h.created_at,
    type: h.type || h.tx_type,
    paymentMethod: h.paymentMethod || h.payment_method,
    observation: h.observation
  }));
};

export const getTransactionsInRange = async (startDateISO: string, endDateISO: string): Promise<CreditTransaction[]> => {
  const data = await apiFetch<any[]>(
    `/credit/transactions?start=${encodeURIComponent(startDateISO)}&end=${encodeURIComponent(endDateISO)}`
  );
  return data.map((h) => ({
    id: h.id,
    customerId: h.customerId || h.customer_id,
    employeeId: h.employeeId || h.employee_id,
    employeeName: h.employeeName || h.employee_name,
    amount: Number(h.amount),
    date: h.date || h.created_at,
    type: h.type || h.tx_type,
    paymentMethod: h.paymentMethod || h.payment_method,
    observation: h.observation
  }));
};

export const registerCreditTransaction = async (
  customerId: string,
  amount: number,
  observation: string
): Promise<void> => {
  await apiFetch(`/credit/customers/${customerId}/debt`, {
    method: 'POST',
    body: JSON.stringify({ amount, observation })
  });
};

export const registerPaymentTransaction = async (
  customerId: string,
  amount: number,
  method: PaymentMethod,
  observation: string
): Promise<void> => {
  await apiFetch(`/credit/customers/${customerId}/payment`, {
    method: 'POST',
    body: JSON.stringify({ amount, paymentMethod: method, observation })
  });
};

// --- ACCOUNTING MODULE ---
export const getFixedExpenses = async (): Promise<FixedExpense[]> => {
  const data = await apiFetch<any[]>('/accounting/fixed-expenses');
  return data.map((e) => ({
    id: e.id,
    name: e.name,
    amount: Number(e.amount),
    paymentDay: e.payment_day || e.paymentDay,
    type: e.type
  }));
};

export const saveFixedExpense = async (expense: FixedExpense): Promise<void> => {
  const payload = {
    name: expense.name,
    amount: expense.amount,
    paymentDay: expense.paymentDay,
    type: expense.type
  };
  if (expense.id) {
    await apiFetch(`/accounting/fixed-expenses/${expense.id}`, { method: 'PUT', body: JSON.stringify(payload) });
  } else {
    await apiFetch('/accounting/fixed-expenses', { method: 'POST', body: JSON.stringify(payload) });
  }
};

export const deleteFixedExpense = async (id: string): Promise<void> => {
  await apiFetch(`/accounting/fixed-expenses/${id}`, { method: 'DELETE' });
};

// Payroll
export const getPayroll = async (): Promise<WorkShift[]> => {
  const data = await apiFetch<any[]>('/accounting/payroll');
  return data.map((p) => ({
    id: p.id,
    employeeId: p.employee_id,
    employeeName: p.employee_name,
    date: p.date,
    hoursWorked: Number(p.hours_worked),
    hourlyRate: Number(p.hourly_rate),
    surcharges: Number(p.surcharges),
    totalPay: Number(p.total_pay)
  }));
};

export const saveWorkShift = async (shift: WorkShift): Promise<void> => {
  const payload = {
    employeeId: shift.employeeId,
    employeeName: shift.employeeName,
    date: shift.date,
    hoursWorked: shift.hoursWorked,
    hourlyRate: shift.hourlyRate,
    surcharges: shift.surcharges,
    totalPay: shift.totalPay
  };
  await apiFetch('/accounting/payroll', { method: 'POST', body: JSON.stringify(payload) });
};

export const deleteWorkShift = async (id: string): Promise<void> => {
  await apiFetch(`/accounting/payroll/${id}`, { method: 'DELETE' });
};

// Purchases
export const getPurchases = async (): Promise<Purchase[]> => {
  const data = await apiFetch<any[]>('/accounting/purchases');
  return data.map((p) => ({
    id: p.id,
    date: p.date,
    productName: p.product_name || p.productName,
    quantity: Number(p.quantity),
    unitCost: Number(p.unit_cost || p.unitCost),
    totalCost: Number(p.total_cost || p.totalCost),
    observations: p.observations
  }));
};

export const savePurchase = async (purchase: Purchase): Promise<void> => {
  const payload = {
    date: purchase.date,
    productName: purchase.productName,
    quantity: purchase.quantity,
    unitCost: purchase.unitCost,
    totalCost: purchase.totalCost,
    observations: purchase.observations
  };
  await apiFetch('/accounting/purchases', { method: 'POST', body: JSON.stringify(payload) });
};

export const deletePurchase = async (id: string): Promise<void> => {
  await apiFetch(`/accounting/purchases/${id}`, { method: 'DELETE' });
};

// --- AI Agent Config ---
const cacheAiConfig = (cfg: AiAgentConfig) => {
  try {
    localStorage.setItem(STORAGE_KEYS.AI_CONFIG, JSON.stringify(cfg));
  } catch {
    // ignore cache errors
  }
};

const readAiCache = (): AiAgentConfig | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AI_CONFIG);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider ?? null,
      prompt: parsed.prompt || DEFAULT_AI_PROMPT,
      hasApiKey: !!parsed.hasApiKey,
      validated: !!parsed.validated,
      lastTestedAt: parsed.lastTestedAt || parsed.last_tested_at || null
    };
  } catch {
    return null;
  }
};

export const getAiConfig = async (): Promise<AiAgentConfig> => {
  const cached = readAiCache();
  try {
    const cfg = await apiFetch<any>('/ai/config');
    const mapped: AiAgentConfig = {
      provider: cfg.provider ?? null,
      prompt: cfg.prompt || DEFAULT_AI_PROMPT,
      hasApiKey: !!cfg.hasApiKey,
      validated: !!cfg.validated,
      lastTestedAt: cfg.lastTestedAt || cfg.last_tested_at || null
    };
    cacheAiConfig(mapped);
    return mapped;
  } catch {
    return cached || DEFAULT_AI_CONFIG;
  }
};

export const saveAiConfig = async (input: { provider?: AiProvider; prompt?: string; apiKey?: string | null }): Promise<AiAgentConfig> => {
  const body = {
    provider: input.provider ?? null,
    prompt: input.prompt,
    apiKey: input.apiKey ?? undefined
  };
  try {
    const cfg = await apiFetch<any>('/ai/config', { method: 'POST', body: JSON.stringify(body) });
    const mapped: AiAgentConfig = {
      provider: cfg.provider ?? null,
      prompt: cfg.prompt || DEFAULT_AI_PROMPT,
      hasApiKey: !!cfg.hasApiKey,
      validated: !!cfg.validated,
      lastTestedAt: cfg.lastTestedAt || cfg.last_tested_at || null
    };
    cacheAiConfig(mapped);
    return mapped;
  } catch (err) {
    const cached = readAiCache();
    if (cached) return cached;
    throw err;
  }
};

export const testAiConnection = async (
  input?: { provider?: AiProvider | null; apiKey?: string | null }
): Promise<{ ok: boolean; message: string; config?: AiAgentConfig }> => {
  try {
    const data = await apiFetch<any>('/ai/test', {
      method: 'POST',
      body: JSON.stringify({ provider: input?.provider ?? null, apiKey: input?.apiKey ?? null })
    });
    const mapped: AiAgentConfig = {
      provider: data.provider ?? null,
      prompt: data.prompt || DEFAULT_AI_PROMPT,
      hasApiKey: !!data.hasApiKey,
      validated: !!data.validated,
      lastTestedAt: data.lastTestedAt || data.last_tested_at || new Date().toISOString()
    };
    cacheAiConfig(mapped);
    return { ok: true, message: data.message || 'Conexion exitosa', config: mapped };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'No se pudo probar la conexion' };
  }
};

export const isAiEnabled = (cfg?: AiAgentConfig | null) => !!(cfg && cfg.provider && cfg.hasApiKey && cfg.validated);

export const getAiInsights = async (): Promise<AiInsight> => {
  try {
    const res = await apiFetch<AiInsight>('/ai/insights', { method: 'GET' });
    return res;
  } catch (err: any) {
    return {
      title: 'Modo basico',
      summary: 'La IA no esta disponible. Mostrando vision rapida basada en datos existentes.',
      suggestions: [
        'Revisa los productos con mayores ventas y aseguralos en stock.',
        'Evalua subir precio en los productos mas rentables si la demanda se mantiene.',
        'Considera promociones cruzadas para los articulos con menor rotacion.'
      ],
      topProducts: [],
      source: 'BASIC'
    };
  }
};

export const sendAiMessage = async (message: string): Promise<{ reply: AiChatMessage; config?: AiAgentConfig }> => {
  const now = new Date().toISOString();
  try {
    const res = await apiFetch<{ reply: string; source?: 'AI' | 'BASIC'; config?: AiAgentConfig }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    return {
      reply: { role: 'assistant', content: res.reply, ts: now, source: res.source || 'AI' },
      config: res.config
    };
  } catch (err: any) {
    return {
      reply: {
        role: 'assistant',
        content:
          err?.message ||
          'No se pudo responder con IA. Continua operando normalmente; puedes revisar reportes y ventas desde el panel.',
        ts: now,
        source: 'BASIC'
      }
    };
  }
};

// --- Config ---
export const getConfig = async (): Promise<AppConfig> => {
  try {
    const cfg = await apiFetch<any>('/config');
    return {
      barName: cfg.bar_name || cfg.barName || 'BarFlow',
      lastExportDate: cfg.last_export_date || cfg.lastExportDate || new Date().toISOString(),
      lowStockThreshold: Number(cfg.low_stock_threshold ?? cfg.lowStockThreshold ?? 3)
    };
  } catch {
    return { barName: 'BarFlow', lastExportDate: new Date().toISOString(), lowStockThreshold: 3 };
  }
};

export const updateConfig = async (config: Partial<AppConfig>) => {
  await apiFetch('/config', { method: 'POST', body: JSON.stringify(config) });
};

export const clearHistoricalData = async () => {
  await apiFetch('/admin/clear', { method: 'POST' });
};

// Inventory stock (Admin)
export const getInventoryStock = async (): Promise<{ productId: string; productName: string; quantity: number; salePrice: number; costPrice: number }[]> => {
  const data = await apiFetch<any[]>('/inventory/stock');
  return data.map((d) => ({
    productId: d.productId || d.product_id,
    productName: d.productName || d.product_name,
    quantity: Number(d.quantity || 0),
    salePrice: Number(d.salePrice || d.sale_price || 0),
    costPrice: Number(d.costPrice || d.cost_price || 0)
  }));
};



