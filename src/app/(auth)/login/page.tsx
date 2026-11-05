'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-gray-900">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">MediaFlow</h1>
          <p className="text-gray-500">Self-hosted media server</p>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex mb-6 border-b border-gray-200">
            <div className="flex-1 py-2 text-center font-medium text-gray-900 border-b-2 border-blue-500">
              Login
            </div>
          </div>

          <LoginForm onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  );
}
