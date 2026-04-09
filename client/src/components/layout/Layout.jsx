import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useState } from 'react';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '⚡' },
  { path: '/rag', label: 'RAG Chat', icon: '📚' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-dark-950">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-dark-900/80 border-r border-dark-800 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 border-b border-dark-800">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg shadow-brand-500/20">
              🦞
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-dark-100 text-sm">WebGPU AI</h1>
                <p className="text-xs text-dark-500">Studio</p>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                location.pathname === item.path
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-dark-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-sm font-medium">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-dark-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={handleLogout}
              className="w-full mt-2 px-3 py-2 text-xs text-dark-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            >
              Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
