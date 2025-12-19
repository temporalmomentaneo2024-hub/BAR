import React, { useEffect, useMemo, useState } from 'react';
import { Send, Brain, Shield, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
import { AiAgentConfig, AiChatMessage, AiInsight } from '../types';
import { getAiConfig, getAiInsights, isAiEnabled, sendAiMessage } from '../services/db';

const AiAssistant: React.FC = () => {
  const [config, setConfig] = useState<AiAgentConfig | null>(null);
  const [insights, setInsights] = useState<AiInsight | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = useMemo(() => isAiEnabled(config), [config]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const cfg = await getAiConfig();
        setConfig(cfg);
        const insight = await getAiInsights();
        setInsights(insight);
        setMessages([
          {
            role: 'assistant',
            content:
              cfg.validated && cfg.hasApiKey
                ? 'Agente listo. Pide un resumen o pregunta por productos y oportunidades.'
                : 'Modo basico. Configura y valida la API para habilitar al agente. Aun asi puedes ver ideas rapidas.',
            ts: new Date().toISOString(),
            source: cfg.validated && cfg.hasApiKey ? 'AI' : 'BASIC'
          }
        ]);
      } catch (err: any) {
        setError(err?.message || 'No se pudo cargar el asistente. El resto de la app sigue operando.');
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: AiChatMessage = { role: 'user', content: input.trim(), ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    const res = await sendAiMessage(userMsg.content);
    if (res.config) setConfig(res.config);
    setMessages((prev) => [...prev, res.reply]);
    setSending(false);
  };

  if (loading) {
    return (
      <div className="text-slate-400 flex items-center gap-2">
        <Loader2 className="animate-spin" size={16} /> Cargando asistente...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold text-white">Asistente IA</h2>
          <p className="text-slate-400 text-sm">Analisis continuo y chat para administradores.</p>
        </div>
        <div
          className={`px-3 py-2 rounded-lg text-sm border ${
            enabled ? 'border-emerald-600 bg-emerald-900/30 text-emerald-200' : 'border-slate-700 bg-slate-800/60 text-slate-200'
          }`}
        >
          {enabled ? 'IA activa' : 'Modo basico'}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-rose-700 bg-rose-900/30 text-rose-100 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {insights && (
        <div className="bg-bar-800 border border-bar-700 rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-slate-500 font-bold tracking-wide">Analisis al iniciar sesion</p>
              <h3 className="text-lg text-white font-semibold">{insights.title}</h3>
              <p className="text-slate-300 text-sm">{insights.summary}</p>
            </div>
            <Brain className="text-bar-500" />
          </div>
          {insights.topProducts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {insights.topProducts.map((p) => (
                <div key={p.name} className="bg-bar-900 border border-bar-700 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm text-white font-semibold">
                    <span>{p.name}</span>
                    <span className="text-bar-400">${p.revenue.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Unidades: {p.quantity.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
          <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
            {insights.suggestions.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-bar-800 border border-bar-700 rounded-xl flex flex-col h-[500px]">
        <div className="flex items-center justify-between p-4 border-b border-bar-700">
          <div className="flex items-center gap-2 text-slate-200 text-sm">
            <Sparkles size={16} className="text-bar-500" />
            Chatea con el agente para ideas de crecimiento. Evita usarlo para acciones criticas.
          </div>
          {!enabled && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Shield size={14} /> Se usa modo basico sin API.
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`max-w-3xl p-3 rounded-lg text-sm ${
                m.role === 'assistant'
                  ? 'bg-bar-700 text-white border border-bar-600'
                  : 'bg-bar-600 text-white border border-bar-500 ml-auto'
              }`}
            >
              <div className="text-xs text-slate-300 mb-1">
                {m.role === 'assistant' ? 'Asistente' : 'Tu'} {m.source === 'BASIC' ? '(basico)' : ''}
              </div>
              <div className="whitespace-pre-line">{m.content}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-bar-700 p-4 flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder={enabled ? 'Escribe una pregunta sobre ventas, inventario o oportunidades...' : 'Configura la API para habilitar IA. Puedes enviar para modo basico.'}
            className="flex-1 bg-bar-900 border border-bar-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-bar-500 resize-none"
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-3 bg-bar-600 hover:bg-bar-500 text-white rounded-lg flex items-center gap-2 font-semibold disabled:opacity-60"
          >
            {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiAssistant;
