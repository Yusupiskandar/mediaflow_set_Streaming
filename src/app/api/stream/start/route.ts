import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { startStream } from '@/lib/stream';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { videoId, streamUrl, streamKey } = await request.json();

    if (!videoId || !streamKey) {
      return NextResponse.json(
        { error: 'videoId dan streamKey harus diisi' },
        { status: 400 }
      );
    }

    const result = startStream(user.userId, videoId, streamKey, streamUrl);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: result.message,
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
