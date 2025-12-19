import React, { useEffect, useState } from 'react';
import { getSessions, getActiveSession, getAiInsights, getAiConfig, isAiEnabled } from '../services/db';
import { ShiftSession, AiInsight, AiAgentConfig } from '../types';
import { TrendingUp, DollarSign, Calendar, Clock, Sparkles, AlertTriangle, MessagesSquare } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Dashboard: React.FC = () => {
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [pastSessions, setPastSessions] = useState<ShiftSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState<AiInsight | null>(null);
  const [aiConfig, setAiConfig] = useState<AiAgentConfig | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const active = await getActiveSession();
        const all = await getSessions();
        const cfg = await getAiConfig();
        setAiConfig(cfg);
        getAiInsights()
          .then(setAiInsights)
          .catch((e) => setAiError(e?.message || 'No se pudo cargar analisis basico'));
        setActiveSession(active);
        setPastSessions(all.slice(-7)); // Last 7 sessions
      } catch (e) {
        console.error('Error loading dashboard data', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="text-white">Cargando estadisticas...</div>;

  const totalRevenue = pastSessions.reduce((acc, s) => acc + (s.salesReport?.totalRevenue || 0), 0);
  const totalProfit = pastSessions.reduce((acc, s) => acc + (s.salesReport?.totalProfit || 0), 0);

  const chartData = pastSessions.map((s) => {
    let dateLabel = 'N/A';
    try {
      if (s.openedAt) {
        dateLabel = new Date(s.openedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      }
    } catch {
      // ignore bad date
    }

    return {
      date: dateLabel,
      ventas: s.salesReport?.totalRevenue || 0,
      ganancia: s.salesReport?.totalProfit || 0
    };
  });

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white">Resumen General</h2>
        <p className="text-slate-400">Estado actual de la contabilidad</p>
      </div>

      <div className={`p-6 rounded-xl border ${activeSession ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-bar-800 border-bar-700'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock size={20} className={activeSession ? 'text-emerald-400' : 'text-slate-400'} />
              Turno Actual
            </h3>
            <p className="text-slate-400 mt-1">
              {activeSession && activeSession.openedAt
                ? `Abierto desde: ${new Date(activeSession.openedAt).toLocaleString()}`
                : 'No hay un turno abierto actualmente.'}
            </p>
          </div>
          {activeSession && (
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium animate-pulse">
              En Curso
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Ventas (ultimos turnos)</span>
            <DollarSign className="text-bar-500" size={20} />
          </div>
          <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Ganancia Estimada</span>
            <TrendingUp className="text-emerald-500" size={20} />
          </div>
          <p className="text-2xl font-bold text-white">${totalProfit.toLocaleString()}</p>
        </div>

        <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Turnos Registrados</span>
            <Calendar className="text-blue-500" size={20} />
          </div>
          <p className="text-2xl font-bold text-white">{pastSessions.length}</p>
        </div>
      </div>

      <div className="bg-bar-800 p-6 rounded-xl border border-bar-700 h-80">
        <h3 className="text-lg font-semibold text-white mb-4">Ventas vs Ganancias (ultimos 7 turnos)</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                itemStyle={{ color: '#f1f5f9' }}
              />
              <Bar dataKey="ventas" fill="#f59e0b" name="Ventas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ganancia" fill="#10b981" name="Ganancia" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            <p>No hay datos suficientes para mostrar el grafico</p>
          </div>
        )}
      </div>

      <div className="bg-bar-800 p-6 rounded-xl border border-bar-700 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500 font-bold tracking-wide">Analisis del agente</p>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-bar-500" /> Ideas rapidas
            </h3>
            <p className="text-slate-400 text-sm">Se ejecuta al iniciar sesion. No bloquea la app si la IA falla.</p>
          </div>
          <div className={`px-3 py-1 rounded text-xs ${isAiEnabled(aiConfig) ? 'bg-emerald-900/30 text-emerald-200' : 'bg-slate-800 text-slate-300'}`}>
            {isAiEnabled(aiConfig) ? 'IA activa' : 'Modo basico'}
          </div>
        </div>

        {aiError && (
          <div className="flex items-center gap-2 text-rose-200 text-sm bg-rose-900/30 border border-rose-800 rounded-lg p-3">
            <AlertTriangle size={16} /> {aiError}
          </div>
        )}

        {aiInsights ? (
          <>
            <p className="text-slate-200 text-sm">{aiInsights.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiInsights.topProducts.slice(0, 4).map((p) => (
                <div key={p.name} className="bg-bar-900 border border-bar-700 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm text-white font-semibold">
                    <span>{p.name}</span>
                    <span className="text-bar-400">${p.revenue.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Unidades: {p.quantity.toLocaleString()}</p>
                </div>
              ))}
              {aiInsights.topProducts.length === 0 && (
                <div className="text-slate-500 text-sm">Sin datos de ventas suficientes.</div>
              )}
            </div>
            <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
              {aiInsights.suggestions.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
            <div className="flex justify-end">
              <a href="#/ai" className="inline-flex items-center gap-2 text-bar-400 hover:text-bar-300 text-sm font-semibold">
                Ir al chat IA <MessagesSquare size={16} />
              </a>
            </div>
          </>
        ) : (
          <p className="text-slate-500 text-sm">Obteniendo ideas del agente...</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
