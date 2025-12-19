import React, { useState, useEffect } from 'react';
import { getCreditCustomers, saveCreditCustomer, registerCreditTransaction, registerPaymentTransaction, getCustomerHistory } from '../services/db';
import { CreditCustomer, CreditTransaction, User, PaymentMethod } from '../types';
import { 
  Plus, Edit2, Search, DollarSign, 
  AlertTriangle, Lock, History, CheckCircle, X, Check, Wallet, Banknote, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';

interface Props {
  user: User;
}

const CreditCustomers: React.FC<Props> = ({ user }) => {
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isFiaoModalOpen, setIsFiaoModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // Selection state
  const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomer | null>(null);
  const [history, setHistory] = useState<CreditTransaction[]>([]);

  // Form states (Customer)
  const [cName, setCName] = useState('');
  const [cDoc, setCDoc] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cLimit, setCLimit] = useState('');
  const [cObs, setCObs] = useState('');
  const [cActive, setCActive] = useState(true);

  // Form states (Fiao)
  const [fAmount, setFAmount] = useState('');
  const [fObs, setFObs] = useState('');
  const [fError, setFError] = useState('');

  // Form states (Payment/Abono)
  const [pAmount, setPAmount] = useState('');
  const [pMethod, setPMethod] = useState<PaymentMethod>('CASH');
  const [pObs, setPObs] = useState('');
  const [pError, setPError] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    const data = await getCreditCustomers();
    setCustomers(data);
    setLoading(false);
  };

  const getStatusColor = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 90) return 'bg-rose-500';
    if (percentage >= 60) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getStatusText = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 90) return { text: 'CRÍTICO', color: 'text-rose-400', blocked: true };
    if (percentage >= 60) return { text: 'ADVERTENCIA', color: 'text-amber-400', blocked: false };
    return { text: 'NORMAL', color: 'text-emerald-400', blocked: false };
  };

  // --- ACTIONS ---

  const handleOpenCustomerModal = (customer?: CreditCustomer) => {
    if (customer) {
      setSelectedCustomer(customer);
      setCName(customer.name);
      setCDoc(customer.documentId || '');
      setCPhone(customer.phone || '');
      setCLimit(customer.maxLimit.toString());
      setCObs(customer.observations || '');
      setCActive(customer.active);
    } else {
      setSelectedCustomer(null);
      setCName('');
      setCDoc('');
      setCPhone('');
      setCLimit('');
      setCObs('');
      setCActive(true);
    }
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user.role !== 'ADMIN') return;

    const newCustomer: CreditCustomer = {
      id: selectedCustomer ? selectedCustomer.id : '',
      name: cName,
      documentId: cDoc,
      phone: cPhone,
      maxLimit: Number(cLimit),
      currentUsed: selectedCustomer ? selectedCustomer.currentUsed : 0,
      observations: cObs,
      active: cActive
    };

    await saveCreditCustomer(newCustomer);
    setIsCustomerModalOpen(false);
    loadCustomers();
  };

  // --- FIAO LOGIC ---

  const handleOpenFiaoModal = (customer: CreditCustomer) => {
    const status = getStatusText(customer.currentUsed, customer.maxLimit);
    if (status.blocked) return;

    setSelectedCustomer(customer);
    setFAmount('');
    setFObs('');
    setFError('');
    setIsFiaoModalOpen(true);
  };

  const handleSaveFiao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amount = Number(fAmount);
    if (amount <= 0) {
        setFError("El monto debe ser mayor a 0");
        return;
    }
    
    if (!fObs.trim()) {
        setFError("La observación es obligatoria (detalla los productos).");
        return;
    }

    try {
        await registerCreditTransaction(selectedCustomer.id, amount, fObs, user);
        setIsFiaoModalOpen(false);
        loadCustomers();
        alert(`✅ Fiao registrado exitosamente por $${amount.toLocaleString()}`);
    } catch (err: any) {
        setFError(err.message);
    }
  };

  // --- PAYMENT LOGIC ---

  const handleOpenPaymentModal = (customer: CreditCustomer) => {
    setSelectedCustomer(customer);
    setPAmount('');
    setPMethod('CASH');
    setPObs('');
    setPError('');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amount = Number(pAmount);
    if (amount <= 0) {
        setPError("El monto debe ser mayor a 0");
        return;
    }

    try {
        await registerPaymentTransaction(selectedCustomer.id, amount, pMethod, pObs, user);
        setIsPaymentModalOpen(false);
        loadCustomers();
        alert(`✅ Abono registrado exitosamente por $${amount.toLocaleString()}`);
    } catch (err: any) {
        setPError(err.message);
    }
  };


  const handleViewHistory = async (customer: CreditCustomer) => {
    // Both roles can see history now
    setSelectedCustomer(customer);
    const data = await getCustomerHistory(customer.id);
    setHistory(data);
    setIsHistoryModalOpen(true);
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.documentId && c.documentId.includes(searchTerm))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Clientes Autorizados (Fiao)</h2>
          <p className="text-slate-400">Gestión de cuentas por cobrar y abonos</p>
        </div>
        {user.role === 'ADMIN' && (
            <button
            onClick={() => handleOpenCustomerModal()}
            className="bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-bar-500/20"
            >
            <Plus size={20} />
            Nuevo Cliente
            </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 text-slate-500" size={20} />
        <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente por nombre o documento..."
            className="w-full bg-bar-800 border border-bar-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-1 focus:ring-bar-500"
        />
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.map(customer => {
            const status = getStatusText(customer.currentUsed, customer.maxLimit);
            const percentage = Math.min((customer.currentUsed / customer.maxLimit) * 100, 100);
            const colorClass = getStatusColor(customer.currentUsed, customer.maxLimit);

            return (
                <div key={customer.id} className={`bg-bar-800 rounded-xl border ${status.blocked ? 'border-rose-900' : 'border-bar-700'} shadow-lg overflow-hidden relative`}>
                    {!customer.active && (
                        <div className="absolute inset-0 bg-bar-950/80 flex items-center justify-center z-10 backdrop-blur-sm">
                            <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-sm font-bold">INACTIVO</span>
                        </div>
                    )}
                    
                    <div className="p-5">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="text-lg font-bold text-white truncate">{customer.name}</h3>
                                {customer.documentId && <p className="text-xs text-slate-500">ID: {customer.documentId}</p>}
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => handleViewHistory(customer)} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors" title="Ver Historial">
                                    <History size={16} />
                                </button>
                                {user.role === 'ADMIN' && (
                                    <button onClick={() => handleOpenCustomerModal(customer)} className="p-2 text-slate-500 hover:text-white hover:bg-bar-700 rounded-lg transition-colors" title="Editar Cliente">
                                        <Edit2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Status Indicator */}
                        <div className="flex items-center gap-2 mb-4">
                            <span className={`w-2.5 h-2.5 rounded-full ${colorClass} ${status.blocked ? 'animate-pulse' : ''}`} />
                            <span className={`text-xs font-bold tracking-wide ${status.color}`}>
                                {status.text} {status.blocked && "- CUPO LLENO"}
                            </span>
                        </div>

                        {/* Credit Bar */}
                        <div className="space-y-1 mb-4">
                            <div className="flex justify-between text-xs font-medium text-slate-400">
                                <span>Usado: ${customer.currentUsed.toLocaleString()}</span>
                                <span>Max: ${customer.maxLimit.toLocaleString()}</span>
                            </div>
                            <div className="h-2 w-full bg-bar-900 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${colorClass} transition-all duration-500`} 
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                            <div className="text-right text-xs text-slate-500">
                                Disponible: <span className="text-white font-mono">${(customer.maxLimit - customer.currentUsed).toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <button 
                                onClick={() => handleOpenPaymentModal(customer)}
                                disabled={!customer.active}
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                            >
                                <Banknote size={16} />
                                Abonar
                            </button>
                            
                            <button 
                                onClick={() => handleOpenFiaoModal(customer)}
                                disabled={status.blocked || !customer.active}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg ${
                                    status.blocked || !customer.active
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                                    : 'bg-bar-500 hover:bg-bar-400 text-bar-950 shadow-bar-500/20'
                                }`}
                            >
                                {status.blocked ? <Lock size={16} /> : <Wallet size={16} />}
                                Fiar
                            </button>
                        </div>
                    </div>
                </div>
            );
        })}
      </div>

      {/* --- MODAL: CREATE / EDIT CUSTOMER (ADMIN) --- */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bar-800 w-full max-w-lg rounded-2xl border border-bar-600 shadow-2xl">
            <div className="p-6 border-b border-bar-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">
                    {selectedCustomer ? 'Editar Cliente' : 'Nuevo Cliente Autorizado'}
                </h3>
                <button onClick={() => setIsCustomerModalOpen(false)} className="text-slate-400 hover:text-white">
                    <X size={24} />
                </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Nombre Completo *</label>
                    <input required type="text" value={cName} onChange={e => setCName(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2.5 text-white focus:border-bar-500 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Identificación</label>
                        <input type="text" value={cDoc} onChange={e => setCDoc(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2.5 text-white focus:border-bar-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Teléfono</label>
                        <input type="text" value={cPhone} onChange={e => setCPhone(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2.5 text-white focus:border-bar-500 outline-none" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-emerald-400 mb-1">Cupo Máximo ($) *</label>
                    <input required type="number" min="0" value={cLimit} onChange={e => setCLimit(e.target.value)} className="w-full bg-bar-900 border border-emerald-500/50 rounded p-2.5 text-white font-mono text-lg focus:border-emerald-500 outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Observaciones</label>
                    <textarea rows={2} value={cObs} onChange={e => setCObs(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2.5 text-white focus:border-bar-500 outline-none" />
                </div>
                
                {selectedCustomer && (
                    <div className="flex items-center gap-3 pt-2">
                        <label className="text-sm font-medium text-slate-300">Estado:</label>
                        <button 
                            type="button" 
                            onClick={() => setCActive(!cActive)}
                            className={`px-3 py-1 rounded text-xs font-bold ${cActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}
                        >
                            {cActive ? 'ACTIVO' : 'INACTIVO'}
                        </button>
                    </div>
                )}

                <div className="pt-4">
                    <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-3 rounded-lg flex justify-center items-center gap-2">
                        <Check size={20} />
                        Guardar Cliente
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: REGISTER FIAO (EMPLOYEE/ADMIN) --- */}
      {isFiaoModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-bar-800 w-full max-w-md rounded-2xl border border-bar-600 shadow-2xl">
                <div className="p-6 bg-bar-900/50 border-b border-bar-700">
                    <h3 className="text-xl font-bold text-white mb-1">Registrar Fiao</h3>
                    <p className="text-slate-400 text-sm">Cliente: <span className="text-white font-semibold">{selectedCustomer.name}</span></p>
                </div>
                <form onSubmit={handleSaveFiao} className="p-6 space-y-6">
                    <div className="bg-bar-900 p-4 rounded-xl border border-bar-700">
                        <div className="flex justify-between text-sm text-slate-400 mb-2">
                            <span>Cupo Máximo:</span>
                            <span>${selectedCustomer.maxLimit.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-400 mb-2">
                            <span>Deuda Actual:</span>
                            <span className="text-rose-400">${selectedCustomer.currentUsed.toLocaleString()}</span>
                        </div>
                        <div className="border-t border-bar-700 pt-2 flex justify-between font-bold text-white">
                            <span>Disponible:</span>
                            <span className="text-emerald-400">${(selectedCustomer.maxLimit - selectedCustomer.currentUsed).toLocaleString()}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-white mb-2">Valor del Consumo *</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3.5 text-slate-500" size={20} />
                            <input 
                                type="number" 
                                autoFocus
                                required
                                min="1"
                                max={selectedCustomer.maxLimit - selectedCustomer.currentUsed}
                                value={fAmount}
                                onChange={e => {
                                    setFAmount(e.target.value);
                                    setFError('');
                                }}
                                className="w-full bg-bar-900 border border-bar-600 rounded-xl py-3 pl-10 pr-4 text-white text-xl font-bold focus:border-bar-500 outline-none"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-white mb-2">Detalle de Productos (Obligatorio) *</label>
                        <textarea
                            required
                            rows={3}
                            value={fObs}
                            onChange={e => {
                                setFObs(e.target.value);
                                setFError('');
                            }}
                            className="w-full bg-bar-900 border border-bar-600 rounded-xl p-3 text-white focus:border-bar-500 outline-none text-sm"
                            placeholder="Ej: 2 Cervezas Poker + 1 Paquete papas"
                        />
                        <p className="text-xs text-slate-500 mt-1">Describe exactamente qué se llevó el cliente.</p>
                    </div>

                    {fError && <p className="text-rose-400 text-sm flex items-center gap-1 bg-rose-900/20 p-2 rounded"><AlertTriangle size={14} /> {fError}</p>}

                    <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setIsFiaoModalOpen(false)} className="py-3 rounded-lg border border-bar-600 text-slate-300 hover:bg-bar-700 font-medium">
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={!fObs.trim()}
                            className="py-3 rounded-lg bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold shadow-lg shadow-bar-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Confirmar
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- MODAL: REGISTER PAYMENT (ABONO) --- */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-bar-800 w-full max-w-md rounded-2xl border border-bar-600 shadow-2xl">
                <div className="p-6 bg-emerald-900/30 border-b border-bar-700">
                    <h3 className="text-xl font-bold text-white mb-1">Registrar Abono</h3>
                    <p className="text-slate-400 text-sm">Cliente: <span className="text-white font-semibold">{selectedCustomer.name}</span></p>
                </div>
                <form onSubmit={handleSavePayment} className="p-6 space-y-6">
                    <div className="bg-bar-900 p-4 rounded-xl border border-bar-700 flex justify-between items-center">
                         <span className="text-slate-400">Deuda Actual:</span>
                         <span className="text-xl font-bold text-white">${selectedCustomer.currentUsed.toLocaleString()}</span>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-white mb-2">Valor a Abonar *</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-3.5 text-slate-500" size={20} />
                            <input 
                                type="number" 
                                autoFocus
                                required
                                min="1"
                                value={pAmount}
                                onChange={e => {
                                    setPAmount(e.target.value);
                                    setPError('');
                                }}
                                className="w-full bg-bar-900 border border-bar-600 rounded-xl py-3 pl-10 pr-4 text-white text-xl font-bold focus:border-emerald-500 outline-none"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-white mb-2">Método de Pago</label>
                        <div className="grid grid-cols-3 gap-2">
                             <button
                                type="button"
                                onClick={() => setPMethod('CASH')}
                                className={`py-2 px-1 text-xs font-bold rounded-lg border ${pMethod === 'CASH' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-bar-900 border-bar-700 text-slate-400'}`}
                             >
                                EFECTIVO
                             </button>
                             <button
                                type="button"
                                onClick={() => setPMethod('TRANSFER')}
                                className={`py-2 px-1 text-xs font-bold rounded-lg border ${pMethod === 'TRANSFER' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-bar-900 border-bar-700 text-slate-400'}`}
                             >
                                TRANSFERENCIA
                             </button>
                             <button
                                type="button"
                                onClick={() => setPMethod('CARD')}
                                className={`py-2 px-1 text-xs font-bold rounded-lg border ${pMethod === 'CARD' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-bar-900 border-bar-700 text-slate-400'}`}
                             >
                                DATÁFONO
                             </button>
                        </div>
                        {pMethod === 'CASH' ? (
                            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                                <Plus size={12} />
                                Se sumará al dinero a entregar en el cierre.
                            </p>
                        ) : (
                            <p className="text-xs text-slate-400 mt-2">
                                No afecta el efectivo en caja del turno.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Observación (Opcional)</label>
                        <input
                            type="text"
                            value={pObs}
                            onChange={e => setPObs(e.target.value)}
                            className="w-full bg-bar-900 border border-bar-600 rounded-lg p-3 text-white focus:border-bar-500 outline-none text-sm"
                            placeholder="Ej: Pago parcial..."
                        />
                    </div>

                    {pError && <p className="text-rose-400 text-sm flex items-center gap-1 bg-rose-900/20 p-2 rounded"><AlertTriangle size={14} /> {pError}</p>}

                    <div className="grid grid-cols-2 gap-4">
                        <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="py-3 rounded-lg border border-bar-600 text-slate-300 hover:bg-bar-700 font-medium">
                            Cancelar
                        </button>
                        <button type="submit" className="py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20">
                            Registrar Abono
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- MODAL: HISTORY --- */}
      {isHistoryModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-bar-800 w-full max-w-3xl rounded-2xl border border-bar-600 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-bar-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Movimientos</h3>
                        <p className="text-sm text-slate-400">Cliente: {selectedCustomer.name}</p>
                    </div>
                    <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <div className="overflow-y-auto p-0 flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-bar-950 text-slate-400 sticky top-0">
                            <tr>
                                <th className="p-4">Tipo</th>
                                <th className="p-4">Detalle / Obs</th>
                                <th className="p-4">Fecha / Usuario</th>
                                <th className="p-4 text-right">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bar-700">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-slate-500">No hay registros.</td>
                                </tr>
                            ) : (
                                history.map(h => (
                                    <tr key={h.id} className="hover:bg-bar-700/30">
                                        <td className="p-4">
                                            {h.type === 'DEBT' ? (
                                                <span className="flex items-center gap-1 text-rose-400 font-bold text-xs bg-rose-900/20 px-2 py-1 rounded w-fit">
                                                    <ArrowUpCircle size={14} /> FIAO
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs bg-emerald-900/20 px-2 py-1 rounded w-fit">
                                                    <ArrowDownCircle size={14} /> PAGO
                                                </span>
                                            )}
                                            {h.type === 'PAYMENT' && h.paymentMethod && (
                                                <div className="text-[10px] text-slate-500 mt-1 uppercase">{h.paymentMethod === 'CASH' ? 'Efectivo' : h.paymentMethod}</div>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-300 max-w-xs">
                                            <p className="line-clamp-2">{h.observation || '-'}</p>
                                        </td>
                                        <td className="p-4 text-slate-400 text-xs">
                                            <div>{new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            <div className="text-slate-500">{h.employeeName}</div>
                                        </td>
                                        <td className={`p-4 text-right font-bold ${h.type === 'DEBT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {h.type === 'DEBT' ? '+' : '-'}${h.amount.toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-bar-700 bg-bar-900/50 text-right">
                    <span className="text-slate-400 mr-2">Deuda Total Actual:</span>
                    <span className="text-xl font-bold text-white">${selectedCustomer.currentUsed.toLocaleString()}</span>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default CreditCustomers;