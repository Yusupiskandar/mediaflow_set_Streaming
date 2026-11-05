import fs from 'fs';
import path from 'path';

// Cari binary ffmpeg-static langsung di node_modules (import 'ffmpeg-static'
// menghasilkan path yang salah setelah di-bundle oleh Next.js).
function resolveFFmpegPath(): string {
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback ke ffmpeg sistem
  return 'ffmpeg';
}

export const FFMPEG_PATH = resolveFFmpegPath();
