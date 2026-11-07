import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { saveSchedule } from '@/lib/db';
import { findFileById } from '@/lib/media/files';
import { ensureScheduler, parseScheduleInput } from '@/lib/schedule';
import { isStreaming, startStream } from '@/lib/stream';
import { formatExpiryForMessage } from '@/lib/subscription';

const DEFAULT_STREAM_URL = 'rtmp://a.rtmp.youtube.com/live2';

/**
 * Mulai live.
 * Body: { videoId, streamKey, streamUrl?, startAt?, stopAt? }
 * - tanpa startAt/stopAt: mulai sekarang, nonstop
 * - stopAt saja: mulai sekarang, berhenti otomatis
 * - startAt (+ stopAt opsional): dijadwalkan, server yang memulai saat waktunya tiba
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { videoId, streamUrl, streamKey, startAt, stopAt } = await request.json();

    if (!videoId || !streamKey) {
      return NextResponse.json(
        { error: 'videoId dan streamKey harus diisi' },
        { status: 400 }
      );
    }

    const schedule = parseScheduleInput({ startAt, stopAt }, user.expiresAt);
    if (!schedule.ok) {
      return NextResponse.json({ error: schedule.error }, { status: 400 });
    }

    const record = {
      user_id: user.userId,
      video_id: String(videoId),
      stream_url: (typeof streamUrl === 'string' && streamUrl.trim()) || DEFAULT_STREAM_URL,
      stream_key: String(streamKey).trim(),
      start_at: schedule.startAt,
      stop_at: schedule.stopAt,
    };

    // Dijadwalkan: simpan saja, server yang memulai nanti.
    if (schedule.startAt) {
      if (isStreaming(user.userId)) {
        return NextResponse.json(
          { error: 'Hentikan live yang sedang berjalan sebelum membuat jadwal.' },
          { status: 400 }
        );
      }
      const file = findFileById(user.userId, record.video_id);
      if (!file) {
        return NextResponse.json({ error: 'File video tidak ditemukan' }, { status: 400 });
      }

      saveSchedule(record);
      ensureScheduler();
      return NextResponse.json({
        message: `Live ${file.name} dijadwalkan mulai ${formatExpiryForMessage(schedule.startAt)}`,
        scheduled: true,
      });
    }

    const result = startStream(user.userId, record.video_id, record.stream_key, record.stream_url);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    // Mulai sekarang dengan berhenti otomatis.
    if (schedule.stopAt) {
      saveSchedule(record);
      ensureScheduler();
    }

    return NextResponse.json({
      message: schedule.stopAt
        ? `${result.message}, berhenti otomatis ${formatExpiryForMessage(schedule.stopAt)}`
        : result.message,
      pid: result.pid,
    });
  } catch (error) {
    console.error('Stream start error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memulai stream' },
      { status: 500 }
    );
  }
}
