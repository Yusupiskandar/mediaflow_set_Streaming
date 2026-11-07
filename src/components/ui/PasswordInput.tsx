'use client';

import { useState } from 'react';

const EYE = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z';
const EYE_OFF =
  'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Input sandi dengan tombol mata untuk menampilkan/menyembunyikan isinya. */
export default function PasswordInput({ className = '', disabled, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={`input pr-12 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-400 hover:text-blue-600 disabled:opacity-50 transition-colors"
        aria-label={visible ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
        aria-pressed={visible}
        title={visible ? 'Sembunyikan' : 'Tampilkan'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
          <path d={visible ? EYE_OFF : EYE} />
        </svg>
      </button>
    </div>
  );
}
