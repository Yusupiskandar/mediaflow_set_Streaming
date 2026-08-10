import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { findFileById, getMediaDir } from './files';

interface StreamSession {
  userId: number;
  process: ChildProcess;
  videoId: string;
  videoName: string;
  startedAt: Date;
  streamKey: string;
}

const activeStreams = new Map<number, StreamSession>();
const DEFAULT_STREAM_URL = 'rtmp://a.rtmp.youtube.com/live2';

function getFFmpegPath(): string {
  // Try to find ffmpeg-static binary
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback to system ffmpeg
  return 'ffmpeg';
}

const FFMPEG_PATH = getFFmpegPath();

export function startStream(userId: number, videoId: string, streamKey: string, streamUrl?: string): { success: boolean; message: string; pid?: number } {
  if (activeStreams.has(userId)) {
    return { success: false, message: 'Anda sudah memiliki stream yang sedang berjalan. Matikan terlebih dahulu.' };
  }

  if (!streamKey || streamKey.trim() === '') {
    return { success: false, message: 'Stream key harus diisi' };
  }

  const file = findFileById(videoId);
  if (!file) {
    return { success: false, message: 'File video tidak ditemukan' };
  }

  const videoPath = path.join(getMediaDir(), file.path);

  const baseUrl = streamUrl?.trim() || DEFAULT_STREAM_URL;
  const rtmpDestination = baseUrl.endsWith('/') ? `${baseUrl}${streamKey.trim()}` : `${baseUrl}/${streamKey.trim()}`;

  const ffmpegArgs = [
    '-re',
    '-stream_loop', '-1',
    '-i', videoPath,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-maxrate', '3000k',
    '-bufsize', '6000k',
    '-pix_fmt', 'yuv420p',
    '-g', '50',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-ar', '44100',
    '-f', 'flv',
    rtmpDestination
  ];

  try {
    console.log('[FFmpeg] Starting with path:', FFMPEG_PATH);
    console.log('[FFmpeg] Args:', ffmpegArgs.join(' '));

    const ffmpegProcess = spawn(FFMPEG_PATH, ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    ffmpegProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      console.log('[FFmpeg]:', message.substring(0, 200));
    });

    ffmpegProcess.on('error', (error) => {
      console.error('[FFmpeg spawn error]:', error.message);
      activeStreams.delete(userId);
    });

    ffmpegProcess.on('exit', (code, signal) => {
      console.log(`[FFmpeg] Process exited with code ${code}, signal ${signal}`);
      activeStreams.delete(userId);
    });

    const session: StreamSession = {
      userId,
      process: ffmpegProcess,
      videoId,
      videoName: file.name,
      startedAt: new Date(),
      streamKey: streamKey.substring(0, 8) + '****',
    };

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

export function stopStream(userId: number): { success: boolean; message: string } {
  const session = activeStreams.get(userId);

  if (!session) {
    return { success: false, message: 'Stream tidak ditemukan' };
  }

  try {
    // Gunakan SIGINT untuk graceful stop (seperti Ctrl+C)
    // FFmpeg akan menutup koneksi RTMP secara rapi
    session.process.kill('SIGINT');
    activeStreams.delete(userId);

    return {
      success: true,
      message: `Stream dihentikan untuk ${session.videoName}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Gagal menghentikan stream: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export function getStreamStatus(userId: number): { isStreaming: boolean; streams: Array<{ videoId: string; videoName: string; startedAt: string; streamKey: string }> } {
  const session = activeStreams.get(userId);
  const streams = session ? [{
    videoId: session.videoId,
    videoName: session.videoName,
    startedAt: session.startedAt.toISOString(),
    streamKey: session.streamKey,
  }] : [];

  return {
    isStreaming: !!session,
    streams,
  };
}
