import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getStreamStatus } from '@/lib/stream';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const status = getStreamStatus(user.userId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Stream status error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil status stream' },
      { status: 500 }
    );
  }
}
