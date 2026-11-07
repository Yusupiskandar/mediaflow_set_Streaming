import Link from 'next/link';
import Logo from '@/components/ui/Logo';

/**
 * Kerangka halaman login & setup: panel gelap bergaya banner CTA landing page di kiri,
 * formulir dalam kartu putih di kanan. Di layar kecil panel gelap disembunyikan.
 */
export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 grid lg:grid-cols-2 gap-6">
      {/* Panel gelap */}
      <div className="panel-dark hidden lg:flex flex-col justify-between p-12">
        <span className="pointer-events-none absolute -top-10 left-[45%] w-16 h-[140%] rotate-[35deg] bg-gradient-to-b from-transparent via-blue-200/15 to-transparent blur-xl" aria-hidden="true" />
        <div className="relative">
          <Logo tone="dark" />
        </div>
        <div className="relative">
          <h2 className="text-4xl font-bold leading-snug text-amber-50 mb-4">
            Siap Live 24 Jam,<br />Channel Aktif Nonstop
          </h2>
          <p className="text-slate-300 max-w-md mb-10">
            Upload video, masukkan stream key, dan MediaFlow menyiarkannya secara loop ke YouTube atau platform RTMP lain.
          </p>
          {/* Kartu live mini, sama dengan ilustrasi di landing page */}
          <div className="max-w-sm rounded-2xl bg-white p-4 text-slate-700 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="badge bg-red-500 text-white"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE</span>
              <span className="font-mono text-sm text-slate-400">72:14:09</span>
            </div>
            <div className="h-24 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7" aria-hidden="true"><path d="M7 4l13 8-13 8V4z" /></svg>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100"><div className="h-full w-2/3 rounded-full bg-red-400" /></div>
          </div>
        </div>
        <p className="relative text-sm text-slate-500">© {new Date().getFullYear()} MediaFlow</p>
      </div>

      {/* Formulir */}
      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10 text-center"><Logo /></div>
          <p className="eyebrow mb-2">{eyebrow}</p>
          <h1 className="page-title mb-2">{title}</h1>
          <p className="text-slate-500 mb-8">{description}</p>
          <div className="card p-6 sm:p-8">{children}</div>
          <p className="text-center mt-6 text-sm text-slate-500">
            <Link href="/" className="hover:text-blue-600 transition-colors">&larr; Kembali ke beranda</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
