import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFolders, ensureUserMediaDir, InvalidPathError } from '@/lib/media/files';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    ensureUserMediaDir(user.userId);

    const { searchParams } = new URL(request.url);
    const dir = searchParams.get('dir') || '';

    const folders = getFolders(user.userId, dir);

    return NextResponse.json({ folders });
  } catch (error) {
    if (error instanceof InvalidPathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Folders error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil folder' },
      { status: 500 }
    );
  }
}
