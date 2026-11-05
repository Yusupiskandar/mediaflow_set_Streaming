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
  expires_at: string | null;
  isExpired: boolean;
  live: LiveInfo | null;
}

const REFRESH_INTERVAL_MS = 5000;
const MAIN_ADMIN_ID = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_MS = 3 * DAY_MS;

// Pilihan masa sewa saat membuat akun baru.
const NEW_USER_PLANS = [
  { value: '1', label: '1 hari' },
  { value: '7', label: '7 hari' },
  { value: '30', label: '30 hari' },
  { value: '90', label: '90 hari' },
  { value: '365', label: '1 tahun' },
  { value: 'custom', label: 'Pilih tanggal...' },
  { value: 'unlimited', label: 'Tanpa batas' },
];

// Tombol perpanjang cepat di dialog "Atur Sewa".
const EXTEND_OPTIONS = [
  { days: 1, label: '+1 hari' },
  { days: 7, label: '+7 hari' },
  { days: 30, label: '+30 hari' },
  { days: 90, label: '+90 hari' },
];

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => n.toString().padStart(2, '0')).join(':');
}

function formatRemaining(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} hari ${hours} jam`;
  if (hours > 0) return `${hours} jam ${mins} menit`;
  return `${mins} menit`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** `created_at` dari SQLite berformat "YYYY-MM-DD HH:MM:SS" dalam UTC. */
function parseSqliteDate(value: string): Date {
  return new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
}

/** Nilai untuk <input type="datetime-local"> dalam zona waktu lokal browser. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Batas baru setelah diperpanjang: dari batas sekarang jika masih aktif, atau dari saat ini. */
function extendExpiry(expiresAt: string | null, days: number): string {
  const nowMs = Date.now();
  const current = expiresAt ? Date.parse(expiresAt) : NaN;
  const base = Number.isFinite(current) && current > nowMs ? current : nowMs;
  return new Date(base + days * DAY_MS).toISOString();
}

function isInPast(time: number): boolean {
  return time <= Date.now();
}

function expiryFromPlan(plan: string, customValue: string): string | null {
  if (plan === 'unlimited') return null;
  if (plan === 'custom') return new Date(customValue).toISOString();
  return new Date(Date.now() + Number(plan) * DAY_MS).toISOString();
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

function SubscriptionStatus({ user, now }: { user: User; now: number }) {
  if (user.id === MAIN_ADMIN_ID) {
    return <span className="text-sm text-gray-500">Selalu aktif</span>;
  }

  if (!user.expires_at) {
    return (
      <span className="inline-flex px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-200">
        Tanpa batas
      </span>
    );
  }

  const remaining = Date.parse(user.expires_at) - now;

  if (user.isExpired || remaining <= 0) {
    return (
      <div className="space-y-1">
        <span className="inline-flex px-2 py-0.5 text-xs font-semibold bg-gray-200 text-gray-700 rounded-full border border-gray-300">
          Nonaktif
        </span>
        <p className="text-xs text-gray-500">Berakhir {formatDateTime(user.expires_at)}</p>
      </div>
    );
  }

  const soon = remaining <= EXPIRING_SOON_MS;
  return (
    <div className="space-y-1">
      <span
        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${
          soon ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-green-50 text-green-700 border-green-200'
        }`}
      >
        {soon ? 'Segera habis' : 'Aktif'} · sisa {formatRemaining(remaining)}
      </span>
      <p className="text-xs text-gray-500">s/d {formatDateTime(user.expires_at)}</p>
    </div>
  );
}

