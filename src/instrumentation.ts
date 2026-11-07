// Dijalankan sekali saat server Next.js menyala (lihat docs: instrumentation).
export async function register() {
  // Jadwal live butuh Node.js (SQLite + ffmpeg), jadi tidak dijalankan di runtime edge.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureScheduler } = await import('./lib/schedule');
    ensureScheduler();
  }
}
