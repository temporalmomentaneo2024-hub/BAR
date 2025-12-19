import React, { useState, useEffect } from 'react';
import { getUsers, saveUser, deleteUser } from '../services/db';
import { User, Role } from '../types';
import { Plus, Trash2, User as UserIcon, Shield } from 'lucide-react';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !name) return;

    const newUser: User = {
      id: '', // DB service will generate safe ID
      username,
      name,
      password,
      role
    };

    await saveUser(newUser);
    setUsername('');
    setName('');
    setPassword('');
    setRole('EMPLOYEE');
    loadUsers();
  };

  const handleDelete = async (id: string) => {
    try {
        if(window.confirm("¿Eliminar usuario?")) {
            await deleteUser(id);
            loadUsers();
        }
    } catch (e: any) {
        alert(e.message || "Error al eliminar");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Create User Form */}
      <div className="bg-bar-800 p-6 rounded-xl border border-bar-700 h-fit">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Plus size={20} className="text-bar-500" />
          Crear Usuario
        </h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre Completo</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none focus:border-bar-500" placeholder="Ej. Juan Pérez" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre de Usuario</label>
            <input value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none focus:border-bar-500" placeholder="Ej. juanp" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none focus:border-bar-500" placeholder="••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Rol</label>
            <select value={role} onChange={e => setRole(e.target.value as Role)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-white outline-none focus:border-bar-500">
              <option value="EMPLOYEE">Empleado (Limitado)</option>
              <option value="ADMIN">Administrador (Total)</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-2 rounded-lg mt-2 transition-colors">
            Crear Usuario
          </button>
        </form>
      </div>

      {/* User List */}
      <div className="lg:col-span-2 space-y-4">
        <h2 className="text-2xl font-bold text-white">Usuarios del Sistema</h2>
        <div className="grid gap-4">
            {users.map(user => (
                <div key={user.id} className="bg-bar-800 border border-bar-700 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.role === 'ADMIN' ? 'bg-purple-900/50 text-purple-400' : 'bg-slate-700/50 text-slate-400'}`}>
                            {user.role === 'ADMIN' ? <Shield size={20} /> : <UserIcon size={20} />}
                        </div>
                        <div>
                            <p className="font-bold text-white">{user.name}</p>
                            <p className="text-sm text-slate-400">@{user.username} • {user.role === 'ADMIN' ? 'Administrador' : 'Empleado'}</p>
                        </div>
                    </div>
                    {/* Admin cannot delete themselves/last admin usually, handled in service */}
                    <button 
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-900/50 rounded-lg transition-colors"
                        title="Eliminar usuario"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Users;