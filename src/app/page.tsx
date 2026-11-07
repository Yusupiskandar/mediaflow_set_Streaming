import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getUserCount } from '@/lib/db';

// Selalu render ulang: tombol berubah sesuai status login, dan setup pertama dicek tiap request.
export const dynamic = 'force-dynamic';

const FEATURES = [
  {
    icon: 'M5 12a7 7 0 0 1 14 0M8.5 12a3.5 3.5 0 0 1 7 0M12 12v8M3 5l2 2m14-2-2 2',
    title: 'Live stream 24/7 ke YouTube',
    desc: 'Pilih video, masukkan stream key, dan video diputar ulang terus-menerus. Cocok untuk channel musik, ambience, atau siaran ulang.',
  },
  {
    icon: 'M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.4 2M18.5 9A7 7 0 0 0 6.1 7',
    title: 'Reconnect otomatis',
    desc: 'Kalau koneksi ke server tujuan putus, stream mencoba tersambung kembali sendiri tanpa perlu Anda pantau.',
  },
  {
    icon: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
    title: 'Upload file besar',
    desc: 'Upload video langsung dari browser. File dikirim per bagian sehingga file berukuran besar tetap aman terunggah.',
  },
  {
    icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
    title: 'Media library pribadi',
    desc: 'Setiap akun punya ruang penyimpanan sendiri. File Anda tidak bisa dilihat atau dipakai akun lain.',
  },
  {
    icon: 'M5 4l14 8-14 8V4z',
    title: 'Pemutar video & subtitle',
    desc: 'Tonton file langsung di browser dengan dukungan subtitle SRT, ASS, dan VTT, plus lanjut dari posisi terakhir.',
  },
  {
    icon: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z',
    title: 'Ke tujuan RTMP mana pun',
    desc: 'Selain YouTube, stream bisa diarahkan ke platform lain yang menerima RTMP, cukup ganti URL server.',
  },
];

// Langkah sewa. `link`: ke mana kartu mengarah (sewa = kontak admin, login = halaman login).
const STEPS = [
  {
    title: 'Hubungi kami',
    desc: 'Klik Sewa, sampaikan durasi sewa',
    link: 'sewa',
    // Gelembung chat
    art: (
      <>
        <span className="absolute left-2 top-4 w-9 h-7 rounded-lg rounded-bl-none bg-blue-200" />
        <span className="absolute right-0 top-1 w-10 h-8 rounded-lg rounded-br-none bg-blue-600 shadow-md shadow-blue-600/40 flex items-center justify-center gap-0.5">
          <span className="w-1 h-1 rounded-full bg-white" /><span className="w-1 h-1 rounded-full bg-white" /><span className="w-1 h-1 rounded-full bg-white" />
        </span>
        <span className="absolute left-3 bottom-3 w-6 h-1 rounded bg-blue-300" />
      </>
    ),
  },
  {
    title: 'Terima akun',
    desc: 'Username & password dari admin',
    link: 'sewa',
    // Kartu akun + kunci
    art: (
      <>
        <span className="absolute left-1 top-5 w-12 h-9 rounded-lg bg-white border border-blue-200 p-1.5">
          <span className="block w-3 h-3 rounded-full bg-blue-300 mb-1" />
          <span className="block w-7 h-1 rounded bg-blue-200" />
        </span>
        <span className="absolute right-0 top-1 w-9 h-9 rounded-full bg-blue-600 shadow-md shadow-blue-600/40 text-white flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-3 3 3 3" /></svg>
        </span>
      </>
    ),
  },
  {
    title: 'Mulai live',
    desc: 'Upload video, siaran 24 jam',
    link: 'login',
    // Layar + tombol play + label LIVE
    art: (
      <>
        <span className="absolute left-1 top-4 w-12 h-9 rounded-md bg-blue-600 shadow-md shadow-blue-600/40 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4" aria-hidden="true"><path d="M7 4l13 8-13 8V4z" /></svg>
        </span>
        <span className="absolute right-0 top-1 px-1.5 py-0.5 rounded bg-red-500 text-[9px] font-bold text-white shadow">LIVE</span>
        <span className="absolute left-4 bottom-2 w-6 h-1 rounded bg-blue-300" />
      </>
    ),
  },
] as const;

