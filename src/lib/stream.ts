import { ChildProcess, spawn } from 'child_process';
import { findFileById, getAbsoluteFilePath } from './media/files';
import { FFMPEG_PATH } from './ffmpeg';

interface StreamSession {
  userId: number;
  process: ChildProcess;
  videoId: string;
  videoName: string;
  videoPath: string;
  rtmpDestination: string;
  startedAt: Date;
  streamKey: string;
  isStopping: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
  reconnectTimer?: NodeJS.Timeout;
  uptimeTimer?: NodeJS.Timeout;
}

// Disimpan di globalThis supaya tidak hilang saat modul dimuat ulang (HMR di mode dev),
// sehingga proses ffmpeg yang masih berjalan tetap bisa dihentikan.
const globalForStream = globalThis as unknown as {
  mediaflowStreams?: Map<number, StreamSession>;
  mediaflowAdminStops?: Set<number>;
};
const activeStreams = (globalForStream.mediaflowStreams ??= new Map<number, StreamSession>());
// Akun yang live-nya baru dihentikan admin. Dipakai sekali untuk memberi tahu pemilik akun.
const adminStoppedUsers = (globalForStream.mediaflowAdminStops ??= new Set<number>());

function maskStreamKey(key: string): string {
  const trimmed = key.trim();
  return trimmed.length <= 4 ? '****' : `****${trimmed.slice(-4)}`;
}
const DEFAULT_STREAM_URL = 'rtmp://a.rtmp.youtube.com/live2';
const MAX_RECONNECT_ATTEMPTS = 10;

