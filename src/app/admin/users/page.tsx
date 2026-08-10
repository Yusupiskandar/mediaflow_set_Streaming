'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  username: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State for Add User Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.status === 403 || res.status === 401) {
        router.push('/browse');
        return;
      }
      if (!res.ok) throw new Error('Gagal mengambil data user');
      
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (id === 1) {
      alert('Tidak dapat menghapus Admin utama!');
      return;
    }
    
    if (!confirm('Apakah Anda yakin ingin menghapus user ini?')) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus user');
      }
      
      // Refresh list
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah user');
      
      // Reset and refresh
      setNewUsername('');
      setNewPassword('');
      setShowAddForm(false);
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button onClick={() => router.push('/browse')} className="text-xl font-bold text-white hover:text-gray-300">
                MediaFlow
              </button>
              <span className="ml-4 text-gray-400 font-medium border-l border-gray-600 pl-4">Admin Dashboard</span>
            </div>
            <div>
              <button onClick={() => router.push('/browse')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors">
                Kembali
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Manajemen Pengguna</h1>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
          >
            {showAddForm ? 'Batal' : '+ Tambah User'}
          </button>
        </div>

        {showAddForm && (
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 mb-6">
            <h2 className="text-lg font-bold text-white mb-4">Tambah User Baru</h2>
            <form onSubmit={handleAddUser} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required minLength={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={addLoading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-md font-medium"
              >
                {addLoading ? 'Menyimpan...' : 'Simpan User'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Memuat data user...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-md">
            {error}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/50 border-b border-gray-700">
                  <th className="p-4 text-gray-300 font-medium">ID</th>
                  <th className="p-4 text-gray-300 font-medium">Username</th>
                  <th className="p-4 text-gray-300 font-medium">Tanggal Dibuat</th>
                  <th className="p-4 text-right text-gray-300 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-750 transition-colors">
                    <td className="p-4 text-white">#{user.id}</td>
                    <td className="p-4 text-white font-medium flex items-center gap-2">
                      {user.username}
                      {user.id === 1 && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-500 rounded-full border border-yellow-500/30">
                          Admin
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-gray-400">{new Date(user.created_at).toLocaleString('id-ID')}</td>
                    <td className="p-4 text-right">
                      {user.id !== 1 && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="px-3 py-1 bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white rounded border border-red-800 transition-colors text-sm"
                        >
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                Tidak ada user ditemukan.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
