import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, KeyRound, Loader2, Save, Shield, Wand2 } from 'lucide-react';
import { AiAgentConfig, AiProvider } from '../types';
import { DEFAULT_AI_PROMPT } from '../constants';
import { getAiConfig, isAiEnabled, saveAiConfig, testAiConnection, getConfig, updateConfig, clearHistoricalData } from '../services/db';

const providerOptions: { value: AiProvider; label: string; hint: string }[] = [
  { value: 'GEMINI', label: 'Gemini', hint: 'Velocidad y buen contexto' },
  { value: 'OPENAI', label: 'OpenAI (GPT)', hint: 'Modelo versatil' }
];

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [provider, setProvider] = useState<AiProvider>('GEMINI');
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState(DEFAULT_AI_PROMPT);
  const [config, setConfig] = useState<AiAgentConfig | null>(null);
  const [status, setStatus] = useState<{ type: 'ok' | 'warn' | 'error' | 'info'; message: string } | null>(null);
  const [barName, setBarName] = useState('BarFlow');

  const aiReady = useMemo(() => isAiEnabled(config), [config]);

  useEffect(() => {
    const load = async () => {
      try {
        const cfg = await getAiConfig();
        setConfig(cfg);
        setProvider(cfg.provider || 'GEMINI');
        setPrompt(cfg.prompt || DEFAULT_AI_PROMPT);
        const baseCfg = await getConfig();
        setBarName(baseCfg.barName || 'BarFlow');
        setStatus({
          type: cfg.validated ? 'ok' : 'info',
          message: cfg.validated ? 'Agente listo. Conexion validada.' : 'Configura y prueba la API para activar el agente.'
        });
      } catch (err: any) {
        setStatus({ type: 'warn', message: err?.message || 'No se pudo cargar la configuracion de IA (modo basico activo).' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const cfg = await saveAiConfig({ provider, prompt, apiKey: apiKey || undefined });
      setConfig(cfg);
      setApiKey('');
      setStatus({
        type: 'ok',
        message: cfg.validated ? 'Configuracion guardada y validada.' : 'Configuracion guardada. Falta validar la API.'
      });
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'No se pudo guardar la configuracion' });
    } finally {
      setSaving(false);
    }
  };

  const handleFactoryReset = async () => {
    if (!window.confirm('Esto borrara datos historicos almacenados. ¿Quieres continuar?')) return;
    setResetting(true);
    try {
      await clearHistoricalData();
      localStorage.clear();
      setStatus({ type: 'ok', message: 'Datos restablecidos. Recarga para continuar.' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'No se pudo restablecer los datos' });
    } finally {
      setResetting(false);
    }
  };

  const handleSaveName = async () => {
    setSavingName(true);
    try {
      await updateConfig({ barName });
      setStatus({ type: 'ok', message: 'Nombre del bar actualizado.' });
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.message || 'No se pudo actualizar el nombre del bar' });
    } finally {
      setSavingName(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus({ type: 'info', message: 'Probando conexion con el proveedor seleccionado...' });
    const res = await testAiConnection({ provider, apiKey: apiKey || undefined });
    if (res.ok && res.config) {
      setConfig(res.config);
      setApiKey('');
      setStatus({ type: 'ok', message: res.message || 'Conexion exitosa' });
    } else {
      setStatus({ type: 'warn', message: res.message || 'No se pudo validar la API Key. Se mantiene el modo basico.' });
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="text-slate-400 flex items-center gap-2">
        <Loader2 className="animate-spin" size={16} /> Cargando configuracion...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white">Configuracion</h2>
          <p className="text-slate-400">Gestiona el agente de IA y su prompt base.</p>
        </div>
        <div className={`px-4 py-2 rounded-lg text-sm border ${aiReady ? 'border-emerald-700 bg-emerald-900/30 text-emerald-200' : 'border-slate-700 bg-slate-800/50 text-slate-200'}`}>
          {aiReady ? 'IA habilitada' : 'IA en modo basico'}
        </div>
      </div>

      {status && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border text-sm ${
            status.type === 'ok'
              ? 'border-emerald-700 bg-emerald-900/20 text-emerald-100'
              : status.type === 'error'
              ? 'border-rose-700 bg-rose-900/30 text-rose-100'
              : status.type === 'warn'
              ? 'border-amber-700 bg-amber-900/30 text-amber-100'
              : 'border-slate-700 bg-slate-800/60 text-slate-200'
          }`}
        >
          {status.type === 'ok' ? <CheckCircle size={18} /> : status.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
          <span>{status.message}</span>
        </div>
      )}

      <div className="bg-bar-800 border border-bar-700 rounded-xl shadow-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500 font-bold tracking-wide">Datos generales</p>
            <h3 className="text-lg text-white font-semibold">Nombre del bar</h3>
            <p className="text-slate-400 text-sm">Actualiza el nombre visible en la aplicacion.</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            value={barName}
            onChange={(e) => setBarName(e.target.value)}
            className="flex-1 bg-bar-900 border border-bar-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-bar-500"
            placeholder="Nombre del bar"
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || !barName.trim()}
            className="px-4 py-3 bg-bar-600 hover:bg-bar-500 text-white rounded-lg font-semibold disabled:opacity-60"
          >
            {savingName ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
        <div className="pt-3 border-t border-bar-700">
          <p className="text-xs uppercase text-slate-500 font-bold tracking-wide mb-2">Zona de mantenimiento</p>
          <button
            onClick={handleFactoryReset}
            disabled={resetting}
            className="px-4 py-3 bg-rose-900/50 hover:bg-rose-800 text-rose-100 rounded-lg font-semibold transition-colors disabled:opacity-60"
          >
            {resetting ? 'Restableciendo...' : 'Restablecer datos de fabrica'}
          </button>
          <p className="text-xs text-slate-500 mt-1">Solo para administradores. Borra datos historicos y limpia la sesion local.</p>
        </div>
      </div>

      <div className="bg-bar-800 border border-bar-700 rounded-xl shadow-lg divide-y divide-bar-700">
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-slate-500 font-bold tracking-wide">Pestana</p>
            <h3 className="text-xl text-white font-semibold">Agente de IA</h3>
            <p className="text-slate-400 text-sm">Solo ADMIN puede editar esta configuracion.</p>
          </div>
          <Shield className="text-bar-500" />
        </div>

        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-slate-300 font-semibold flex items-center gap-2">
              <Wand2 size={16} className="text-bar-500" /> Proveedor
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {providerOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setProvider(opt.value)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    provider === opt.value
                      ? 'border-bar-500 bg-bar-700/60 text-white'
                      : 'border-bar-700 bg-bar-900/60 text-slate-300 hover:border-bar-500'
                  }`}
                >
                  <div className="font-bold">{opt.label}</div>
                  <div className="text-xs text-slate-400">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-300 font-semibold flex items-center gap-2">
              <KeyRound size={16} className="text-bar-500" /> API Key del proveedor
            </p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Pega tu API Key aqui (se guarda de forma segura)"
              className="w-full bg-bar-900 border border-bar-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-bar-500"
            />
            <p className="text-xs text-slate-500">No se comparte con otros usuarios. Si falla, el resto de la app sigue funcionando.</p>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-bar-700 hover:bg-bar-600 text-white font-semibold transition-colors disabled:opacity-60"
            >
              {testing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
              Probar conexion
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-bar-600 hover:bg-bar-500 text-white font-semibold transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Guardar cambios
            </button>
          </div>
        </div>
      </div>

      <div className="bg-bar-800 border border-bar-700 rounded-xl shadow-lg p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500 font-bold tracking-wide">Prompt base del agente</p>
            <p className="text-slate-300 text-sm">Define como el agente analiza ventas, inventarios, cierres de turno y gastos.</p>
          </div>
          <Info className="text-bar-500" size={18} />
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          className="w-full bg-bar-900 border border-bar-700 rounded-lg p-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-bar-500"
        />
        <div className="text-xs text-slate-500 space-y-1">
          <p>Editable en cualquier momento. Se guarda de forma persistente y no afecta otras funciones si la IA esta desactivada.</p>
          <p>Si la API no esta disponible, se muestran datos reales sin IA y se evitan errores visibles.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
