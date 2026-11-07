'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import Icon, { ICONS } from '@/components/ui/Icon';
import PasswordInput from '@/components/ui/PasswordInput';
import { ResetPasswordDialog, ChangeOwnPasswordDialog } from '@/components/admin/PasswordDialogs';

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
  /** Jadwal live otomatis: kapan mulai dan/atau berhenti. */
  schedule: { startAt: string | null; stopAt: string | null } | null;
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

function LiveStatus({ live, schedule, now }: { live: LiveInfo | null; schedule: User['schedule']; now: number }) {
  if (!live) {
    if (schedule?.startAt) {
      return (
        <div className="space-y-1">
          <span className="badge bg-blue-50 text-blue-700">Terjadwal</span>
          <p className="text-xs text-slate-400">Mulai {formatDateTime(schedule.startAt)}</p>
          {schedule.stopAt && <p className="text-xs text-slate-400">Berhenti {formatDateTime(schedule.stopAt)}</p>}
        </div>
      );
    }
    return <span className="badge bg-slate-100 text-slate-500">Offline</span>;
  }

  const autoStop = schedule?.stopAt ? (
    <p className="text-xs text-slate-400">Berhenti otomatis {formatDateTime(schedule.stopAt)}</p>
  ) : null;

  const duration = formatDuration((now - new Date(live.startedAt).getTime()) / 1000);

  if (live.isReconnecting) {
    return (
      <div className="space-y-1">
        <span className="badge bg-amber-50 text-amber-700">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
          Menyambung ulang ({live.reconnectAttempts}/10)
        </span>
        <p className="text-xs text-slate-400 truncate max-w-xs" title={live.videoName}>{live.videoName}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="badge bg-red-500 text-white">
        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
        LIVE · {duration}
      </span>
      <p className="text-xs text-slate-700 truncate max-w-xs" title={live.videoName}>{live.videoName}</p>
      <p className="text-xs text-slate-400">
        ke {platformName(live.destination)} · key {live.streamKey}
      </p>
      {autoStop}
    </div>
  );
}

function SubscriptionStatus({ user, now }: { user: User; now: number }) {
  if (user.id === MAIN_ADMIN_ID) {
    return <span className="badge bg-blue-50 text-blue-700">Selalu aktif</span>;
  }

  if (!user.expires_at) {
    return (
      <span className="badge bg-blue-50 text-blue-700">
        Tanpa batas
      </span>
    );
  }

  const remaining = Date.parse(user.expires_at) - now;

  if (user.isExpired || remaining <= 0) {
    return (
      <div className="space-y-1">
        <span className="badge bg-slate-200 text-slate-600">
          Nonaktif
        </span>
        <p className="text-xs text-slate-400">Berakhir {formatDateTime(user.expires_at)}</p>
      </div>
    );
  }

  const soon = remaining <= EXPIRING_SOON_MS;
  return (
    <div className="space-y-1">
      <span
        className={`badge ${soon ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}
      >
        {soon ? 'Segera habis' : 'Aktif'} · sisa {formatRemaining(remaining)}
      </span>
      <p className="text-xs text-slate-400">s/d {formatDateTime(user.expires_at)}</p>
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
    <div className="fixed inset-0 bg-[#060b24]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 pb-0 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Akun {user.username}</p>
            <h2 className="text-2xl font-bold text-slate-800">Atur Masa Sewa</h2>
          </div>
          <button onClick={onClose} className="p-2 -m-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors" aria-label="Tutup">
            <Icon d={ICONS.close} className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-sm flex items-start gap-2">
            <span className="text-slate-500 pt-0.5">Status sekarang:</span>
            <SubscriptionStatus user={user} now={now} />
          </div>

          <div>
            <p className="label">Perpanjang</p>
            <div className="grid grid-cols-4 gap-2">
              {EXTEND_OPTIONS.map((option) => (
                <button
                  key={option.days}
                  onClick={() => extend(option.days)}
                  disabled={saving}
                  className="btn-soft-green px-2"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="hint">
              Dihitung dari batas sekarang, atau dari saat ini jika masa sewa sudah habis.
            </p>
          </div>

          <div>
            <p className="label">Atur tanggal berakhir</p>
            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                className="input flex-1"
              />
              <button
                onClick={saveCustom}
                disabled={saving || !customValue}
                className="btn-primary"
              >
                Simpan
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-5 border-t border-slate-100">
            <button
              onClick={() => save(null)}
              disabled={saving}
              className="btn-secondary flex-1"
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
              className="btn-soft-red flex-1"
            >
              Nonaktifkan sekarang
            </button>
          </div>

          {error && (
            <div className="alert-error">{error}</div>
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

  // Dialog sandi: user lain = atur ulang oleh admin, admin utama = ganti sandi sendiri.
  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);
  const passwordUser = users.find((user) => user.id === passwordUserId) ?? null;

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

  const activeCount = users.length - inactiveCount;
  const stats = [
    { label: 'Total akun', value: users.length, tone: 'bg-blue-50 text-blue-600', icon: ICONS.users },
    { label: 'Sedang live', value: liveCount, tone: 'bg-red-50 text-red-600', icon: ICONS.live },
    { label: 'Segera habis', value: expiringSoonCount, tone: 'bg-amber-50 text-amber-700', icon: ICONS.clock },
    { label: 'Aktif / nonaktif', value: `${activeCount} / ${inactiveCount}`, tone: 'bg-slate-100 text-slate-600', icon: ICONS.shield },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Manajemen Pengguna"
        description="Kelola akun penyewa, masa sewa, dan live yang sedang berjalan."
        actions={
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={showAddForm ? 'btn-secondary' : 'btn-primary'}
          >
            {showAddForm ? 'Batal' : <><Icon d={ICONS.plus} className="w-4 h-4" /> Tambah User</>}
          </button>
        }
      />

      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="card p-5 flex items-center gap-4">
              <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${stat.tone}`}>
                <Icon d={stat.icon} className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                <p className="text-sm text-slate-400 truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddForm && (
        <div className="card p-6 sm:p-8 mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Tambah User Baru</h2>
          <form onSubmit={handleAddUser} className="grid md:grid-cols-3 gap-5 items-start">
            <div>
              <label className="label">Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="input"
                required minLength={3}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required minLength={6}
              />
            </div>
            <div>
              <label className="label">Masa sewa</label>
              <select
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                className="input"
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
                  className="input mt-2"
                  required
                />
              )}
            </div>
            <div className="md:col-span-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-xs text-slate-400">
                Setelah masa sewa habis, akun otomatis nonaktif dan live-nya dihentikan.
              </p>
              <button type="submit" disabled={addLoading} className="btn-primary">
                {addLoading ? <><span className="spinner w-4 h-4" /> Menyimpan...</> : 'Simpan User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-blue-600">
          <span className="spinner w-10 h-10" />
          <p className="mt-4 text-slate-500">Memuat data user...</p>
        </div>
      ) : error ? (
        <div className="alert-error">{error}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Username</th>
                <th className="px-6 py-4 font-semibold">Masa Sewa</th>
                <th className="px-6 py-4 font-semibold">Status Live</th>
                <th className="px-6 py-4 font-semibold">Tanggal Dibuat</th>
                <th className="px-6 py-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={`transition-colors ${
                    user.live ? 'bg-red-50/50' : user.isExpired ? 'bg-slate-50/70 text-slate-400' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-6 py-4 text-slate-400 font-mono text-sm">#{user.id}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 shrink-0 rounded-full bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center uppercase">
                        {user.username.charAt(0)}
                      </span>
                      <span className={`font-semibold ${user.isExpired ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{user.username}</span>
                      {user.id === MAIN_ADMIN_ID && (
                        <span className="badge bg-amber-50 text-amber-700">Admin</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4"><SubscriptionStatus user={user} now={now} /></td>
                  <td className="px-6 py-4"><LiveStatus live={user.live} schedule={user.schedule} now={now} /></td>
                  <td className="px-6 py-4 text-slate-400 text-sm whitespace-nowrap">{parseSqliteDate(user.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {user.id === MAIN_ADMIN_ID && (
                        <button
                          onClick={() => setPasswordUserId(user.id)}
                          className="btn-soft-blue btn-sm whitespace-nowrap"
                        >
                          Ganti Sandi
                        </button>
                      )}
                      {user.live && (
                        <button
                          onClick={() => handleStopLive(user)}
                          disabled={stoppingId === user.id}
                          className="btn-soft-orange btn-sm whitespace-nowrap disabled:cursor-wait"
                        >
                          {stoppingId === user.id ? 'Menghentikan...' : 'Hentikan Live'}
                        </button>
                      )}
                      {user.id !== MAIN_ADMIN_ID && (
                        <button
                          onClick={() => setExpiryUserId(user.id)}
                          className="btn-soft-blue btn-sm whitespace-nowrap"
                        >
                          Atur Sewa
                        </button>
                      )}
                      {user.id !== MAIN_ADMIN_ID && (
                        <button
                          onClick={() => setPasswordUserId(user.id)}
                          className="btn-soft-blue btn-sm whitespace-nowrap"
                        >
                          Reset Sandi
                        </button>
                      )}
                      {user.id !== MAIN_ADMIN_ID && (
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="btn-soft-red btn-sm"
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
            <div className="p-8 text-center text-slate-400">
              Tidak ada user ditemukan.
            </div>
          )}
        </div>
      )}

      {passwordUser && (passwordUser.id === MAIN_ADMIN_ID ? (
        <ChangeOwnPasswordDialog onClose={() => setPasswordUserId(null)} />
      ) : (
        <ResetPasswordDialog
          key={passwordUser.id}
          userId={passwordUser.id}
          username={passwordUser.username}
          onClose={() => setPasswordUserId(null)}
        />
      ))}

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
    </>
  );
}
