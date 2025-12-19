import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Products from './pages/Products';
import Users from './pages/Users';
import Reports from './pages/Reports';
import PriceList from './pages/PriceList';
import CreditCustomers from './pages/CreditCustomers';
import Accounting from './pages/Accounting'; // Import new page
import Settings from './pages/Settings';
import AiAssistant from './pages/AiAssistant';
import { User } from './types';
import { STORAGE_KEYS } from './constants';
import { initializeDB } from './services/db';

interface AdminRouteProps {
  user: User;
  children: React.ReactNode;
}

// Helper component for Admin-only routes
const AdminRoute: React.FC<AdminRouteProps> = ({ user, children }) => {
  if (user.role !== 'ADMIN') {
    return <Navigate to="/inventory" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await initializeDB();
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          try {
            const res = await fetch((import.meta.env.VITE_API_URL || '/api') + '/me', {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const contentType = res.headers.get('content-type') || '';
              if (contentType.includes('application/json')) {
                const data = await res.json();
                if (data.user) {
                  setUser(data.user);
                  localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(data.user));
                  return;
                }
              }
            } else {
              localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
            }
          } catch (err) {
            console.error('Error validating session', err);
            localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          }
        }
        const stored = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
        if (stored && stored !== 'undefined' && stored !== 'null') {
          try {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id && parsed.role) {
              setUser(parsed);
            } else {
              localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
            }
          } catch (parseErr) {
            console.error('Error parsing stored user session:', parseErr);
            localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
          }
        }
      } catch (error) {
        console.error("Error parsing stored user session:", error);
        localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  };

  if (loading) return null;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          {/* Dashboard only for Admin, otherwise Inventory */}
          <Route 
            path="/" 
            element={user.role === 'ADMIN' ? <Dashboard /> : <Navigate to="/inventory" replace />} 
          />
          
          <Route path="/inventory" element={<Inventory user={user} />} />
          <Route path="/menu" element={<PriceList />} />
          
          <Route path="/credit" element={<CreditCustomers user={user} />} />
          
          {/* Reports accessible to both, internal logic handles view */}
          <Route path="/reports" element={<Reports user={user} />} />
          
          {/* Admin Routes */}
          <Route 
            path="/accounting" 
            element={<AdminRoute user={user}><Accounting /></AdminRoute>} 
          />
          <Route 
            path="/ai" 
            element={<AdminRoute user={user}><AiAssistant /></AdminRoute>} 
          />
          <Route 
            path="/products" 
            element={<AdminRoute user={user}><Products /></AdminRoute>} 
          />
          <Route 
            path="/settings" 
            element={<AdminRoute user={user}><Settings /></AdminRoute>} 
          />
          
          <Route 
            path="/users" 
            element={<AdminRoute user={user}><Users /></AdminRoute>} 
          />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
