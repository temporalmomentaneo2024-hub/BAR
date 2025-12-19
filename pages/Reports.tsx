import React, { useState, useEffect } from 'react';
import { getSessions, clearHistoricalData, getUsers, reopenSession, deleteShift } from '../services/db';
import { ShiftSession, User } from '../types';
import { Download, Archive, Info, Eye, RotateCcw, Search, Calendar, DollarSign, User as UserIcon, AlertTriangle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS } from '../constants';

interface Props {
  user?: User; // Optional because Layout might pass it, but we also read from local if needed
}

const Reports: React.FC<Props> = () => {
  const [sessions, setSessions] = useState<ShiftSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ShiftSession[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  // User state
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Modal State
  const [selectedSession, setSelectedSession] = useState<ShiftSession | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [isReopenMode, setIsReopenMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [filterUser, setFilterUser] = useState('ALL');
  
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
        try {
          // Get Current User
          const storedUser = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
          if(!storedUser) {
            setLoading(false);
            return;
          }
          const user = JSON.parse(storedUser) as User;
          setCurrentUser(user);

          // Get users map only if admin (endpoint es solo para ADMIN)
          if (user.role === 'ADMIN') {
            const allUsers = await getUsers();
            const uMap: Record<string, string> = {};
            allUsers.forEach(u => uMap[u.id] = u.name);
            setUsersMap(uMap);
          } else {
            setUsersMap({ [user.id]: user.name });
          }

          // Get Sessions
          const data = await getSessions();
          // Sort descending
          const sorted = data.sort((a,b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
          setSessions(sorted);
          
          // Initial Filter
          if(user.role === 'EMPLOYEE') {
              setFilteredSessions(sorted.filter(s => s.closedBy === user.id));
          } else {
              setFilteredSessions(sorted);
          }
        } catch (err) {
          console.error('Error cargando historial', err);
        } finally {
          setLoading(false);
        }
    };
    load();
  }, []);

  useEffect(() => {
     if(!currentUser) return;
     
     if (currentUser.role === 'ADMIN') {
         if(filterUser === 'ALL') {
             setFilteredSessions(sessions);
         } else {
             setFilteredSessions(sessions.filter(s => s.closedBy === filterUser));
         }
     }
  }, [filterUser, sessions, currentUser]);

  const handleExport = () => {
    const dataStr = JSON.stringify(sessions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `barflow_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if(window.confirm("La descarga ha comenzado. ¿Deseas limpiar los datos históricos?")) {
        clearHistoricalData();
        setSessions([]);
        setFilteredSessions([]);
    }
  };

  const openDetail = (session: ShiftSession) => {
      setSelectedSession(session);
      setIsDetailOpen(true);
      setIsReopenMode(false);
      setReopenReason('');
  };

  const handleReopen = async () => {
      if(!selectedSession || !currentUser || !reopenReason.trim()) return;
      
      try {
          await reopenSession(selectedSession.id, reopenReason, currentUser);
          setIsDetailOpen(false);
          alert("Turno reabierto correctamente. Redirigiendo a Inventario...");
          navigate('/inventory');
      } catch (e: any) {
          alert("Error: " + e.message);
      }
  };

  const handleDelete = async () => {
    if (!selectedSession || !currentUser || currentUser.role !== 'ADMIN') return;
    if (!window.confirm('¿Seguro que deseas eliminar este turno? Esta acción no se puede deshacer.')) return;
    setIsDeleting(true);
    try {
      await deleteShift(selectedSession.id);
      const remaining = sessions.filter((s) => s.id !== selectedSession.id);
      setSessions(remaining);
      setFilteredSessions(remaining);
      setIsDetailOpen(false);
    } catch (e: any) {
      alert('No se pudo eliminar el turno: ' + e.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if(loading || !currentUser) return <div className="text-slate-400 p-8">Cargando historial...</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-3xl font-bold text-white">Historial de Turnos</h2>
            <p className="text-slate-400">
                {currentUser.role === 'ADMIN' ? 'Gestión global y auditoría' : 'Mis turnos cerrados'}
            </p>
        </div>
        
        {currentUser.role === 'ADMIN' && (
             <button
                onClick={handleExport}
                className="flex items-center gap-2 bg-bar-800 hover:bg-bar-700 text-slate-300 border border-bar-600 px-4 py-2 rounded-lg text-sm transition-colors"
             >
                <Download size={16} /> Exportar JSON
             </button>
        )}
      </div>

      {/* ADMIN FILTERS */}
      {currentUser.role === 'ADMIN' && (
          <div className="bg-bar-800 p-4 rounded-xl border border-bar-700 flex items-center gap-4">
              <span className="text-slate-400 text-sm font-bold flex items-center gap-2">
                  <Search size={16} /> Filtrar por:
              </span>
              <select 
                value={filterUser} 
                onChange={e => setFilterUser(e.target.value)}
                className="bg-bar-900 border border-bar-600 rounded-lg p-2 text-white text-sm outline-none focus:border-bar-500"
              >
                  <option value="ALL">Todos los empleados</option>
                  {Object.entries(usersMap).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                  ))}
              </select>
          </div>
      )}

      {/* MAIN TABLE */}
      <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-bar-950 text-slate-400 uppercase tracking-wider">
                        <th className="p-4">Fecha Cierre</th>
                        <th className="p-4">Cajero</th>
                        <th className="p-4 text-center">Estado</th>
                        <th className="p-4 text-right">Venta Total</th>
                        <th className="p-4 text-right">Entregado (Efectivo)</th>
                        <th className="p-4 text-right">Diferencia</th>
                        <th className="p-4 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-bar-700">
                    {filteredSessions.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-slate-500">No se encontraron registros.</td></tr>
                    ) : (
                        filteredSessions.map(s => {
                            const diff = s.salesReport?.difference || 0;
                            const hasDiff = Math.abs(diff) > 0;
                            
                            return (
                                <tr key={s.id} className="hover:bg-bar-700/30 transition-colors">
                                    <td className="p-4 text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} className="text-slate-500"/>
                                            {new Date(s.closedAt || s.openedAt).toLocaleDateString()}
                                        </div>
                                        <div className="text-xs text-slate-500 ml-6">
                                            {new Date(s.closedAt || s.openedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </td>
                                    <td className="p-4 text-white font-medium">
                                        {usersMap[s.closedBy || ''] || 'Desconocido'}
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${s.status === 'CLOSED' ? 'bg-slate-700 text-slate-300' : 'bg-amber-900 text-amber-300'}`}>
                                            {s.status === 'CLOSED' ? 'CERRADO' : s.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right text-slate-300">
                                        ${(s.salesReport?.totalRevenue || 0).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-right font-mono text-emerald-400">
                                        ${(s.realCash || s.salesReport?.cashToDeliver || 0).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        {s.salesReport?.difference !== undefined ? (
                                             <span className={`font-bold ${diff < 0 ? 'text-rose-400' : (diff > 0 ? 'text-blue-400' : 'text-slate-500')}`}>
                                                 {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                             </span>
                                        ) : <span className="text-slate-600">-</span>}
                                    </td>
                                    <td className="p-4 flex justify-center">
                                        <button 
                                            onClick={() => openDetail(s)}
                                            className="p-2 bg-bar-700 hover:bg-bar-600 text-white rounded-lg flex items-center gap-2 transition-colors text-xs font-bold"
                                        >
                                            <Eye size={16} /> Ver Detalle
                                        </button>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* --- DETAIL MODAL --- */}
      {isDetailOpen && selectedSession && selectedSession.salesReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-bar-800 w-full max-w-2xl rounded-2xl border border-bar-600 shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-bar-700 flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                           <FileText size={20} className="text-bar-500"/> Detalle de Turno
                        </h3>
                        <p className="text-slate-400 text-sm mt-1">
                            Cerrado por <span className="text-white font-medium">{usersMap[selectedSession.closedBy || '']}</span> el {new Date(selectedSession.closedAt || '').toLocaleString()}
                        </p>
                    </div>
                    <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-white bg-bar-900 p-2 rounded-lg">
                        <Archive size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Financial Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-bar-900 p-3 rounded-lg border border-bar-700">
                            <p className="text-slate-500 text-xs uppercase font-bold">Venta Total</p>
                            <p className="text-white font-mono text-lg">${selectedSession.salesReport.totalRevenue.toLocaleString()}</p>
                        </div>
                        <div className="bg-bar-900 p-3 rounded-lg border border-bar-700">
                             <p className="text-slate-500 text-xs uppercase font-bold">Fiaos (Deuda)</p>
                             <p className="text-rose-400 font-mono text-lg">-${selectedSession.salesReport.totalCreditSales.toLocaleString()}</p>
                        </div>
                        <div className="bg-bar-900 p-3 rounded-lg border border-bar-700">
                             <p className="text-slate-500 text-xs uppercase font-bold">Abonos (Efec)</p>
                             <p className="text-emerald-400 font-mono text-lg">+${selectedSession.salesReport.totalCashPayments.toLocaleString()}</p>
                        </div>
                        <div className="bg-bar-900 p-3 rounded-lg border border-bar-700">
                             <p className="text-slate-500 text-xs uppercase font-bold">Gastos</p>
                             <p className="text-slate-300 font-mono text-lg">$0</p>
                        </div>
                    </div>

                    {/* Cash Reconciliation */}
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <h4 className="text-white font-bold mb-3 flex items-center gap-2">
                            <DollarSign size={18} className="text-emerald-500"/> Cuadre de Caja
                        </h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-slate-300">
                                <span>Dinero Teórico (Sistema):</span>
                                <span className="font-mono">${selectedSession.salesReport.cashToDeliver.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-white font-bold text-base">
                                <span>Dinero Entregado (Real):</span>
                                <span className="font-mono text-emerald-400">${(selectedSession.realCash || 0).toLocaleString()}</span>
                            </div>
                            <div className="border-t border-slate-600 pt-2 flex justify-between items-center">
                                <span>Diferencia:</span>
                                <span className={`font-mono font-bold px-2 py-1 rounded ${
                                    (selectedSession.salesReport.difference || 0) < 0 ? 'bg-rose-900 text-rose-300' :
                                    (selectedSession.salesReport.difference || 0) > 0 ? 'bg-blue-900 text-blue-300' :
                                    'bg-slate-700 text-slate-300'
                                }`}> 
                                    {(selectedSession.salesReport.difference || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Product detail */}
                    <div className="bg-bar-900/50 p-4 rounded-xl border border-bar-700">
                      <h4 className="text-white font-bold mb-3">Detalle por producto</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-bar-950 text-slate-400 uppercase tracking-wider">
                            <tr>
                              <th className="p-3 text-left">Producto</th>
                              <th className="p-3 text-center">Vendidas</th>
                              <th className="p-3 text-center">Stock final</th>
                              <th className="p-3 text-right">Ingreso</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-bar-700">
                            {(selectedSession.salesReport.itemsSold || []).map((it) => {
                              const finalCount = (selectedSession.finalInventory || []).find((f:any) => f.productId === it.productId)?.count ?? '-';
                              return (
                                <tr key={it.productId} className="hover:bg-bar-800/50">
                                  <td className="p-3 text-white font-medium">{it.productName}</td>
                                  <td className="p-3 text-center text-slate-200 font-bold">{it.quantity}</td>
                                  <td className="p-3 text-center text-slate-400">{finalCount}</td>
                                  <td className="p-3 text-right text-emerald-400 font-mono">${(it.revenue || 0).toLocaleString()}</td>
                                </tr>
                              );
                            })}
                            {(selectedSession.salesReport.itemsSold || []).length === 0 && (
                              <tr>
                                <td colSpan={4} className="p-4 text-center text-slate-500">Sin registros de productos.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Observations */}
                    <div>
                        <h4 className="text-slate-400 text-sm font-bold mb-2">Observaciones del Cierre</h4>
                        <div className="bg-bar-900 p-3 rounded-lg border border-bar-700 text-sm text-slate-300 italic min-h-[60px]">
                            {selectedSession.closingObservation || "Sin observaciones."}
                        </div>
                    </div>

                    {/* Audit Log (If exists) */}
                    {selectedSession.auditLog && selectedSession.auditLog.length > 0 && (
                        <div>
                             <h4 className="text-amber-500 text-sm font-bold mb-2 flex items-center gap-2"><AlertTriangle size={14}/> Auditoría</h4>
                             <div className="space-y-2">
                                 {selectedSession.auditLog.map((log, idx) => (
                                     <div key={idx} className="text-xs bg-amber-900/10 border border-amber-900/30 p-2 rounded text-amber-200">
                                         <span className="font-bold">{log.action}: </span> {log.reason} - {log.userName} ({new Date(log.date).toLocaleString()})
                                     </div>
                                 ))}
                             </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-bar-700 bg-bar-900/50 rounded-b-2xl">
                    {currentUser.role === 'ADMIN' ? (
                        !isReopenMode ? (
                            <button 
                                onClick={() => setIsReopenMode(true)}
                                className="w-full bg-rose-900/50 hover:bg-rose-900 text-rose-200 border border-rose-800 py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors"
                            >
                                <RotateCcw size={18} /> Reabrir Turno (Corregir)
                            </button>
                        ) : (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                <label className="block text-sm text-rose-300 font-bold">Motivo de reapertura (Obligatorio)</label>
                                <input 
                                    type="text" 
                                    autoFocus
                                    value={reopenReason}
                                    onChange={e => setReopenReason(e.target.value)}
                                    placeholder="Ej: Olvidé registrar un pago de $50.000..."
                                    className="w-full bg-bar-950 border border-rose-700 rounded-lg p-3 text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                                />
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setIsReopenMode(false)}
                                        className="flex-1 py-3 bg-slate-800 text-slate-400 hover:text-white rounded-lg font-medium"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={handleReopen}
                                        disabled={!reopenReason.trim()}
                                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold disabled:opacity-50"
                                    >
                                        Confirmar Reapertura
                                    </button>
                                </div>
                            </div>
                        )
                    ) : (
                        <button onClick={() => setIsDetailOpen(false)} className="w-full bg-bar-700 text-white py-3 rounded-lg font-bold">
                            Cerrar
                        </button>
                    )}
                    {currentUser.role === 'ADMIN' && (
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="mt-3 w-full bg-bar-800 hover:bg-bar-700 text-rose-200 border border-rose-800 py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? 'Eliminando...' : 'Eliminar turno'}
                      </button>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

