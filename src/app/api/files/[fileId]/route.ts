import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { deleteMediaFile, findFileById } from '@/lib/media/files';
import { deleteResumePosition, getSchedule } from '@/lib/db';
import { getStreamStatus } from '@/lib/stream';

// Metadata satu file berdasarkan ID, termasuk file di dalam subfolder.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const file = findFileById(user.userId, fileId);

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ file });
  } catch (error) {
    console.error('File detail error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil file' },
      { status: 500 }
    );
  }
}

/**
 * Hapus file media milik akun ini.
 * Ditolak (409) jika file sedang dipakai live atau dijadwalkan untuk live.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await params;
    const file = findFileById(user.userId, fileId);
    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 });
    }

    if (getStreamStatus(user.userId).streams.some((s) => s.videoId === fileId)) {
      return NextResponse.json(
        { error: 'File ini sedang dipakai live. Hentikan live terlebih dahulu.' },
        { status: 409 }
      );
    }

    const schedule = getSchedule(user.userId);
    if (schedule && !schedule.last_error && schedule.start_at && schedule.video_id === fileId) {
      return NextResponse.json(
        { error: 'File ini dipakai jadwal live. Batalkan jadwal terlebih dahulu.' },
        { status: 409 }
      );
    }

    let deletedSubtitles: string[];
    try {
      ({ deletedSubtitles } = deleteMediaFile(user.userId, file));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EBUSY' || code === 'EPERM') {
        return NextResponse.json(
          { error: 'File sedang dibuka oleh proses lain. Tunggu sebentar lalu coba lagi.' },
          { status: 409 }
        );
      }
      if (code === 'ENOENT') {
        return NextResponse.json({ error: 'File sudah tidak ada' }, { status: 404 });
      }
      throw error;
    }

    deleteResumePosition(user.userId, fileId);
    console.log(`[Media] ${user.username} menghapus ${file.path}`);

    return NextResponse.json({
      message: `${file.name} dihapus`,
      deletedSubtitles,
    });
  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus file' }, { status: 500 });
  }
}