function spawnFFmpegProcess(userId: number, videoPath: string, rtmpDestination: string): ChildProcess {
  const ffmpegArgs = [
    '-re',
    '-stream_loop', '-1',
    '-i', videoPath,
    '-c:v', 'libx264',
    '-preset', 'superfast',
    '-maxrate', '3000k',
    '-bufsize', '6000k',
    '-pix_fmt', 'yuv420p',
    '-g', '60',
    '-keyint_min', '60',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-ar', '44100',
    '-flvflags', 'no_duration_filesize',
    '-f', 'flv',
    rtmpDestination
  ];

  console.log('[FFmpeg] Starting with path:', FFMPEG_PATH);
  console.log('[FFmpeg] Args:', ffmpegArgs.join(' '));

  const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  ffmpegProcess.stderr?.on('data', (data: Buffer) => {
    const message = data.toString();
    if (message.includes('Error') || message.includes('failed') || message.includes('speed=')) {
      console.log('[FFmpeg]:', message.trim().substring(0, 200));
    }
  });

  ffmpegProcess.on('error', (error) => {
    console.error(`[FFmpeg spawn error for user ${userId}]:`, error.message);
  });

  ffmpegProcess.on('exit', (code, signal) => {
    console.log(`[FFmpeg] Process for user ${userId} exited with code ${code}, signal ${signal}`);

    const session = activeStreams.get(userId);
    if (!session) return;

    if (session.uptimeTimer) {
      clearTimeout(session.uptimeTimer);
      session.uptimeTimer = undefined;
    }

    // Jika dihentikan secara sengaja oleh user, jangan reconnect
    if (session.isStopping) {
      activeStreams.delete(userId);
      return;
    }

    // Tangani disconnect mendadak (misal error network -10054 / reset by peer)
    if (session.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      session.reconnectAttempts++;
      session.isReconnecting = true;
      const delay = Math.min(session.reconnectAttempts * 2000, 10000);

      console.log(`[FFmpeg] Koneksi terputus. Mencoba menghubungkan ulang dalam ${delay / 1000} detik... (Percobaan ${session.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

      session.reconnectTimer = setTimeout(() => {
        const currentSession = activeStreams.get(userId);
        if (!currentSession || currentSession.isStopping) return;

        try {
          const newProcess = spawnFFmpegProcess(userId, currentSession.videoPath, currentSession.rtmpDestination);
          currentSession.process = newProcess;
          currentSession.isReconnecting = false;

          // Jika koneksi sudah berjalan stabil 60 detik, reset hitungan reconnect
          currentSession.uptimeTimer = setTimeout(() => {
            if (activeStreams.has(userId) && !currentSession.isStopping) {
              currentSession.reconnectAttempts = 0;
              console.log(`[FFmpeg] Stream stabil untuk user ${userId}. Reconnect attempts di-reset.`);
            }
          }, 60000);

          console.log(`[FFmpeg] Reconnect berhasil dimulai untuk user ${userId} (PID: ${newProcess.pid})`);
        } catch (err) {
          console.error(`[FFmpeg] Gagal melakukan reconnect untuk user ${userId}:`, err);
        }
      }, delay);
    } else {
      console.error(`[FFmpeg] Batas maksimum percobaan reconnect (${MAX_RECONNECT_ATTEMPTS}) tercapai. Stream dihentikan.`);
      activeStreams.delete(userId);
    }
  });

  return ffmpegProcess;
}

export function startStream(userId: number, videoId: string, streamKey: string, streamUrl?: string): { success: boolean; message: string; pid?: number } {
  adminStoppedUsers.delete(userId);

  if (activeStreams.has(userId)) {
    return { success: false, message: 'Anda sudah memiliki stream yang sedang berjalan. Matikan terlebih dahulu.' };
  }

  if (!streamKey || streamKey.trim() === '') {
    return { success: false, message: 'Stream key harus diisi' };
  }

  const file = findFileById(userId, videoId);
  if (!file) {
    return { success: false, message: 'File video tidak ditemukan' };
  }

  const videoPath = getAbsoluteFilePath(userId, file);
  const baseUrl = streamUrl?.trim() || DEFAULT_STREAM_URL;
  const rtmpDestination = baseUrl.endsWith('/') ? `${baseUrl}${streamKey.trim()}` : `${baseUrl}/${streamKey.trim()}`;

  try {
    const ffmpegProcess = spawnFFmpegProcess(userId, videoPath, rtmpDestination);

    const session: StreamSession = {
      userId,
      process: ffmpegProcess,
      videoId,
      videoName: file.name,
      videoPath,
      rtmpDestination,
      startedAt: new Date(),
      streamKey: maskStreamKey(streamKey),
      isStopping: false,
      isReconnecting: false,
      reconnectAttempts: 0,
    };

    session.uptimeTimer = setTimeout(() => {
      if (activeStreams.has(userId) && !session.isStopping) {
        session.reconnectAttempts = 0;
      }
    }, 60000);

    activeStreams.set(userId, session);

    return {
      success: true,
      message: `Stream dimulai untuk ${file.name}`,
      pid: ffmpegProcess.pid,
    };
  } catch (error) {
    return {
      success: false,
      message: `Gagal memulai stream: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export type StopReason = 'user' | 'admin';

export function stopStream(userId: number, reason: StopReason = 'user'): { success: boolean; message: string } {
  const session = activeStreams.get(userId);

  if (!session) {
    return { success: false, message: 'Stream tidak ditemukan' };
  }

  session.isStopping = true;

  if (reason === 'admin') {
    adminStoppedUsers.add(userId);
  } else {
    adminStoppedUsers.delete(userId);
  }

  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = undefined;
  }

  if (session.uptimeTimer) {
    clearTimeout(session.uptimeTimer);
    session.uptimeTimer = undefined;
  }

  try {
    session.process.kill('SIGINT');

    setTimeout(() => {
      try {
        if (!session.process.killed) {
          session.process.kill('SIGKILL');
        }
      } catch {
        // ignore
      }
    }, 3000);

    activeStreams.delete(userId);

    return {
      success: true,
      message: `Stream dihentikan untuk ${session.videoName}`,
    };
  } catch (error) {
    activeStreams.delete(userId);
    return {
      success: false,
      message: `Gagal menghentikan stream: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function getStreamStatus(userId: number): {
  isStreaming: boolean;
  streams: Array<{
    videoId: string;
    videoName: string;
    startedAt: string;
    streamKey: string;
    isReconnecting?: boolean;
    reconnectAttempts?: number;
  }>;
  stoppedByAdmin: boolean;
} {
  const session = activeStreams.get(userId);
  const streams = session ? [{
    videoId: session.videoId,
    videoName: session.videoName,
    startedAt: session.startedAt.toISOString(),
    streamKey: session.streamKey,
    isReconnecting: session.isReconnecting,
    reconnectAttempts: session.reconnectAttempts,
  }] : [];

  return {
    isStreaming: !!session,
    // Hanya dikirim sekali, setelah itu dihapus supaya pesan tidak muncul terus.
    stoppedByAdmin: !session && adminStoppedUsers.delete(userId),
    streams,
  };
}


export interface LiveInfo {
  videoName: string;
  startedAt: string;
  streamKey: string;
  destination: string;
  isReconnecting: boolean;
  reconnectAttempts: number;
}

/** Nama host tujuan RTMP (tanpa stream key), misalnya `a.rtmp.youtube.com`. */
function describeDestination(rtmpDestination: string): string {
  try {
    return new URL(rtmpDestination).hostname || 'RTMP';
  } catch {
    return 'RTMP';
  }
}

/** Status live semua akun, untuk halaman admin. Kunci = userId. */
export function getAllLiveStreams(): Map<number, LiveInfo> {
  const result = new Map<number, LiveInfo>();
  for (const [userId, session] of activeStreams) {
    result.set(userId, {
      videoName: session.videoName,
      startedAt: session.startedAt.toISOString(),
      streamKey: session.streamKey,
      destination: describeDestination(session.rtmpDestination),
      isReconnecting: session.isReconnecting,
      reconnectAttempts: session.reconnectAttempts,
    });
  }
  return result;
}
