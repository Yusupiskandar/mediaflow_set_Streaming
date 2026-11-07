import Link from 'next/link';

/** Logo MediaFlow. `tone="dark"` untuk latar gelap (tulisan krem), default untuk latar terang. */
export default function Logo({ href = '/', tone = 'light' }: { href?: string; tone?: 'light' | 'dark' }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 font-bold text-xl ${tone === 'dark' ? 'text-amber-50' : 'text-blue-700'}`}
    >
      <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true"><path d="M7 4l13 8-13 8V4z" /></svg>
      </span>
      MediaFlow
    </Link>
  );
}
