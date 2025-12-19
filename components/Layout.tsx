import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Beer, 
  Users, 
  FileBarChart, 
  LogOut, 
  ClipboardList,
  AlertTriangle,
  Search,
  CreditCard,
  History,
  Calculator,
  Settings,
  MessagesSquare
} from 'lucide-react';
import { User, AppConfig } from '../types';
import { getConfig } from '../services/db';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = useState<AppConfig>({ barName: 'BarFlow', lastExportDate: new Date().toISOString() });

  useEffect(() => {
    getConfig().then(setConfig).catch(() => {});
  }, []);

  // Check if data export is needed (Example: > 30 days since last export)
  const daysSinceExport = (new Date().getTime() - new Date(config.lastExportDate).getTime()) / (1000 * 3600 * 24);
  const needsExport = daysSinceExport > 30;

  const isActive = (path: string) => location.pathname === path ? 'bg-bar-800 text-bar-500' : 'text-slate-400 hover:text-white hover:bg-bar-800';

  return (
    <div className="min-h-screen bg-bar-900 flex flex-col md:flex-row">
      {/* Sidebar / Mobile Nav */}
      <aside className="w-full md:w-64 bg-bar-950 border-r border-bar-700 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-bar-700">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Beer className="text-bar-500" />
            <span>{config.barName}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Usuario: {user.name}</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {/* Admin Dashboard */}
            {user.role === 'ADMIN' && (
              <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/')}`}>
                <LayoutDashboard size={20} />
                <span className="font-medium">Dashboard</span>
              </Link>
            )}

            {/* Common Links */}
            <Link to="/inventory" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/inventory')}`}>
              <ClipboardList size={20} />
              <span className="font-medium">Inventario y Turno</span>
            </Link>

            <Link to="/menu" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/menu')}`}>
              <Search size={20} />
              <span className="font-medium">Consulta de Precios</span>
            </Link>
            
            <Link to="/credit" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/credit')}`}>
              <CreditCard size={20} />
              <span className="font-medium">Clientes Fiados</span>
            </Link>

            <Link to="/reports" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/reports')}`}>
              {user.role === 'ADMIN' ? <FileBarChart size={20} /> : <History size={20} />}
              <span className="font-medium">{user.role === 'ADMIN' ? 'Reportes Globales' : 'Historial Turnos'}</span>
            </Link>

            {/* Admin Only Links */}
            {user.role === 'ADMIN' && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Administración</p>
                </div>
                
                <Link to="/accounting" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/accounting')}`}>
                  <Calculator size={20} />
                  <span className="font-medium">Contabilidad</span>
                </Link>
                <Link to="/ai" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/ai')}`}>
                  <MessagesSquare size={20} />
                  <span className="font-medium">Asistente IA</span>
                </Link>

                <Link to="/products" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/products')}`}>
                  <Beer size={20} />
                  <span className="font-medium">Productos y Precios</span>
                </Link>
                <Link to="/settings" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/settings')}`}>
                  <Settings size={20} />
                  <span className="font-medium">Configuracion</span>
                </Link>
                <Link to="/users" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive('/users')}`}>
                  <Users size={20} />
                  <span className="font-medium">Usuarios</span>
                </Link>
              </>
            )}
        </nav>

        <div className="p-4 border-t border-bar-700">
           {needsExport && user.role === 'ADMIN' && (
             <div className="mb-4 bg-rose-900/30 border border-rose-800 p-3 rounded text-sm text-rose-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Alerta: Descarga la información mensual para liberar espacio.</span>
                </div>
                <button 
                  onClick={() => navigate('/reports')}
                  className="text-xs underline mt-1 hover:text-white"
                >
                  Ir a reportes
                </button>
             </div>
           )}

          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bar-800 text-slate-300 hover:bg-rose-900/50 hover:text-rose-200 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto min-h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
