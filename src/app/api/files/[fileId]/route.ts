import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { findFileById } from '@/lib/media/files';

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
