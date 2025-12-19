import React, { useState, useEffect } from 'react';
import { getActiveSession, startSession, closeSession, getProducts, getTransactionsInRange, getInventoryStock, getConfig, updateConfig } from '../services/db';
import { ShiftSession, Product, InventoryItem, SalesReport, User, CreditTransaction } from '../types';
import { Play, Square, AlertTriangle, Lock, CheckCircle, XCircle, Loader2, DollarSign, Package, TrendingUp, TrendingDown, Wallet, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface InventoryProps {
  user: User;
}

const INVENTORY_DRAFT_KEY = 'barflow_inventory_initial_draft';

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryInput, setInventoryInput] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [stock, setStock] = useState<{productId: string; productName: string; quantity: number; salePrice: number; costPrice: number;}[]>([]);
  const [lowStockThreshold, setLowStockThreshold] = useState(3);
  const [savingThreshold, setSavingThreshold] = useState(false);
  
  // Closing inputs
  const [realCash, setRealCash] = useState('');
  const [closingObs, setClosingObs] = useState('');

  // New state for Summary Modal
  const [showSummary, setShowSummary] = useState(false);
  const [lastSessionSummary, setLastSessionSummary] = useState<ShiftSession | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    if (user.role === 'ADMIN') {
      loadStock();
      loadConfig();
    }
  }, []);

  const formatCOP = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const loadConfig = async () => {
    try {
      const cfg = await getConfig();
      setLowStockThreshold(Number(cfg.lowStockThreshold || 3));
    } catch (e) {
      console.warn('No se pudo cargar la configuración', e);
    }
  };

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(INVENTORY_DRAFT_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {};
    }
  };

  const loadData = async () => {
    try {
      const session = await getActiveSession();
      const prods = await getProducts();
      setActiveSession(session);
      
      const activeProds = prods.filter(p => p.active);
      setProducts(activeProds);
      const draft = loadDraft();

      setInventoryInput(prev => {
        const next = { ...prev };
        activeProds.forEach(p => {
          // If session was reopened (has finalInventory), pre-fill with those values to save time
          if (session && session.finalInventory && session.finalInventory.length > 0) {
             const existing = session.finalInventory.find(i => i.productId === p.id);
             next[p.id] = existing ? existing.count : 0;
          } else if (draft[p.id] !== undefined) {
             next[p.id] = draft[p.id];
          } else if (next[p.id] === undefined) {
             next[p.id] = 0;
          }
        });
        return next;
      });

      // If reopened, also pre-fill observation
      if(session?.closingObservation) {
          setClosingObs(session.closingObservation);
      }

    } catch (error) {
      console.error("Error loading data", error);
      showNotification("Error cargando datos del sistema", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadStock = async () => {
    try {
      const data = await getInventoryStock();
      setStock(data);
    } catch (e) {
      console.error('Error loading stock', e);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleInputChange = (productId: string, val: string) => {
    const num = parseInt(val);
    setInventoryInput(prev => ({ ...prev, [productId]: isNaN(num) ? 0 : num }));
  };

  const handleStartShift = async () => {
    if (user.role !== 'ADMIN') {
        alert("Error de permisos: Solo el administrador puede iniciar turno.");
        return;
    }

    setProcessing(true);

    try {
        const initialInventory: InventoryItem[] = products.map(p => ({
            productId: p.id,
            productName: p.name,
            count: inventoryInput[p.id] || 0
        }));

        const newSession = await startSession(user.id, initialInventory);
        setActiveSession(newSession);
        localStorage.removeItem(INVENTORY_DRAFT_KEY);

        const resetInput: Record<string, number> = {};
        products.forEach(p => resetInput[p.id] = 0);
        setInventoryInput(resetInput);

        showNotification("✔️ Turno iniciado correctamente", "success");

    } catch (error: any) {
        console.error("ERROR START:", error);
        alert("Ocurrió un error al iniciar: " + error.message);
    } finally {
        setProcessing(false);
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem(INVENTORY_DRAFT_KEY, JSON.stringify(inventoryInput));
    showNotification('Inventario inicial guardado', 'success');
  };

  const handleSaveThreshold = async () => {
    setSavingThreshold(true);
    try {
      await updateConfig({ lowStockThreshold });
      showNotification('Umbral de inventario actualizado', 'success');
    } catch (e: any) {
      console.error(e);
      showNotification('No se pudo guardar el umbral', 'error');
    } finally {
      setSavingThreshold(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeSession) return;
    if (!realCash) {
        alert("⚠️ Por favor ingresa el 'Efectivo Real en Caja' antes de cerrar el turno.");
        return;
    }
    
    if(!window.confirm("¿Confirmas que has contado el inventario y el dinero físico? Esta acción cerrará el turno.")) {
        return;
    }

    setProcessing(true);

    try {
        const currentProducts = await getProducts();
        const realCashValue = parseInt(realCash);
        
        // 1. Calculate Inventory Difference (Theoretical Revenue)
        const finalInventory: InventoryItem[] = currentProducts.map(p => ({
            productId: p.id,
            productName: p.name,
            count: inventoryInput[p.id] || 0
        }));

        let totalRevenue = 0;
        let totalCost = 0;
        const itemsSoldReport = [];
        const initialInv = activeSession.initialInventory || [];

        for (const p of currentProducts) {
            const startItem = initialInv.find(i => i.productId === p.id);
            const startCount = startItem ? startItem.count : 0;
            const endCount = finalInventory.find(i => i.productId === p.id)?.count || 0;
            
            const sold = Math.max(0, startCount - endCount); 
            
            const revenue = sold * p.salePrice;
            const cost = sold * p.costPrice;
            const profit = revenue - cost;

            totalRevenue += revenue;
            totalCost += cost;

            itemsSoldReport.push({
                productId: p.id,
                productName: p.name,
                quantity: sold,
                revenue,
                profit
            });
        }

        // 2. Fetch Credit Transactions for this shift to adjust Cash Flow
        const endDate = new Date().toISOString();
        const creditTransactions = await getTransactionsInRange(activeSession.openedAt, endDate);

        // a. Fiaos (Debt) given during this shift -> Subtract from Cash
        const fiaos = creditTransactions.filter(t => t.type === 'DEBT');
        const totalCreditSales = fiaos.reduce((acc, t) => acc + t.amount, 0);

        // b. Payments (Abonos) received during this shift -> Add to Cash (ONLY if CASH method)
        const cashPayments = creditTransactions.filter(t => t.type === 'PAYMENT' && t.paymentMethod === 'CASH');
        const totalCashPayments = cashPayments.reduce((acc, t) => acc + t.amount, 0);

        // c. Non-Cash Payments (Transfer/Card) -> Just for reporting
        const otherPayments = creditTransactions.filter(t => t.type === 'PAYMENT' && t.paymentMethod !== 'CASH');
        const totalNonCashPayments = otherPayments.reduce((acc, t) => acc + t.amount, 0);

        // 3. Final Cash Calculation
        // Cash to Deliver (Theoretical) = (Total Inventory Revenue) - (Credit Sales) + (Cash Payments Collected)
        const cashToDeliver = totalRevenue - totalCreditSales + totalCashPayments;

        // 4. Difference
        const difference = realCashValue - cashToDeliver;

        const salesReport: SalesReport = {
            totalRevenue, 
            totalCost,
            totalProfit: totalRevenue - totalCost,
            totalCreditSales,
            totalCashPayments,
            totalNonCashPayments,
            cashToDeliver,
            difference, 
            itemsSold: itemsSoldReport
        };

        const completedSession: ShiftSession = {
            ...activeSession,
            closedBy: user.id,
            closedAt: endDate,
            status: 'CLOSED',
            finalInventory,
            salesReport,
            realCash: realCashValue,
            closingObservation: closingObs
        };

        await closeSession(completedSession);
        
        setActiveSession(null);
        setRealCash('');
        setClosingObs('');
        setLastSessionSummary(completedSession);
        setShowSummary(true);
        
    } catch (error: any) {
        console.error("ERROR END:", error);
        alert("Error crítico al cerrar turno: " + error.message);
    } finally {
        setProcessing(false);
    }
  };

  const closeSummaryAndReset = () => {
    setShowSummary(false);
    setLastSessionSummary(null);
    
    const resetInput: Record<string, number> = {};
    products.forEach(p => resetInput[p.id] = 0);
    setInventoryInput(resetInput);

    if (user.role === 'ADMIN') {
        navigate('/');
    } else {
        loadData();
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Cargando sistema...</div>;

  const canEdit = user.role === 'ADMIN' || (user.role === 'EMPLOYEE' && activeSession !== null);

  return (
    <div className="max-w-4xl mx-auto space-y-6 relative pb-24">
      {/* ADMIN: Current Stock Overview */}
      {user.role === 'ADMIN' && stock.length > 0 && (
        <div className="bg-bar-800 border border-bar-700 rounded-xl p-4 shadow-md">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-white">Inventario actual (consolidado)</h3>
            <button onClick={loadStock} className="text-sm text-bar-400 hover:text-bar-300 underline">Refrescar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {stock.map(item => {
              const low = item.quantity <= lowStockThreshold;
              return (
                <div key={item.productId} className={`flex justify-between items-center bg-bar-900/50 border border-bar-700 rounded-lg px-3 py-2 ${low ? 'border-rose-700' : ''}`}>
                  <div>
                    <p className="text-white font-semibold">{item.productName}</p>
                    <p className="text-xs text-slate-500">Stock: {item.quantity}</p>
                  </div>
                  <div className={`text-sm font-bold ${low ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                    {item.quantity}
                  </div>
                </div>
              );
            })}
          </div>
          {user.role === 'ADMIN' && (
            <div className="mt-4 border-t border-bar-700 pt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="text-sm text-slate-400">Avisar cuando el stock esté por debajo de:</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value || 0))}
                  className="w-24 bg-bar-900 border border-bar-700 rounded px-3 py-2 text-white text-center"
                />
                <button
                  onClick={handleSaveThreshold}
                  disabled={savingThreshold}
                  className="px-4 py-2 bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold rounded-lg shadow shadow-bar-500/20 disabled:opacity-50"
                >
                  {savingThreshold ? 'Guardando...' : 'Guardar umbral'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-2xl flex items-center gap-3 text-white animate-bounce-in ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {notification.type === 'success' ? <CheckCircle size={24} /> : <XCircle size={24} />}
          <span className="font-bold">{notification.message}</span>
        </div>
      )}

      {/* --- SUMMARY MODAL --- */}
      {showSummary && lastSessionSummary && lastSessionSummary.salesReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-bar-800 w-full max-w-lg rounded-2xl border border-bar-600 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
                
                <div className="bg-emerald-600 p-6 text-center shrink-0">
                    <CheckCircle className="w-16 h-16 text-white mx-auto mb-2" />
                    <h2 className="text-2xl font-bold text-white">¡Turno Cerrado!</h2>
                    <p className="text-emerald-100">Resumen de Cierre de Caja</p>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Main Cash Figure */}
                    <div className="text-center bg-bar-900/50 p-6 rounded-xl border border-bar-700">
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                <p className="text-slate-500 text-xs font-bold uppercase">Entregado (Real)</p>
                                <p className="text-2xl font-bold text-white">
                                    {formatCOP(lastSessionSummary.realCash || 0)}
                                </p>
                             </div>
                             <div>
                                <p className="text-slate-500 text-xs font-bold uppercase">Esperado (Sistema)</p>
                                <p className="text-2xl font-bold text-slate-300">
                                    {formatCOP(lastSessionSummary.salesReport.cashToDeliver)}
                                </p>
                             </div>
                         </div>
                         
                         <div className="mt-4 pt-4 border-t border-bar-700">
                             <p className="text-xs text-slate-400 mb-1">Diferencia (Sobrante / Faltante)</p>
                             <div className={`text-3xl font-bold ${(lastSessionSummary.salesReport.difference || 0) < 0 ? 'text-rose-500' : 'text-blue-400'}`}>
                                 {(lastSessionSummary.salesReport.difference || 0) > 0 ? '+' : ''}
                                 {formatCOP(lastSessionSummary.salesReport.difference || 0)}
                             </div>
                         </div>
                    </div>

                    {/* Breakdown */}
                    <div className="space-y-3 bg-bar-900/30 p-4 rounded-xl border border-bar-700/50">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-300 flex items-center gap-2">
                                <Package size={16} /> Venta Total Inventario
                            </span>
                            <span className="text-white font-mono">{formatCOP(lastSessionSummary.salesReport.totalRevenue)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-rose-400 flex items-center gap-2">
                                <TrendingUp size={16} /> (-) Fiaos (Créditos)
                            </span>
                            <span className="text-rose-400 font-mono">
                                -{formatCOP(lastSessionSummary.salesReport.totalCreditSales)}
                            </span>
                        </div>

                        <div className="flex justify-between items-center text-sm">
                            <span className="text-emerald-400 flex items-center gap-2">
                                <Wallet size={16} /> (+) Abonos en Efectivo
                            </span>
                            <span className="text-emerald-400 font-mono">
                                +{formatCOP(lastSessionSummary.salesReport.totalCashPayments)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-bar-900/50 border-t border-bar-700 shrink-0">
                    <button 
                        onClick={closeSummaryAndReset}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                    >
                        Entendido, Finalizar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Gestión de Turno</h2>
          <p className="text-slate-400">
            {activeSession 
              ? "Turno ABIERTO - Registra el inventario final para cerrar." 
              : "Turno CERRADO - Registra el inventario inicial para abrir."}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors duration-500 ${activeSession ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
          <div className={`w-3 h-3 rounded-full ${activeSession ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          {activeSession ? 'TURNO ABIERTO' : 'ESPERANDO INICIO'}
        </div>
      </div>

      {!canEdit && !activeSession && (
          <div className="bg-amber-900/30 border border-amber-600/50 p-4 rounded-xl flex items-center gap-3 text-amber-200">
              <Lock size={24} />
              <div>
                  <p className="font-bold">Modo Lectura</p>
                  <p className="text-sm">No tienes permisos para abrir un nuevo turno. Espera a que un administrador inicie la sesión.</p>
              </div>
          </div>
      )}

      {/* TABLE */}
      <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden shadow-xl">
        <div className="p-4 bg-bar-900/50 border-b border-bar-700 flex justify-between items-center gap-3">
            <h3 className="font-semibold text-white">
                {activeSession ? 'Inventario Final (Cierre)' : 'Inventario Inicial (Apertura)'}
            </h3>
            {activeSession && (
                <div className="text-sm text-amber-500 flex items-center gap-1 animate-pulse">
                    <AlertTriangle size={14} />
                    <span>Asegúrate de contar todo lo que queda.</span>
                </div>
            )}
            {!activeSession && canEdit && (
              <button
                onClick={handleSaveDraft}
                className="text-sm bg-bar-700 hover:bg-bar-600 text-white px-3 py-2 rounded-lg border border-bar-600"
              >
                Guardar inventario
              </button>
            )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-bar-950 text-slate-400 text-sm uppercase tracking-wider">
                <th className="p-4">Producto</th>
                <th className="p-4">Categoría</th>
                {activeSession && <th className="p-4 text-center text-slate-300">Stock Inicial</th>}
                <th className="p-4 w-32 text-center">Cantidad Física</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bar-700">
              {products.map(product => {
                const initialCount = activeSession?.initialInventory.find(i => i.productId === product.id)?.count;
                
                return (
                  <tr key={product.id} className="hover:bg-bar-700/30 transition-colors">
                    <td className="p-4 font-medium text-white">{product.name}</td>
                    <td className="p-4 text-slate-400 text-sm">{product.category}</td>
                    
                    {activeSession && (
                        <td className="p-4 text-center text-slate-300 font-mono bg-bar-900/30">
                            {initialCount}
                        </td>
                    )}

                    <td className="p-4">
                      <input
                        type="number"
                        min="0"
                        disabled={!canEdit}
                        value={inventoryInput[product.id] === undefined ? '' : inventoryInput[product.id]}
                        onChange={(e) => handleInputChange(product.id, e.target.value)}
                        className={`w-full bg-bar-900 border border-bar-600 rounded p-2 text-white text-center font-bold focus:border-bar-500 focus:ring-1 focus:ring-bar-500 outline-none transition-all ${!canEdit ? 'opacity-40 cursor-not-allowed bg-bar-950 border-transparent' : 'hover:border-bar-500'}`}
                        placeholder="0"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACTION AREA (Fixed at bottom or static) */}
      <div className="bg-bar-800 rounded-xl border border-bar-700 p-6 shadow-xl space-y-4">
          
          {activeSession && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                         <DollarSign size={16} className="text-emerald-400"/> Efectivo Real en Caja *
                      </label>
                      <input 
                        type="number"
                        min="0"
                        value={realCash}
                        onChange={e => setRealCash(e.target.value)}
                        placeholder="¿Cuánto dinero hay?"
                        className="w-full bg-bar-900 border border-bar-600 rounded-xl p-3 text-white font-mono text-lg focus:border-emerald-500 outline-none"
                      />
                      <p className="text-xs text-slate-500 mt-1">Cuenta billetes y monedas del turno.</p>
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                         <MessageSquare size={16} className="text-blue-400"/> Observaciones (Opcional)
                      </label>
                      <input 
                        type="text"
                        value={closingObs}
                        onChange={e => setClosingObs(e.target.value)}
                        placeholder="Ej: Se rompió una copa..."
                        className="w-full bg-bar-900 border border-bar-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                      />
                  </div>
              </div>
          )}

          <div className="flex justify-end pt-2">
            {!activeSession ? (
                canEdit ? (
                    <button
                        type="button"
                        onClick={handleStartShift}
                        disabled={processing}
                        className="flex items-center gap-2 bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold px-8 py-4 rounded-xl shadow-lg shadow-bar-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processing ? <Loader2 size={24} className="animate-spin" /> : <Play size={24} />}
                        {processing ? 'Iniciando...' : 'Iniciar Turno'}
                    </button>
                ) : (
                    <span className="text-slate-500 text-sm italic py-2">Esperando apertura por administrador...</span>
                )
            ) : (
                <button
                type="button"
                onClick={handleEndShift}
                disabled={processing || !realCash}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-rose-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                {processing ? <Loader2 size={24} className="animate-spin" /> : <Square size={24} fill="currentColor" />}
                {processing ? 'Cerrando...' : 'Cerrar Turno'}
                </button>
            )}
          </div>
      </div>
    </div>
  );
};

export default Inventory;
