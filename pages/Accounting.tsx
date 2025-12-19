import React, { useState, useEffect } from 'react';
import { 
  getFixedExpenses, saveFixedExpense, deleteFixedExpense,
  getPayroll, saveWorkShift, deleteWorkShift,
  getPurchases, savePurchase, deletePurchase,
  getSessions, getUsers
} from '../services/db';
import { 
  FixedExpense, WorkShift, Purchase, ShiftSession, User 
} from '../types';
import { 
  PieChart, DollarSign, Calendar, Users, ShoppingCart, 
  Plus, Trash2, Save, Filter, TrendingUp, TrendingDown,
  Clock, AlertCircle, Check
} from 'lucide-react';

const Accounting: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'EXPENSES' | 'PAYROLL' | 'PURCHASES'>('SUMMARY');
  const [loading, setLoading] = useState(true);

  // Data Stores
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [payroll, setPayroll] = useState<WorkShift[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Inputs - Expenses
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState('');
  const [expType, setExpType] = useState<'EXPENSE' | 'BANK_COMMITMENT'>('EXPENSE');

  // Inputs - Payroll
  const [payEmployeeId, setPayEmployeeId] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payHours, setPayHours] = useState('');
  const [payRate, setPayRate] = useState('');
  const [paySurcharge, setPaySurcharge] = useState('0');

  // Inputs - Purchases
  const [purDate, setPurDate] = useState(new Date().toISOString().slice(0, 10));
  const [purProduct, setPurProduct] = useState('');
  const [purQty, setPurQty] = useState('');
  const [purCost, setPurCost] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    const [e, p, pur, s, u] = await Promise.all([
      getFixedExpenses(),
      getPayroll(),
      getPurchases(),
      getSessions(),
      getUsers()
    ]);
    setExpenses(e);
    setPayroll(p);
    setPurchases(pur);
    setSessions(s);
    setEmployees(u.filter(user => user.role === 'EMPLOYEE' || user.role === 'ADMIN')); // Allow admins too just in case
    setLoading(false);
  };

  const formatMoney = (amount: number) => {
    return '$' + amount.toLocaleString('es-CO');
  };

  // --- HANDLERS ---

  // EXPENSES
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!expName || !expAmount || !expDate) return;
    await saveFixedExpense({
        id: '',
        name: expName,
        amount: Number(expAmount),
        paymentDay: expDate,
        type: expType
    });
    setExpName(''); setExpAmount(''); setExpDate('');
    setExpenses(await getFixedExpenses());
  };

  const handleDeleteExpense = async (id: string) => {
      if(window.confirm('¿Borrar este gasto?')) {
          await deleteFixedExpense(id);
          setExpenses(await getFixedExpenses());
      }
  };

  // PAYROLL
  const handleSavePayroll = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!payEmployeeId || !payHours || !payRate) return;
      
      const emp = employees.find(u => u.id === payEmployeeId);
      const hours = Number(payHours);
      const rate = Number(payRate);
      const sur = Number(paySurcharge);
      const total = (hours * rate) + sur;

      await saveWorkShift({
          id: '',
          employeeId: payEmployeeId,
          employeeName: emp?.name || 'Desconocido',
          date: payDate,
          hoursWorked: hours,
          hourlyRate: rate,
          surcharges: sur,
          totalPay: total
      });
      
      // Reset some fields
      setPayHours(''); setPaySurcharge('0');
      setPayroll(await getPayroll());
  };

  const handleDeletePayroll = async (id: string) => {
      if(window.confirm('¿Borrar este registro de turno?')) {
          await deleteWorkShift(id);
          setPayroll(await getPayroll());
      }
  };

  // PURCHASES
  const handleSavePurchase = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!purProduct || !purQty || !purCost) return;
      
      const qty = Number(purQty);
      const cost = Number(purCost);

      await savePurchase({
          id: '',
          date: purDate,
          productName: purProduct,
          quantity: qty,
          unitCost: cost,
          totalCost: qty * cost
      });
      
      setPurProduct(''); setPurQty(''); setPurCost('');
      setPurchases(await getPurchases());
  };

  const handleDeletePurchase = async (id: string) => {
      if(window.confirm('¿Borrar esta compra?')) {
          await deletePurchase(id);
          setPurchases(await getPurchases());
      }
  };


  // --- CALCULATIONS FOR SUMMARY ---
  
  const getSummaryData = () => {
      // 1. Revenue (From Sessions closed in selectedMonth)
      const monthlySessions = sessions.filter(s => s.closedAt?.startsWith(selectedMonth));
      const totalRevenue = monthlySessions.reduce((acc, s) => acc + (s.salesReport?.totalRevenue || 0), 0);
      
      // 2. Purchases (In selectedMonth)
      const monthlyPurchases = purchases.filter(p => p.date.startsWith(selectedMonth));
      const totalPurchases = monthlyPurchases.reduce((acc, p) => acc + p.totalCost, 0);

      // 3. Payroll (In selectedMonth)
      const monthlyPayroll = payroll.filter(p => p.date.startsWith(selectedMonth));
      const totalPayroll = monthlyPayroll.reduce((acc, p) => acc + p.totalPay, 0);

      // 4. Fixed Expenses & Bank (Assumed to apply every month)
      const totalFixed = expenses.filter(e => e.type === 'EXPENSE').reduce((acc, e) => acc + e.amount, 0);
      const totalBank = expenses.filter(e => e.type === 'BANK_COMMITMENT').reduce((acc, e) => acc + e.amount, 0);

      // 5. Profit
      const totalExpenses = totalPurchases + totalPayroll + totalFixed + totalBank;
      const realProfit = totalRevenue - totalExpenses;

      return {
          totalRevenue,
          totalPurchases,
          totalPayroll,
          totalFixed,
          totalBank,
          totalExpenses,
          realProfit
      };
  };

  const summary = getSummaryData();


  if(loading) return <div className="p-8 text-center text-slate-400">Cargando contabilidad...</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Contabilidad</h2>
          <p className="text-slate-400">Gestión financiera integral del negocio</p>
        </div>
        
        {/* Month Selector for Summary */}
        <div className="flex items-center gap-2 bg-bar-800 p-2 rounded-lg border border-bar-700">
             <Calendar size={18} className="text-slate-400"/>
             <input 
                type="month" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white outline-none font-bold"
             />
        </div>
      </div>

      {/* TABS */}
      <div className="flex overflow-x-auto gap-2 border-b border-bar-700 pb-1">
          <button onClick={() => setActiveTab('SUMMARY')} className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'SUMMARY' ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700' : 'text-slate-400 hover:text-white'}`}>
              <PieChart size={18} /> Resumen
          </button>
          <button onClick={() => setActiveTab('EXPENSES')} className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'EXPENSES' ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700' : 'text-slate-400 hover:text-white'}`}>
              <DollarSign size={18} /> Gastos Fijos y Bancos
          </button>
          <button onClick={() => setActiveTab('PAYROLL')} className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'PAYROLL' ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700' : 'text-slate-400 hover:text-white'}`}>
              <Users size={18} /> Nómina
          </button>
          <button onClick={() => setActiveTab('PURCHASES')} className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'PURCHASES' ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700' : 'text-slate-400 hover:text-white'}`}>
              <ShoppingCart size={18} /> Compras
          </button>
      </div>

      {/* --- TAB CONTENT: SUMMARY --- */}
      {activeTab === 'SUMMARY' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Revenue */}
                  <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
                      <div className="flex justify-between mb-4">
                          <span className="text-slate-400 text-sm font-bold uppercase">Ingresos Totales</span>
                          <TrendingUp className="text-emerald-500" />
                      </div>
                      <p className="text-3xl font-bold text-white">{formatMoney(summary.totalRevenue)}</p>
                      <p className="text-xs text-slate-500 mt-2">Basado en cierres de caja del mes</p>
                  </div>
                  
                  {/* Expenses */}
                  <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
                      <div className="flex justify-between mb-4">
                          <span className="text-slate-400 text-sm font-bold uppercase">Total Egresos</span>
                          <TrendingDown className="text-rose-500" />
                      </div>
                      <p className="text-3xl font-bold text-rose-400">-{formatMoney(summary.totalExpenses)}</p>
                      <div className="flex gap-2 text-xs mt-2 overflow-x-auto">
                          <span className="bg-rose-900/30 px-2 py-1 rounded text-rose-200">Compras: {formatMoney(summary.totalPurchases)}</span>
                          <span className="bg-rose-900/30 px-2 py-1 rounded text-rose-200">Nómina: {formatMoney(summary.totalPayroll)}</span>
                      </div>
                  </div>

                  {/* PROFIT */}
                  <div className={`p-6 rounded-xl border ${summary.realProfit >= 0 ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-rose-900/20 border-rose-500/50'}`}>
                      <div className="flex justify-between mb-4">
                          <span className="text-white text-sm font-bold uppercase">Ganancia Real</span>
                          <DollarSign className={summary.realProfit >= 0 ? "text-emerald-400" : "text-rose-400"} />
                      </div>
                      <p className={`text-4xl font-bold ${summary.realProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatMoney(summary.realProfit)}
                      </p>
                      <p className="text-xs text-slate-300 mt-2">
                          Dinero estimado libre tras pagar todo
                      </p>
                  </div>
              </div>

              {/* Breakdown */}
              <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden">
                  <div className="p-4 bg-bar-900/50 border-b border-bar-700 font-bold text-white">
                      Detalle de Egresos
                  </div>
                  <div className="divide-y divide-bar-700">
                       <div className="p-4 flex justify-between items-center hover:bg-bar-700/20">
                           <div className="flex items-center gap-3">
                               <div className="bg-blue-500/20 p-2 rounded text-blue-400"><Clock size={18}/></div>
                               <div>
                                   <p className="text-white font-medium">Gastos Fijos</p>
                                   <p className="text-xs text-slate-400">Arriendo, Servicios, etc.</p>
                               </div>
                           </div>
                           <span className="text-white font-mono">{formatMoney(summary.totalFixed)}</span>
                       </div>
                       <div className="p-4 flex justify-between items-center hover:bg-bar-700/20">
                           <div className="flex items-center gap-3">
                               <div className="bg-purple-500/20 p-2 rounded text-purple-400"><DollarSign size={18}/></div>
                               <div>
                                   <p className="text-white font-medium">Compromisos Bancarios</p>
                                   <p className="text-xs text-slate-400">Créditos y Deudas</p>
                               </div>
                           </div>
                           <span className="text-white font-mono">{formatMoney(summary.totalBank)}</span>
                       </div>
                       <div className="p-4 flex justify-between items-center hover:bg-bar-700/20">
                           <div className="flex items-center gap-3">
                               <div className="bg-orange-500/20 p-2 rounded text-orange-400"><Users size={18}/></div>
                               <div>
                                   <p className="text-white font-medium">Nómina de Empleados</p>
                                   <p className="text-xs text-slate-400">Pagos de turnos del mes</p>
                               </div>
                           </div>
                           <span className="text-white font-mono">{formatMoney(summary.totalPayroll)}</span>
                       </div>
                       <div className="p-4 flex justify-between items-center hover:bg-bar-700/20">
                           <div className="flex items-center gap-3">
                               <div className="bg-teal-500/20 p-2 rounded text-teal-400"><ShoppingCart size={18}/></div>
                               <div>
                                   <p className="text-white font-medium">Compras y Surtido</p>
                                   <p className="text-xs text-slate-400">Inversión en inventario</p>
                               </div>
                           </div>
                           <span className="text-white font-mono">{formatMoney(summary.totalPurchases)}</span>
                       </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- TAB CONTENT: EXPENSES --- */}
      {activeTab === 'EXPENSES' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
              {/* Form */}
              <div className="md:col-span-1 bg-bar-800 p-6 rounded-xl border border-bar-700 h-fit">
                  <h3 className="text-lg font-bold text-white mb-4">Registrar Gasto / Deuda</h3>
                  <form onSubmit={handleSaveExpense} className="space-y-4">
                      <div>
                          <label className="text-sm text-slate-300">Tipo</label>
                          <select value={expType} onChange={(e:any) => setExpType(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none">
                              <option value="EXPENSE">Gasto Fijo (Arriendo, Luz...)</option>
                              <option value="BANK_COMMITMENT">Compromiso Bancario (Crédito)</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-sm text-slate-300">Concepto</label>
                          <input required value={expName} onChange={e => setExpName(e.target.value)} placeholder="Ej: Pago Arriendo" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" />
                      </div>
                      <div>
                          <label className="text-sm text-slate-300">Valor Mensual / Cuota</label>
                          <input required type="number" min="0" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" />
                      </div>
                      <div>
                          <label className="text-sm text-slate-300">Fecha de Pago (Texto)</label>
                          <input required value={expDate} onChange={e => setExpDate(e.target.value)} placeholder="Ej: Día 5 de cada mes" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" />
                      </div>
                      <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-2 rounded">Guardar</button>
                  </form>
              </div>

              {/* List */}
              <div className="md:col-span-2 space-y-4">
                  <h3 className="text-lg font-bold text-white">Listado de Compromisos Mensuales</h3>
                  {expenses.length === 0 && <p className="text-slate-500">No hay gastos registrados.</p>}
                  
                  <div className="grid gap-3">
                      {expenses.map(exp => (
                          <div key={exp.id} className="bg-bar-800 border border-bar-700 p-4 rounded-xl flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${exp.type === 'EXPENSE' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'}`}>
                                      {exp.type === 'EXPENSE' ? <Clock size={20}/> : <DollarSign size={20}/>}
                                  </div>
                                  <div>
                                      <p className="font-bold text-white">{exp.name}</p>
                                      <p className="text-xs text-slate-400">{exp.paymentDay}</p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="font-mono text-white font-bold">{formatMoney(exp.amount)}</p>
                                  <button onClick={() => handleDeleteExpense(exp.id)} className="text-rose-500 hover:text-rose-400 text-xs mt-1">Eliminar</button>
                              </div>
                          </div>
                      ))}
                  </div>
                  
                  {expenses.length > 0 && (
                      <div className="mt-4 p-4 bg-bar-900/50 rounded-xl border border-bar-700 flex justify-between items-center">
                          <span className="text-slate-300 font-bold">Total Mensual Fijo:</span>
                          <span className="text-xl font-bold text-white">{formatMoney(expenses.reduce((acc,e) => acc + e.amount, 0))}</span>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* --- TAB CONTENT: PAYROLL --- */}
      {activeTab === 'PAYROLL' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
              <div className="md:col-span-1 bg-bar-800 p-6 rounded-xl border border-bar-700 h-fit">
                  <h3 className="text-lg font-bold text-white mb-4">Registrar Turno</h3>
                  <form onSubmit={handleSavePayroll} className="space-y-4">
                      <div>
                          <label className="text-sm text-slate-300">Empleado</label>
                          <select required value={payEmployeeId} onChange={e => setPayEmployeeId(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none">
                              <option value="">Seleccionar...</option>
                              {employees.map(u => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="text-sm text-slate-300">Fecha</label>
                          <input type="date" required value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          <div>
                              <label className="text-sm text-slate-300">Horas</label>
                              <input type="number" step="0.5" required value={payHours} onChange={e => setPayHours(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" placeholder="0" />
                          </div>
                          <div>
                              <label className="text-sm text-slate-300">Valor Hora</label>
                              <input type="number" required value={payRate} onChange={e => setPayRate(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" placeholder="$" />
                          </div>
                      </div>
                      <div>
                          <label className="text-sm text-slate-300">Recargos / Extras ($)</label>
                          <input type="number" value={paySurcharge} onChange={e => setPaySurcharge(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" placeholder="0" />
                      </div>
                      
                      {payHours && payRate && (
                          <div className="p-2 bg-bar-900 rounded text-center">
                              <span className="text-xs text-slate-400">Total a Pagar: </span>
                              <span className="text-emerald-400 font-bold">{formatMoney((Number(payHours) * Number(payRate)) + Number(paySurcharge))}</span>
                          </div>
                      )}

                      <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-2 rounded">Guardar Turno</button>
                  </form>
              </div>

              <div className="md:col-span-2 space-y-4">
                  <h3 className="text-lg font-bold text-white">Historial de Nómina</h3>
                  
                  <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-bar-950 text-slate-400">
                              <tr>
                                  <th className="p-3">Fecha</th>
                                  <th className="p-3">Empleado</th>
                                  <th className="p-3 text-center">Horas</th>
                                  <th className="p-3 text-right">Total</th>
                                  <th className="p-3 w-10"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-bar-700">
                              {payroll.length === 0 ? (
                                  <tr><td colSpan={5} className="p-6 text-center text-slate-500">Sin registros</td></tr>
                              ) : (
                                  payroll.sort((a,b) => b.date.localeCompare(a.date)).map(p => (
                                      <tr key={p.id} className="hover:bg-bar-700/30">
                                          <td className="p-3 text-slate-300">{p.date}</td>
                                          <td className="p-3 text-white font-medium">{p.employeeName}</td>
                                          <td className="p-3 text-center text-slate-400">{p.hoursWorked}h</td>
                                          <td className="p-3 text-right text-emerald-400 font-bold">{formatMoney(p.totalPay)}</td>
                                          <td className="p-3">
                                              <button onClick={() => handleDeletePayroll(p.id)} className="text-rose-500 hover:text-white"><Trash2 size={16}/></button>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* --- TAB CONTENT: PURCHASES --- */}
      {activeTab === 'PURCHASES' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
              <div className="md:col-span-1 bg-bar-800 p-6 rounded-xl border border-bar-700 h-fit">
                  <h3 className="text-lg font-bold text-white mb-4">Registrar Compra</h3>
                  <form onSubmit={handleSavePurchase} className="space-y-4">
                      <div>
                          <label className="text-sm text-slate-300">Fecha</label>
                          <input type="date" required value={purDate} onChange={e => setPurDate(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" />
                      </div>
                      <div>
                          <label className="text-sm text-slate-300">Producto / Descripción</label>
                          <input required value={purProduct} onChange={e => setPurProduct(e.target.value)} placeholder="Ej: 5 Cajas Poker" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                          <div>
                              <label className="text-sm text-slate-300">Cantidad</label>
                              <input type="number" required value={purQty} onChange={e => setPurQty(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" placeholder="0" />
                          </div>
                          <div>
                              <label className="text-sm text-slate-300">Costo Unit.</label>
                              <input type="number" required value={purCost} onChange={e => setPurCost(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none" placeholder="$" />
                          </div>
                      </div>
                      
                      {purQty && purCost && (
                          <div className="p-2 bg-bar-900 rounded text-center">
                              <span className="text-xs text-slate-400">Total Compra: </span>
                              <span className="text-white font-bold">{formatMoney(Number(purQty) * Number(purCost))}</span>
                          </div>
                      )}

                      <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-2 rounded">Registrar</button>
                  </form>
              </div>

              <div className="md:col-span-2 space-y-4">
                  <h3 className="text-lg font-bold text-white">Historial de Surtido</h3>
                  
                  <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-bar-950 text-slate-400">
                              <tr>
                                  <th className="p-3">Fecha</th>
                                  <th className="p-3">Detalle</th>
                                  <th className="p-3 text-center">Cant.</th>
                                  <th className="p-3 text-right">Total</th>
                                  <th className="p-3 w-10"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-bar-700">
                              {purchases.length === 0 ? (
                                  <tr><td colSpan={5} className="p-6 text-center text-slate-500">Sin registros</td></tr>
                              ) : (
                                  purchases.sort((a,b) => b.date.localeCompare(a.date)).map(p => (
                                      <tr key={p.id} className="hover:bg-bar-700/30">
                                          <td className="p-3 text-slate-300">{p.date}</td>
                                          <td className="p-3 text-white font-medium">
                                              {p.productName}
                                              <div className="text-xs text-slate-500">Unit: {formatMoney(p.unitCost)}</div>
                                          </td>
                                          <td className="p-3 text-center text-slate-400">{p.quantity}</td>
                                          <td className="p-3 text-right text-white font-bold">{formatMoney(p.totalCost)}</td>
                                          <td className="p-3">
                                              <button onClick={() => handleDeletePurchase(p.id)} className="text-rose-500 hover:text-white"><Trash2 size={16}/></button>
                                          </td>
                                      </tr>
                                  ))
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default Accounting;