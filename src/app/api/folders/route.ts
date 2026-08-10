import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFolders, ensureMediaDir } from '@/lib/files';

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

    const folders = getFolders(dir);

    return NextResponse.json({ folders });
  } catch (error) {
    console.error('Folders error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil folder' },
      { status: 500 }
    );
  }
}
