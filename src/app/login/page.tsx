'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleSuccess = () => {
    router.push('/browse');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">MediaFlow</h1>
          <p className="text-gray-400">Self-hosted media server</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
          <div className="flex mb-6 border-b border-gray-700">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                mode === 'login'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                mode === 'register'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          <LoginForm mode={mode} onSuccess={handleSuccess} />

          {mode === 'login' && (
            <p className="text-center text-gray-400 text-sm mt-4">
              Belum punya akun?{' '}
              <button
                onClick={() => setMode('register')}
                className="text-blue-500 hover:text-blue-400"
              >
                Register sekarang
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
