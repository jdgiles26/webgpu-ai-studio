import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';

const API = import.meta.env.VITE_API_URL || '/api';

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/auth/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        setError('Failed to load users');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/auth/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        fetchUsers();
      }
    } catch (err) {
      setError('Failed to reject user');
    }
  };

  const filteredUsers = users.filter(u => {
    if (activeTab === 'all') return true;
    return u.status === activeTab;
  });

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <span className="text-5xl mb-4 block">🔒</span>
          <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
          <p className="text-dark-400">Only administrators can access this panel.</p>
        </div>
      </div>
    );
  }

  const stats = {
    total: users.length,
    pending: users.filter(u => u.status === 'pending').length,
    approved: users.filter(u => u.status === 'approved').length,
    rejected: users.filter(u => u.status === 'rejected').length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">🛡️ Admin Panel</h1>
      <p className="text-dark-400 mb-8">Manage user registrations and access</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="glass-panel p-4">
          <p className="text-sm text-dark-500">Total Users</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="glass-panel p-4 border-yellow-500/30">
          <p className="text-sm text-yellow-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
        </div>
        <div className="glass-panel p-4 border-green-500/30">
          <p className="text-sm text-green-500">Approved</p>
          <p className="text-2xl font-bold text-green-400">{stats.approved}</p>
        </div>
        <div className="glass-panel p-4 border-red-500/30">
          <p className="text-sm text-red-500">Rejected</p>
          <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['pending', 'approved', 'rejected', 'all'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === tab
                ? 'bg-brand-600 text-white'
                : 'bg-dark-900 text-dark-400 hover:bg-dark-800 border border-dark-800'
            }`}
          >
            {tab} ({tab === 'all' ? stats.total : stats[tab] || 0})
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="text-center py-12 text-dark-500">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading users...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 text-dark-500">
          <span className="text-4xl mb-3 block">📭</span>
          <p>No {activeTab} users</p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-left px-4 py-3 text-dark-400 font-medium">User</th>
                <th className="text-left px-4 py-3 text-dark-400 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-dark-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-dark-400 font-medium">Registered</th>
                <th className="text-left px-4 py-3 text-dark-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} className="border-b border-dark-800/50 hover:bg-dark-900/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-xs font-medium">
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-dark-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                      u.status === 'approved' ? 'bg-green-500/10 text-green-400' :
                      u.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dark-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.status === 'pending' && (
                      <div className="flex gap-2">
                        <a
                          href={`${import.meta.env.VITE_API_URL || '/api'}/auth/approve/${u.approval_token || ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-xs hover:bg-green-500/20 transition-colors"
                        >
                          Approve
                        </a>
                        <button
                          onClick={() => handleReject(u.id)}
                          className="px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {u.status === 'approved' && (
                      <button
                        onClick={() => handleReject(u.id)}
                        className="px-3 py-1 bg-red-500/10 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                    {u.status === 'rejected' && (
                      <span className="text-dark-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