// Ilustrasi kartu "Kenapa pilih" dibuat dari CSS/SVG supaya tidak bergantung pada gambar eksternal.
const REASONS = [
  {
    title: 'Live nonstop 24/7',
    desc: 'Video diputar ulang terus-menerus ke YouTube atau RTMP lain, siang dan malam, tanpa perlu Anda awasi.',
    href: '#fitur',
    badge: null,
    bg: 'bg-gradient-to-br from-slate-800 to-slate-900',
    visual: (
      <div className="w-4/5 rounded-lg bg-slate-700/60 border border-white/10 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500 text-[10px] font-bold text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
          </span>
          <span className="font-mono text-[11px] text-slate-300">168:00:00</span>
        </div>
        <div className="h-16 rounded bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6" aria-hidden="true"><path d="M7 4l13 8-13 8V4z" /></svg>
        </div>
        <div className="mt-2 h-1 rounded-full bg-slate-600 overflow-hidden"><div className="h-full w-2/3 bg-red-500" /></div>
      </div>
    ),
  },
  {
    title: 'Reconnect otomatis',
    desc: 'Koneksi ke server tujuan terputus? MediaFlow menyambungkan ulang sendiri agar siaran tidak berhenti.',
    href: '#fitur',
    badge: 'ANDALAN',
    bg: 'bg-gradient-to-br from-indigo-900 to-blue-800',
    visual: (
      <div className="relative w-28 h-28 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-blue-300/30 animate-ping" />
        <span className="absolute inset-3 rounded-full border-2 border-blue-300/40" />
        <span className="w-16 h-16 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50 flex items-center justify-center text-white">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8" aria-hidden="true">
            <path d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0 0 12.4 2M18.5 9A7 7 0 0 0 6.1 7" />
          </svg>
        </span>
      </div>
    ),
  },
  {
    title: 'Data pribadi & aman',
    desc: 'Setiap akun punya penyimpanan sendiri. File dan stream key Anda tidak bisa diakses akun lain.',
    href: '#cara-sewa',
    badge: null,
    bg: 'bg-gradient-to-br from-sky-700 to-indigo-800',
    visual: (
      <div className="flex items-end gap-3">
        {['h-14', 'h-20', 'h-16'].map((h, i) => (
          <div key={i} className={`w-14 ${h} rounded-lg bg-white/15 border border-white/20 flex items-end p-1.5`}>
            <div className="h-1.5 w-full rounded bg-white/40" />
          </div>
        ))}
        <span className="w-12 h-12 -ml-6 mb-8 rounded-full bg-white text-blue-700 shadow-lg flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
      </div>
    ),
  },
];

// Tampilan layar mini di banner CTA, dibuat dari CSS supaya tidak butuh screenshot.
type ScreenVariant = 'live' | 'files' | 'upload' | 'key';
const SCREENS: ScreenVariant[][] = [
  ['live', 'files', 'key'],
  ['upload', 'live', 'files'],
];

