import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getMediaFiles, ensureMediaDir } from '@/lib/files';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    ensureMediaDir();

    const { searchParams } = new URL(request.url);
    const dir = searchParams.get('dir') || '';

    const files = getMediaFiles(dir);

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Files error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil file' },
      { status: 500 }
    );
  }
}
