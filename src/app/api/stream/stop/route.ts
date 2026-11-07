import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { stopStream } from '@/lib/stream';
import { deleteSchedule } from '@/lib/db';

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = stopStream(user.userId);
    // Stop manual juga membatalkan berhenti otomatis yang tersisa.
    deleteSchedule(user.userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: result.message });
  } catch (error) {
    console.error('Stream stop error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghentikan stream' },
      { status: 500 }
    );
  }
}
