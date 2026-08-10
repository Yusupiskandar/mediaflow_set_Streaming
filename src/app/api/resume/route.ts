import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getResumePosition, saveResumePosition } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId harus diisi' },
        { status: 400 }
      );
    }

    const progress = getResumePosition(user.userId, fileId) as {
      position_seconds: number;
      duration_seconds: number;
      updated_at: string;
    } | undefined;

    return NextResponse.json({
      position: progress?.position_seconds || 0,
      duration: progress?.duration_seconds || 0,
      updatedAt: progress?.updated_at || null,
    });
  } catch (error) {
    console.error('Resume GET error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil posisi' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { fileId, position, duration } = await request.json();

    if (!fileId || typeof position !== 'number' || typeof duration !== 'number') {
      return NextResponse.json(
        { error: 'Data tidak valid' },
        { status: 400 }
      );
    }

    saveResumePosition(user.userId, fileId, position, duration);

    return NextResponse.json({ message: 'Posisi tersimpan' });
  } catch (error) {
    console.error('Resume POST error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan posisi' },
      { status: 500 }
    );
  }
}
