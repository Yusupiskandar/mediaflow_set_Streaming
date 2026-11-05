'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface LiveInfo {
  videoName: string;
  startedAt: string;
  streamKey: string;
  destination: string;
  isReconnecting: boolean;
  reconnectAttempts: number;
}

interface User {
  id: number;
  username: string;
  created_at: string;
  live: LiveInfo | null;
}

const REFRESH_INTERVAL_MS = 5000;

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => n.toString().padStart(2, '0')).join(':');
}

function platformName(host: string): string {
  if (host.includes('youtube')) return 'YouTube';
  if (host.includes('facebook') || host.includes('fbcdn')) return 'Facebook';
  if (host.includes('tiktok')) return 'TikTok';
  if (host.includes('twitch')) return 'Twitch';
  return host;
}

function LiveStatus({ live, now }: { live: LiveInfo | null; now: number }) {
  if (!live) {
    return <span className="text-sm text-gray-500">Offline</span>;
  }

  const duration = formatDuration((now - new Date(live.startedAt).getTime()) / 1000);

  if (live.isReconnecting) {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center gap-2 px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded-full border border-yellow-300">
          <span className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></span>
          Menyambung ulang ({live.reconnectAttempts}/10)
        </span>
        <p className="text-xs text-gray-500 truncate max-w-xs" title={live.videoName}>{live.videoName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="inline-flex items-center gap-2 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-600 rounded-full border border-red-300">
        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        LIVE · {duration}
      </span>
      <p className="text-xs text-gray-700 truncate max-w-xs" title={live.videoName}>{live.videoName}</p>
      <p className="text-xs text-gray-500">
        ke {platformName(live.destination)} · key {live.streamKey}
      </p>
    </div>
  );
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

  const [reloadKey, setReloadKey] = useState(0);
  const refreshUsers = () => setReloadKey((key) => key + 1);
  const [now, setNow] = useState(() => Date.now());

  // Perbarui status live secara berkala, dan jalankan jam untuk durasi live.
  useEffect(() => {
    const refresh = setInterval(() => setReloadKey((key) => key + 1), REFRESH_INTERVAL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    let active = true;

    fetch('/api/admin/users')
      .then(async (res) => {
        if (!active) return;
        if (res.status === 403 || res.status === 401) {
          router.push('/browse');
          return;
        }
        if (!res.ok) throw new Error('Gagal mengambil data user');

        const data = await res.json();
        if (active) {
          setUsers(data.users || []);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey, router]);

  const [stoppingId, setStoppingId] = useState<number | null>(null);

  const handleStopLive = async (user: User) => {
    if (!confirm(`Hentikan live milik ${user.username}?

Video: ${user.live?.videoName ?? '-'}`)) return;

    setStoppingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/stop-stream`, { method: 'POST' });
      const data = await res.json();
      // 409 = live sudah berhenti sendiri, cukup segarkan daftar.
      if (!res.ok && res.status !== 409) {
        throw new Error(data.error || 'Gagal menghentikan live');
      }
      refreshUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setStoppingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (id === 1) {
      alert('Tidak dapat menghapus Admin utama!');
      return;
    }
    
    const target = users.find((user) => user.id === id);
    const message = target?.live
      ? `${target.username} sedang live. Menghapus akun ini akan menghentikan live-nya. Lanjutkan?`
      : 'Apakah Anda yakin ingin menghapus user ini?';
    if (!confirm(message)) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal menghapus user');
      }
      
      // Refresh list
      refreshUsers();
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
      refreshUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setAddLoading(false);
    }
  };

  const liveCount = users.filter((user) => user.live).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button onClick={() => router.push('/browse')} className="text-xl font-bold text-gray-900 hover:text-gray-700">
                MediaFlow
              </button>
              <span className="ml-4 text-gray-500 font-medium border-l border-gray-300 pl-4">Admin Dashboard</span>
            </div>
            <div>
              <button onClick={() => router.push('/browse')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-md transition-colors">
                Kembali
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manajemen Pengguna</h1>
            {!loading && (
              <p className="mt-1 text-sm text-gray-500">
                {users.length} akun ·{' '}
                {liveCount > 0 ? (
                  <span className="text-red-600 font-medium">{liveCount} sedang live</span>
                ) : (
                  'tidak ada yang sedang live'
                )}
              </p>
            )}
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
          >
            {showAddForm ? 'Batal' : '+ Tambah User'}
          </button>
        </div>

        {showAddForm && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Tambah User Baru</h2>
            <form onSubmit={handleAddUser} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required minLength={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={addLoading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md font-medium"
              >
                {addLoading ? 'Menyimpan...' : 'Simpan User'}
              </button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-500">Memuat data user...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">
            {error}
          </div>
        ) : (
          <div className="bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 text-gray-700 font-medium">ID</th>
                  <th className="p-4 text-gray-700 font-medium">Username</th>
                  <th className="p-4 text-gray-700 font-medium">Status Live</th>
                  <th className="p-4 text-gray-700 font-medium">Tanggal Dibuat</th>
                  <th className="p-4 text-right text-gray-700 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className={`transition-colors ${user.live ? 'bg-red-50/70' : 'hover:bg-gray-50'}`}>
                    <td className="p-4 text-gray-900">#{user.id}</td>
                    <td className="p-4 text-gray-900 font-medium">
                      <div className="flex items-center gap-2">
                        {user.username}
                        {user.id === 1 && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full border border-yellow-300">
                            Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4"><LiveStatus live={user.live} now={now} /></td>
                    <td className="p-4 text-gray-500">{new Date(user.created_at).toLocaleString('id-ID')}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {user.live && (
                          <button
                            onClick={() => handleStopLive(user)}
                            disabled={stoppingId === user.id}
                            className="px-3 py-1 bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white disabled:opacity-50 disabled:cursor-wait rounded border border-orange-300 transition-colors text-sm"
                          >
                            {stoppingId === user.id ? 'Menghentikan...' : 'Hentikan Live'}
                          </button>
                        )}
                        {user.id !== 1 && (
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded border border-red-300 transition-colors text-sm"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
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
