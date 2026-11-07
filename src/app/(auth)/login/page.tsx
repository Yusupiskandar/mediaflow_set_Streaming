'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import AuthShell from '@/components/layout/AuthShell';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch('/api/auth/setup-status');
        const data = await res.json();
        if (data.setupRequired) {
          router.push('/setup');
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    checkSetup();
  }, [router]);

  const handleSuccess = () => {
    router.push('/browse');
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
      eyebrow="Selamat Datang"
      title="Masuk ke MediaFlow"
      description="Gunakan username dan password yang diberikan admin."
    >
      <LoginForm onSuccess={handleSuccess} />
    </AuthShell>
  );
}
