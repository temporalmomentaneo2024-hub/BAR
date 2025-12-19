import React, { useState } from 'react';
import { Beer, Lock, User as UserIcon, AlertCircle } from 'lucide-react';
import { loginUser } from '../services/db';
import { User } from '../types';
import { STORAGE_KEYS } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await loginUser(username, password);
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, res.token);
      localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(res.user));
      onLogin(res.user);
    } catch (err: any) {
      setError(err.message || 'Error de autenticación');
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bar-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-bar-800 rounded-2xl shadow-2xl border border-bar-700 p-8">
        <div className="text-center mb-8">
          <div className="bg-bar-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-bar-500/20">
            <Beer size={32} className="text-bar-900" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">BarFlow</h1>
          <p className="text-slate-400">Ingresa para gestionar tu bar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/50 text-rose-200 p-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Usuario</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 text-slate-500" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-bar-900 border border-bar-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-bar-500 focus:ring-1 focus:ring-bar-500 transition-colors"
                placeholder="Usuario"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bar-900 border border-bar-700 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-bar-500 focus:ring-1 focus:ring-bar-500 transition-colors"
                placeholder="********"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-3 rounded-lg transition-transform active:scale-95 disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
