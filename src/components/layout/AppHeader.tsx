'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/ui/Logo';
import Icon, { ICONS } from '@/components/ui/Icon';

const MAIN_ADMIN_ID = 1;
const EXPIRING_SOON_MS = 3 * 24 * 60 * 60 * 1000;

interface Me {
  userId: number;
  username: string;
  expiresAt: string | null;
}

/** Info masa sewa untuk akun biasa. Admin utama tidak punya masa sewa. */
function RentalBadge({ expiresAt }: { expiresAt: string }) {
  const [now] = useState(() => Date.now());
  const soon = Date.parse(expiresAt) - now <= EXPIRING_SOON_MS;
  const label = new Date(expiresAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <span
      className={`hidden lg:inline-flex badge py-1 ${soon ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}
      title="Akun otomatis nonaktif setelah masa sewa berakhir"
    >
      <Icon d={ICONS.clock} className="w-3.5 h-3.5" />
      {soon ? 'Sewa segera habis: ' : 'Sewa s/d '}
      {label}
    </span>
  );
}

/** Header melayang untuk halaman setelah login, gaya sama dengan navbar landing page. */
export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let active = true;
    // 401 ditangani oleh masing-masing halaman (redirect ke /login), di sini cukup diabaikan.
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.user) setMe(data.user);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const isAdmin = me?.userId === MAIN_ADMIN_ID;

  const links = [
    { href: '/browse', label: 'Media', icon: ICONS.folder, match: ['/browse', '/player'] },
    { href: '/stream', label: 'Live Stream', icon: ICONS.live, match: ['/stream'], live: true },
    ...(isAdmin ? [{ href: '/admin/users', label: 'Admin', icon: ICONS.users, match: ['/admin'] }] : []),
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  return (
    <header className="fixed top-4 inset-x-0 z-30 px-4">
      <div className="max-w-6xl mx-auto h-16 px-3 md:px-6 bg-white/95 backdrop-blur rounded-2xl border border-gray-100 shadow-lg shadow-blue-900/5 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Logo href="/browse" />
        </div>

        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active = link.match.some((m) => pathname.startsWith(m));
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-blue-600'
                }`}
              >
                <span className="relative">
                  <Icon d={link.icon} className="w-5 h-5" />
                  {link.live && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                </span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 flex items-center justify-end gap-3">
          {me && !isAdmin && me.expiresAt && <RentalBadge expiresAt={me.expiresAt} />}
          {me && <span className="hidden md:inline text-sm font-medium text-slate-700 truncate max-w-32">{me.username}</span>}
          <button onClick={handleLogout} title="Logout" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Icon d={ICONS.logout} className="w-5 h-5" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
