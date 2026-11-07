'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthShell from '@/components/layout/AuthShell';
import PasswordInput from '@/components/ui/PasswordInput';

export default function SetupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch('/api/auth/setup-status');
        const data = await res.json();
        if (!data.setupRequired) {
          router.push('/login');
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setError('Gagal memeriksa status setup');
        setLoading(false);
      }
    };
    checkSetup();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat registrasi');
      }

      // Success, redirect to browse page
      router.push('/browse');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-blue-600">
        <span className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <AuthShell
      eyebrow="Setup Pertama"
      title="Buat Akun Admin"
      description="Akun ini menjadi admin utama untuk mengelola pengguna dan masa sewa."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="username" className="label">Username admin</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input"
            placeholder="Pilih username"
            required
            minLength={3}
          />
        </div>

        <div>
          <label htmlFor="password" className="label">Password admin</label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
            required
            minLength={6}
          />
        </div>

        {error && <div className="alert-error">{error}</div>}

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? <><span className="spinner w-4 h-4" /> Membuat admin...</> : 'Selesaikan Setup'}
        </button>
      </form>
    </AuthShell>
  );
}
