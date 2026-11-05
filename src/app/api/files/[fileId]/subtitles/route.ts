import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findFileById, getSubtitlesForFile } from '@/lib/media/files';
import { parseSubtitle } from '@/lib/media/subtitle';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { fileId } = await params;
    const file = findFileById(user.userId, fileId);

    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan' },
        { status: 404 }
      );
    }

    const subtitles = getSubtitlesForFile(user.userId, file.path);

    const subtitlesWithContent = subtitles.map(sub => ({
      ...sub,
      entries: parseSubtitle(user.userId, sub.path, sub.format),
    }));

    return NextResponse.json({ subtitles: subtitlesWithContent });
  } catch (error) {
    console.error('Subtitles error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil subtitle' },
      { status: 500 }
    );
  }
}