function ExpiryDialog({
  user,
  now,
  onClose,
  onSaved,
}: {
  user: User;
  now: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customValue, setCustomValue] = useState(() =>
    toLocalInputValue(new Date(user.expires_at && !user.isExpired ? Date.parse(user.expires_at) : Date.now() + 30 * DAY_MS))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (expiresAt: string | null, confirmMessage?: string) => {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan masa sewa');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  // Perpanjang dari batas sekarang jika masih aktif, atau dari saat ini jika sudah habis.
  const extend = (days: number) => {
    save(extendExpiry(user.expires_at, days));
  };

  const saveCustom = () => {
    const time = new Date(customValue).getTime();
    if (!Number.isFinite(time)) {
      setError('Tanggal tidak valid');
      return;
    }
    if (isInPast(time)) {
      save(new Date(time).toISOString(), `Tanggal ini sudah lewat, jadi akun ${user.username} akan langsung nonaktif. Lanjutkan?`);
      return;
    }
    save(new Date(time).toISOString());
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Atur Masa Sewa</h2>
            <p className="text-sm text-gray-500">Akun: {user.username}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-xl leading-none" aria-label="Tutup">
            ×
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div className="text-sm">
            <span className="text-gray-500">Status sekarang: </span>
            <SubscriptionStatus user={user} now={now} />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Perpanjang</p>
            <div className="grid grid-cols-4 gap-2">
              {EXTEND_OPTIONS.map((option) => (
                <button
                  key={option.days}
                  onClick={() => extend(option.days)}
                  disabled={saving}
                  className="py-2 bg-green-50 text-green-700 hover:bg-green-600 hover:text-white disabled:opacity-50 rounded border border-green-200 text-sm font-medium transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Dihitung dari batas sekarang, atau dari saat ini jika masa sewa sudah habis.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Atur tanggal berakhir</p>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={saveCustom}
                disabled={saving || !customValue}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md text-sm font-medium"
              >
                Simpan
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-gray-200">
            <button
              onClick={() => save(null)}
              disabled={saving}
              className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-900 rounded-md text-sm"
            >
              Tanpa batas
            </button>
            <button
              onClick={() =>
                save(
                  new Date().toISOString(),
                  `Nonaktifkan akun ${user.username} sekarang?${user.live ? '\n\nLive yang sedang berjalan akan dihentikan.' : ''}`
                )
              }
              disabled={saving}
              className="flex-1 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-50 rounded-md border border-red-300 text-sm transition-colors"
            >
              Nonaktifkan sekarang
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
          )}
        </div>
      </div>
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
  const [newPlan, setNewPlan] = useState('30');
  const [newCustomExpiry, setNewCustomExpiry] = useState(() => toLocalInputValue(new Date(Date.now() + 30 * DAY_MS)));
  const [addLoading, setAddLoading] = useState(false);

  const [expiryUserId, setExpiryUserId] = useState<number | null>(null);
  const expiryUser = users.find((user) => user.id === expiryUserId) ?? null;

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
    if (!confirm(`Hentikan live milik ${user.username}?\n\nVideo: ${user.live?.videoName ?? '-'}`)) return;

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
    if (id === MAIN_ADMIN_ID) {
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
        body: JSON.stringify({ username: newUsername, password: newPassword, expiresAt: expiryFromPlan(newPlan, newCustomExpiry) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menambah user');

      setNewUsername('');
      setNewPassword('');
      setNewPlan('30');
      setShowAddForm(false);
      refreshUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setAddLoading(false);
    }
  };

  const liveCount = users.filter((user) => user.live).length;
  const inactiveCount = users.filter((user) => user.isExpired).length;
  const expiringSoonCount = users.filter(
    (user) =>
      !user.isExpired &&
      user.expires_at &&
      Date.parse(user.expires_at) - now <= EXPIRING_SOON_MS
  ).length;

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
                {expiringSoonCount > 0 && (
                  <> · <span className="text-yellow-700 font-medium">{expiringSoonCount} segera habis</span></>
                )}
                {inactiveCount > 0 && <> · {inactiveCount} nonaktif</>}
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Masa sewa</label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {NEW_USER_PLANS.map((plan) => (
                    <option key={plan.value} value={plan.value}>{plan.label}</option>
                  ))}
                </select>
                {newPlan === 'custom' && (
                  <input
                    type="datetime-local"
                    value={newCustomExpiry}
                    onChange={(e) => setNewCustomExpiry(e.target.value)}
                    className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Setelah masa sewa habis, akun otomatis nonaktif dan live-nya dihentikan.
                </p>
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
          <div className="bg-white rounded-lg overflow-x-auto border border-gray-200 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 text-gray-700 font-medium">ID</th>
                  <th className="p-4 text-gray-700 font-medium">Username</th>
                  <th className="p-4 text-gray-700 font-medium">Masa Sewa</th>
                  <th className="p-4 text-gray-700 font-medium">Status Live</th>
                  <th className="p-4 text-gray-700 font-medium">Tanggal Dibuat</th>
                  <th className="p-4 text-right text-gray-700 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`transition-colors ${
                      user.live ? 'bg-red-50/70' : user.isExpired ? 'bg-gray-50 text-gray-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="p-4 text-gray-900">#{user.id}</td>
                    <td className="p-4 text-gray-900 font-medium">
                      <div className="flex items-center gap-2">
                        <span className={user.isExpired ? 'text-gray-500 line-through' : ''}>{user.username}</span>
                        {user.id === MAIN_ADMIN_ID && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full border border-yellow-300">
                            Admin
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4"><SubscriptionStatus user={user} now={now} /></td>
                    <td className="p-4"><LiveStatus live={user.live} now={now} /></td>
                    <td className="p-4 text-gray-500 text-sm">{parseSqliteDate(user.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {user.live && (
                          <button
                            onClick={() => handleStopLive(user)}
                            disabled={stoppingId === user.id}
                            className="px-3 py-1 bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white disabled:opacity-50 disabled:cursor-wait rounded border border-orange-300 transition-colors text-sm whitespace-nowrap"
                          >
                            {stoppingId === user.id ? 'Menghentikan...' : 'Hentikan Live'}
                          </button>
                        )}
                        {user.id !== MAIN_ADMIN_ID && (
                          <button
                            onClick={() => setExpiryUserId(user.id)}
                            className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded border border-blue-200 transition-colors text-sm whitespace-nowrap"
                          >
                            Atur Sewa
                          </button>
                        )}
                        {user.id !== MAIN_ADMIN_ID && (
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

      {expiryUser && (
        <ExpiryDialog
          key={expiryUser.id}
          user={expiryUser}
          now={now}
          onClose={() => setExpiryUserId(null)}
          onSaved={() => {
            setExpiryUserId(null);
            refreshUsers();
          }}
        />
      )}
    </div>
  );
}
