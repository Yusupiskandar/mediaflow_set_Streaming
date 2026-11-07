import AppHeader from '@/components/layout/AppHeader';

/** Kerangka semua halaman setelah login: header melayang + latar slate seperti landing page. */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 pt-32 pb-16">{children}</main>
    </div>
  );
}