function MiniScreen({ variant }: { variant: ScreenVariant }) {
  return (
    <div className="mb-5 h-32 rounded-2xl bg-white p-3 text-slate-700 overflow-hidden">
      {variant === 'live' && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="px-1.5 py-0.5 rounded bg-red-500 text-[8px] font-bold text-white">● LIVE</span>
            <span className="font-mono text-[9px] text-slate-400">72:14:09</span>
          </div>
          <div className="h-14 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4"><path d="M7 4l13 8-13 8V4z" /></svg>
          </div>
          <div className="mt-2 h-1 rounded-full bg-slate-100"><div className="h-full w-2/3 rounded-full bg-red-400" /></div>
        </>
      )}
      {variant === 'files' && (
        <>
          <p className="text-[10px] font-bold mb-2">Media saya</p>
          {['lofi-mix.mp4', 'rain-ambience.mp4', 'jazz-night.mp4'].map((n, i) => (
            <div key={n} className="flex items-center gap-2 mb-1.5">
              <span className={`w-6 h-4 rounded ${i === 0 ? 'bg-blue-500' : 'bg-blue-100'}`} />
              <span className="text-[9px] text-slate-500 truncate">{n}</span>
            </div>
          ))}
        </>
      )}
      {variant === 'upload' && (
        <>
          <p className="text-[10px] font-bold mb-2">Upload video</p>
          <div className="h-12 rounded-lg border-2 border-dashed border-blue-200 flex items-center justify-center mb-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" className="w-4 h-4"><path d="M12 16V4m0 0-4 4m4-4 4 4" /></svg>
          </div>
          <div className="flex justify-between text-[8px] text-slate-400 mb-1"><span>video-4k.mp4</span><span>78%</span></div>
          <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full w-[78%] rounded-full bg-blue-500" /></div>
        </>
      )}
      {variant === 'key' && (
        <>
          <p className="text-[10px] font-bold mb-2">Tujuan stream</p>
          <div className="h-5 rounded bg-slate-100 mb-1.5 px-2 flex items-center text-[8px] text-slate-400 truncate">rtmp://a.rtmp.youtube.com/live2</div>
          <div className="h-5 rounded bg-slate-100 mb-2 px-2 flex items-center text-[8px] text-slate-400 font-mono">a8f2 •••• ••••</div>
          <div className="h-6 rounded-md bg-blue-600 flex items-center justify-center text-[9px] font-semibold text-white">Mulai Live</div>
        </>
      )}
    </div>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default async function Home() {
  // Instalasi baru: arahkan ke pembuatan admin pertama.
  if (getUserCount() === 0) {
    redirect('/setup');
  }

  const user = await getCurrentUser();
  // Link kontak untuk menyewa, mis. https://wa.me/628xxxx. Kosong = arahkan ke bagian cara sewa.
  const sewaUrl = process.env.SEWA_URL?.trim() || '';
  const sewaExternal = sewaUrl !== '';
  const sewaHref = sewaExternal ? sewaUrl : '#cara-sewa';

  const sewaButton = (className: string, label: React.ReactNode = 'Sewa Sekarang') => (
    <a
      href={sewaHref}
      {...(sewaExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={className}
    >
      {label}
    </a>
  );

  const loginButton = (className: string, children?: React.ReactNode) =>
    user ? (
      <Link href="/browse" className={className}>{children ?? 'Buka Dashboard'}</Link>
    ) : (
      <Link href="/login" className={className}>{children ?? 'Login'}</Link>
    );

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <header className="fixed top-4 inset-x-0 z-30 px-4">
        <div className="max-w-6xl mx-auto h-16 px-4 md:px-6 bg-white/95 backdrop-blur rounded-2xl border border-gray-100 shadow-lg shadow-blue-900/5 flex items-center justify-between gap-3">
          <Link href="/" className="flex-1 flex items-center gap-2 font-bold text-xl text-blue-700">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path d="M7 4l13 8-13 8V4z" /></svg>
            </span>
            MediaFlow
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-base font-medium text-gray-800">
            <a href="#fitur" className="hover:text-blue-600 transition-colors">Fitur</a>
            <a href="#cara-sewa" className="hover:text-blue-600 transition-colors">Cara Sewa</a>
            {loginButton('hover:text-blue-600 transition-colors')}
          </nav>
          <div className="flex-1 flex items-center justify-end gap-2">
            {/* Di layar kecil menu tengah disembunyikan, jadi tombol login tampil di sini. */}
            {loginButton('md:hidden px-3 py-2 text-base font-medium text-gray-800 hover:text-blue-600')}
            {sewaButton('inline-flex items-center gap-1.5 pl-5 pr-4 py-2.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors', (
              <>
                Sewa
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
              </>
            ))}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 via-blue-50/70 to-white">
        <div className="max-w-6xl mx-auto px-4 pt-36 pb-20 md:pt-44 md:pb-28 grid md:grid-cols-2 gap-14 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl leading-[1.1] tracking-tight text-slate-700 mb-6">
              <span className="block font-bold text-slate-800">Live YouTube nonstop</span>
              <span className="block font-medium">siaran berjalan</span>
              <span className="block font-medium">24 jam sehari.</span>
            </h1>
            <p className="text-lg text-slate-500 mb-8 max-w-md">
              Upload video, masukkan stream key, dan MediaFlow menyiarkannya secara loop ke YouTube
              atau platform RTMP lain, tanpa OBS dan tanpa komputer menyala.
            </p>

            {/* Kotak ajakan berbentuk pil */}
            <div className="flex items-center gap-2 max-w-md p-1.5 pl-5 rounded-2xl bg-white border border-slate-200 shadow-sm mb-4">
              <span className="flex-1 text-sm text-slate-400 truncate">Siap live mulai hari ini?</span>
              {sewaButton('shrink-0 inline-flex items-center gap-1.5 px-5 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors', (
                <>
                  Sewa Sekarang
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
                </>
              ))}
            </div>
            <p className="text-sm text-slate-500 mb-10">
              Sudah punya akun? {loginButton('font-semibold text-blue-600 hover:underline')}
            </p>

            {/* Platform tujuan */}
            <p className="text-xs uppercase tracking-wider text-slate-400 mb-3">Bisa live ke</p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xl font-bold text-slate-400">
              <span>YouTube</span>
              <span>Facebook</span>
              <span>Twitch</span>
              <span className="font-mono text-lg">RTMP</span>
            </div>
          </div>

          {/* Ilustrasi: panel live + kartu stream key yang ditumpuk */}
          <div className="relative mx-auto w-full max-w-md pt-10 pr-6 sm:pr-16">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-blue-900/5 p-5">
              <div className="flex items-center gap-3 mb-5">
                <span className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path d="M7 4l13 8-13 8V4z" /></svg>
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">Lofi Channel</p>
                  <p className="text-xs text-slate-400 truncate">@lofichannel</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 mb-4">
                <p className="text-xs text-slate-400 mb-1">Durasi live</p>
                <p className="font-mono text-3xl font-bold text-slate-800">72:14:09</p>
                <p className="text-xs text-slate-400 mt-1">Mulai 4 Nov 2026, 20.00 WIB</p>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-3 rounded-xl border-2 border-blue-500 bg-blue-50/60 px-3 py-2.5 text-sm">
                  <span className="w-4 h-4 rounded bg-blue-100 text-blue-600 flex items-center justify-center">▸</span>
                  <span className="flex-1 font-medium text-slate-700">lofi-mix-3jam.mp4</span>
                  <span className="w-4 h-4 rounded-full border-[5px] border-blue-600" />
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  <span className="w-4 h-4 rounded bg-slate-100 text-slate-400 flex items-center justify-center">▸</span>
                  <span className="flex-1 text-slate-500">rain-ambience.mp4</span>
                  <span className="w-4 h-4 rounded-full border border-slate-300" />
                </div>
              </div>

              <div className="rounded-xl bg-slate-700 py-3 text-center text-sm font-semibold text-white">
                Live sedang berjalan
              </div>
            </div>

            {/* Kartu stream key */}
            <div className="absolute top-0 right-0 w-44 sm:w-52 rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/20 rotate-3">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 h-28 text-white">
                <p className="text-[11px] text-blue-100 mb-2">Stream key</p>
                <p className="font-mono text-sm tracking-widest">a8f2 •••• ••••</p>
              </div>
              <div className="bg-indigo-800 px-4 py-3 flex items-center justify-between text-white">
                <span className="text-sm font-bold">YouTube</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kenapa pilih */}
      <section id="kenapa" className="relative scroll-mt-28 bg-indigo-50">
        {/* Lengkung atas dan bawah */}
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="block w-full h-10 md:h-16 text-white" aria-hidden="true">
          <path d="M0 0h1440v20Q720 100 0 20z" fill="currentColor" />
        </svg>
        <div className="max-w-6xl mx-auto px-4 py-14 md:py-20">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <p className="text-sm font-semibold text-blue-600 mb-3">Kenapa MediaFlow</p>
              <h2 className="text-3xl md:text-4xl font-bold leading-snug text-slate-800">
                Kenapa Pilih<br /><span className="italic text-blue-600">MediaFlow</span>?
              </h2>
            </div>
            <p className="text-slate-500 max-w-md md:text-right">
              Siaran tetap hidup 24 jam, tanpa OBS dan tanpa komputer yang harus menyala semalaman.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {REASONS.map((r, i) => (
              // Efek melayang: lihat .float-card / .float-shadow di globals.css.
              <div key={r.title} className="relative" style={{ '--float-delay': `${i * -2}s` } as React.CSSProperties}>
              <div className="float-shadow absolute inset-x-8 -bottom-5 h-6 rounded-[50%] bg-blue-900/30 blur-xl" aria-hidden="true" />
              <div className="float-card relative h-full">
              <div className="group h-full rounded-2xl overflow-hidden bg-blue-600 shadow-[0_10px_30px_-12px_rgba(30,58,138,0.35)] hover:shadow-[0_20px_40px_-12px_rgba(30,58,138,0.45)] flex flex-col hover:-translate-y-1.5 transition-[transform,box-shadow] duration-500 ease-out">
                <div className={`relative h-44 ${r.bg} flex items-center justify-center overflow-hidden`}>
                  {r.badge && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-white text-[10px] font-bold tracking-wider text-blue-700">
                      {r.badge}
                    </span>
                  )}
                  {r.visual}
                </div>
                <div className="p-6 flex flex-col flex-1 text-white">
                  <h3 className="font-semibold text-lg mb-2">{r.title}</h3>
                  <p className="text-sm text-blue-100 leading-relaxed mb-6">{r.desc}</p>
                  <a href={r.href} className="mt-auto flex items-center justify-between text-sm font-medium">
                    Selengkapnya
                    <span className="w-8 h-8 rounded-full bg-white/20 group-hover:bg-white group-hover:text-blue-600 flex items-center justify-center transition-colors">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                    </span>
                  </a>
                </div>
              </div>
              </div>
              </div>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="block w-full h-10 md:h-16 text-white" aria-hidden="true">
          <path d="M0 80h1440V60Q720 -20 0 60z" fill="currentColor" />
        </svg>
      </section>

      {/* Fitur */}
      <section id="fitur" className="scroll-mt-28 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-sm font-semibold text-blue-600 mb-3">Fitur Lengkap</p>
          <h2 className="text-3xl md:text-4xl font-bold leading-snug text-slate-800 mb-10">
            Semua untuk<br />Live Nonstop
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {FEATURES.map((f, i) => (
              // Efek melayang: lihat .float-card / .float-shadow di globals.css.
              <div key={f.title} className="relative" style={{ '--float-delay': `${(i % 3) * -2}s` } as React.CSSProperties}>
                <div className="float-shadow absolute inset-x-8 -bottom-5 h-6 rounded-[50%] bg-blue-900/20 blur-xl" aria-hidden="true" />
                <div className="float-card relative h-full">
                  <div className="h-full flex flex-col gap-8 p-6 rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(30,58,138,0.15)] hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-12px_rgba(30,58,138,0.25)] transition-[transform,box-shadow] duration-500 ease-out">
                    {/* Ikon dalam lingkaran, gaya sama dengan kartu Cara sewa */}
                    <div className="relative w-16 h-16" aria-hidden="true">
                      <span className="absolute inset-0 rounded-full bg-blue-50" />
                      <span className="absolute -left-1 top-0 grid grid-cols-3 gap-1 opacity-60">
                        {Array.from({ length: 6 }).map((_, d) => <span key={d} className="w-0.5 h-0.5 rounded-full bg-blue-400" />)}
                      </span>
                      <span className="absolute left-3 bottom-3 w-6 h-1 rounded bg-blue-300" />
                      <span className="absolute right-0 top-1 w-10 h-10 rounded-xl bg-blue-600 shadow-md shadow-blue-600/40 text-white flex items-center justify-center">
                        <Icon d={f.icon} />
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 mb-1">{f.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cara sewa */}
      <section id="cara-sewa" className="scroll-mt-28 py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-sm font-semibold text-blue-600 mb-3">Mulai Hari Ini</p>
          <h2 className="text-3xl md:text-4xl font-bold leading-snug text-slate-800 mb-10">
            Cara Sewa<br />dalam 3 Langkah
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
            {STEPS.map((s, i) => {
              const cardClass =
                'group h-full flex flex-col gap-10 p-6 rounded-2xl bg-white shadow-[0_10px_30px_-12px_rgba(30,58,138,0.15)] hover:-translate-y-1.5 hover:shadow-[0_20px_40px_-12px_rgba(30,58,138,0.25)] transition-[transform,box-shadow] duration-500 ease-out';
              const content = (
                <>
                  {/* Ilustrasi dalam lingkaran, sebagian keluar dari lingkaran seperti contoh */}
                  <div className="relative w-16 h-16">
                    <span className="absolute inset-0 rounded-full bg-blue-50" />
                    <span className="absolute -left-1 top-0 grid grid-cols-3 gap-1 opacity-60" aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, d) => <span key={d} className="w-0.5 h-0.5 rounded-full bg-blue-400" />)}
                    </span>
                    <span className="absolute inset-0" aria-hidden="true">{s.art}</span>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-600 mb-1">Langkah {i + 1}</p>
                      <h3 className="text-lg font-bold text-slate-800">{s.title}</h3>
                      <p className="text-slate-400">{s.desc}</p>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0 mb-1 text-slate-700 group-hover:translate-x-1 group-hover:text-blue-600 transition" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </div>
                </>
              );
              return (
                // Efek melayang sama dengan kartu Fitur (lihat .float-card / .float-shadow di globals.css).
                <div key={s.title} className="relative" style={{ '--float-delay': `${i * -2}s` } as React.CSSProperties}>
                  <div className="float-shadow absolute inset-x-8 -bottom-5 h-6 rounded-[50%] bg-blue-900/20 blur-xl" aria-hidden="true" />
                  <div className="float-card relative h-full">
                    {s.link === 'login'
                      ? loginButton(cardClass, content)
                      : sewaButton(cardClass, content)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl bg-[#060b24] text-white md:min-h-[340px] grid md:grid-cols-[1.4fr_1fr] items-center">
            {/* Garis cahaya diagonal */}
            <span className="pointer-events-none absolute -top-10 left-[38%] w-16 h-[140%] rotate-[35deg] bg-gradient-to-b from-transparent via-blue-200/15 to-transparent blur-xl" aria-hidden="true" />

            <div className="relative p-8 sm:p-12">
              <h2 className="text-3xl md:text-4xl font-bold leading-snug text-amber-50 mb-4">
                Siap Live 24 Jam,<br />Channel Aktif Nonstop
              </h2>
              <p className="text-slate-300 mb-8 max-w-lg">
                {sewaExternal
                  ? 'Hubungi kami sekarang. Akun Anda bisa langsung dipakai hari ini, tanpa OBS dan tanpa komputer menyala.'
                  : 'Hubungi admin MediaFlow untuk mendapatkan akun, lalu mulai siaran tanpa OBS dan tanpa komputer menyala.'}
              </p>
              <div className="flex flex-wrap items-center gap-5">
                {sewaButton('px-7 py-3.5 font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-600/30 transition-colors')}
                {loginButton('font-medium text-slate-300 hover:text-white transition-colors')}
              </div>
            </div>

            {/* Kolom tampilan layar yang bergulir; terpotong oleh tepi banner */}
            <div className="relative hidden md:flex gap-5 h-[340px] pr-12 justify-end" aria-hidden="true">
              {[0, 1].map((col) => (
                <div key={col} className={`w-48 overflow-hidden ${col === 1 ? '-mt-10' : ''}`}>
                  <div className={col === 0 ? 'cta-scroll-up' : 'cta-scroll-down'}>
                    {/* Daftar diulang dua kali supaya guliran menyambung tanpa jeda */}
                    {[...SCREENS[col], ...SCREENS[col]].map((v, i) => (
                      <MiniScreen key={i} variant={v} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="relative overflow-hidden bg-[#060b24] text-slate-400">
        {/* Garis cahaya diagonal, sama dengan banner CTA */}
        <span className="pointer-events-none absolute -top-20 left-[55%] w-16 h-[160%] rotate-[35deg] bg-gradient-to-b from-transparent via-blue-200/10 to-transparent blur-xl" aria-hidden="true" />

        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 font-bold text-xl text-amber-50 mb-4">
              <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path d="M7 4l13 8-13 8V4z" /></svg>
              </span>
              MediaFlow
            </Link>
            <p className="text-sm leading-relaxed max-w-xs">
              Live stream video secara loop ke YouTube dan platform RTMP lain, 24 jam sehari, tanpa OBS dan tanpa komputer menyala.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-50 mb-4">Navigasi</h3>
            <ul className="space-y-3 text-sm">
              <li><a href="#kenapa" className="hover:text-white transition-colors">Kenapa MediaFlow</a></li>
              <li><a href="#fitur" className="hover:text-white transition-colors">Fitur</a></li>
              <li><a href="#cara-sewa" className="hover:text-white transition-colors">Cara Sewa</a></li>
              <li>{loginButton('hover:text-white transition-colors')}</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-50 mb-4">Mulai Sekarang</h3>
            <p className="text-sm mb-5">Dapatkan akun dan channel Anda live hari ini.</p>
            {sewaButton('inline-block px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-full shadow-lg shadow-blue-600/30 transition-colors')}
          </div>
        </div>
        <div className="relative border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
            <span>© {new Date().getFullYear()} MediaFlow. Semua hak dilindungi.</span>
            <span className="inline-flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
              Live 24/7
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
