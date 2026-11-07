'use client';

import { useRef, useState } from 'react';
import Icon, { ICONS } from '@/components/ui/Icon';
import PasswordInput from '@/components/ui/PasswordInput';

const MIN_LENGTH = 6;
// Tanpa huruf/angka yang mirip (0/O, 1/l/I) supaya mudah diketik ulang dari chat.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Sandi acak 12 karakter dari crypto.getRandomValues, tanpa bias modulo. */
function generatePassword(length = 12): string {
  const limit = 256 - (256 % ALPHABET.length);
  let result = '';
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (b < limit && result.length < length) result += ALPHABET[b % ALPHABET.length];
    }
  }
  return result;
}

function Modal({
  eyebrow,
  title,
  onClose,
  busy,
  children,
}: {
  eyebrow: string;
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-[#060b24]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={busy ? undefined : onClose}>
      <div className="card w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 pb-0 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">{eyebrow}</p>
            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-2 -m-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Tutup"
          >
            <Icon d={ICONS.close} className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** Tombol salin. Clipboard API butuh HTTPS/localhost, jadi kalau gagal teksnya diseleksi untuk disalin manual. */
function CopyButton({ text, fallbackRef }: { text: string; fallbackRef: React.RefObject<HTMLInputElement | null> }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      fallbackRef.current?.select();
    }
  };

  return (
    <button type="button" onClick={copy} disabled={!text} className="btn-secondary shrink-0">
      {copied ? 'Tersalin' : 'Salin'}
    </button>
  );
}

/** Admin mengatur ulang sandi akun penyewa. */
export function ResetPasswordDialog({ username, userId, onClose }: { username: string; userId: number; onClose: () => void }) {
  const [password, setPassword] = useState(() => generatePassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengatur ulang sandi');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Modal eyebrow={`Akun ${username}`} title="Sandi Diperbarui" onClose={onClose}>
        <div className="space-y-5">
          <div className="alert-success">
            Sandi baru sudah aktif. Semua perangkat yang login dengan akun ini sudah dikeluarkan.
          </div>
          <div>
            <label className="label">Sandi baru untuk {username}</label>
            <div className="flex gap-2">
              <input ref={inputRef} readOnly value={password} className="input font-mono" onFocus={(e) => e.target.select()} />
              <CopyButton text={password} fallbackRef={inputRef} />
            </div>
            <p className="hint">Kirimkan sandi ini ke penyewa. Sandi tidak bisa dilihat lagi setelah dialog ditutup.</p>
          </div>
          <button onClick={onClose} className="btn-primary w-full">Selesai</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal eyebrow={`Akun ${username}`} title="Atur Ulang Sandi" onClose={onClose} busy={saving}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="reset-password" className="label">Sandi baru</label>
          <div className="flex gap-2">
            <input
              id="reset-password"
              ref={inputRef}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input font-mono"
              minLength={MIN_LENGTH}
              required
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" onClick={() => setPassword(generatePassword())} className="btn-secondary shrink-0" title="Buat sandi acak">
              <Icon d={ICONS.reconnect} className="w-4 h-4" />
              Acak
            </button>
          </div>
          <p className="hint">Minimal {MIN_LENGTH} karakter. Bisa diketik sendiri atau dibuat acak.</p>
        </div>

        <div className="alert-warning">
          Semua perangkat yang sedang login dengan akun <strong>{username}</strong> akan langsung keluar.
          Live yang sedang berjalan tidak dihentikan.
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary flex-1">Batal</button>
          <button type="submit" disabled={saving || password.length < MIN_LENGTH} className="btn-primary flex-1">
            {saving ? <><span className="spinner w-4 h-4" /> Menyimpan...</> : 'Simpan Sandi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** User yang sedang login mengganti sandinya sendiri (dipakai untuk akun admin). */
export function ChangeOwnPasswordDialog({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi sandi tidak sama');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengganti sandi');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Modal eyebrow="Akun Anda" title="Sandi Diganti" onClose={onClose}>
        <div className="space-y-5">
          <div className="alert-success">
            Sandi berhasil diganti. Anda tetap login di perangkat ini, sedangkan sesi di perangkat lain sudah dikeluarkan.
          </div>
          <button onClick={onClose} className="btn-primary w-full">Selesai</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal eyebrow="Akun Anda" title="Ganti Sandi" onClose={onClose} busy={saving}>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="current-password" className="label">Sandi lama</label>
          <PasswordInput
            id="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label htmlFor="new-password" className="label">Sandi baru</label>
          <PasswordInput
            id="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
          />
          <p className="hint">Minimal {MIN_LENGTH} karakter.</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="label">Ulangi sandi baru</label>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          {mismatch && <p className="mt-1.5 text-xs text-red-600">Sandi tidak sama.</p>}
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary flex-1">Batal</button>
          <button
            type="submit"
            disabled={saving || newPassword.length < MIN_LENGTH || mismatch || !currentPassword}
            className="btn-primary flex-1"
          >
            {saving ? <><span className="spinner w-4 h-4" /> Menyimpan...</> : 'Ganti Sandi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
