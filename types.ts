export type Role = 'ADMIN' | 'EMPLOYEE';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  password?: string; // In a real app, this would be hashed on backend
}

export interface Product {
  id: string;
  name: string;
  category: string;
  categoryId?: string | null;
  categoryLabel?: string | null;
  costPrice: number; // Precio de compra (Interno)
  salePrice: number; // Precio de venta (Público)
  active: boolean;
  unitType?: 'UNIT' | 'BOX' | 'PORTION';
  unitsPerPack?: number | null;
}

export interface InventoryItem {
  productId: string;
  productName: string;
  count: number;
}

export interface AuditEntry {
  date: string;
  userId: string;
  userName: string;
  action: string; // e.g., "REOPENED"
  reason: string;
}

export interface ShiftSession {
  id: string;
  openedBy: string; // User ID
  closedBy?: string; // User ID
  openedAt: string; // ISO Date
  closedAt?: string; // ISO Date
  status: 'OPEN' | 'CLOSED';
  initialInventory: InventoryItem[];
  finalInventory: InventoryItem[];
  salesReport?: SalesReport;
  closingObservation?: string; // Notas del empleado al cerrar
  realCash?: number; // Dinero real contado por el empleado
  auditLog?: AuditEntry[]; // Historial de reaperturas/cambios
}

export interface SalesReport {
  totalRevenue: number; // Venta Teórica (Inventario)
  totalCost: number;
  totalProfit: number;
  // Cash Flow Adjustments
  totalCreditSales: number; // (-) Fiaos otorgados en este turno
  totalCashPayments: number; // (+) Abonos en efectivo recibidos en este turno
  totalNonCashPayments: number; // Abonos por transferencia/otros (informativo)
  cashToDeliver: number; // (=) Dinero TEÓRICO a entregar
  difference?: number; // (=) Real Cash - Cash To Deliver (Sobrante/Faltante)
  itemsSold: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
    profit: number;
  }[];
}

export interface AppConfig {
  barName: string;
  lastExportDate: string;
  lowStockThreshold?: number;
}

// --- AI AGENT CONFIG ---
export type AiProvider = 'OPENAI' | 'GEMINI' | null;

export interface AiAgentConfig {
  provider: AiProvider;
  prompt: string;
  hasApiKey: boolean;
  validated: boolean;
  lastTestedAt?: string | null;
}

export interface AiInsight {
  title: string;
  summary: string;
  suggestions: string[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  source: 'AI' | 'BASIC';
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
  source?: 'AI' | 'BASIC';
}

// --- FIAO SYSTEM ---

export interface CreditCustomer {
  id: string;
  name: string;
  documentId?: string;
  phone?: string;
  maxLimit: number; // Cupo Máximo Autorizado
  currentUsed: number; // Cupo Usado Actualmente
  observations?: string;
  active: boolean;
}

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD';

export interface CreditTransaction {
  id: string;
  customerId: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string; // ISO Date
  type: 'DEBT' | 'PAYMENT';
  paymentMethod?: PaymentMethod; // Only for PAYMENT
  observation: string; // Mandatory for DEBT, Optional for PAYMENT
}

// --- ACCOUNTING SYSTEM ---

export interface FixedExpense {
  id: string;
  name: string; // e.g. "Arriendo"
  amount: number;
  paymentDay: string; // "5" or "Los viernes"
  type: 'EXPENSE' | 'BANK_COMMITMENT';
}

export interface WorkShift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  hoursWorked: number;
  hourlyRate: number;
  surcharges: number; // Recargos value
  totalPay: number;
}

export interface Purchase {
  id: string;
  date: string; // YYYY-MM-DD
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  observations?: string;
}
