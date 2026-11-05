import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { getAllLiveStreams, stopStream } from '@/lib/stream';

// Admin menghentikan live milik akun mana pun.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();

    // Hanya Admin (ID = 1) yang bisa mengakses
    if (!session || session.userId !== 1) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await context.params;
    const targetUserId = parseInt(id, 10);

    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    const target = getUserById(targetUserId);
    if (!target) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Pakai getAllLiveStreams, bukan getStreamStatus: getStreamStatus menghapus notifikasi milik user.
    if (!getAllLiveStreams().has(targetUserId)) {
      return NextResponse.json({ error: `${target.username} sedang tidak live` }, { status: 409 });
    }

    // Live milik admin sendiri dianggap dihentikan oleh pemiliknya.
    const reason = targetUserId === session.userId ? 'user' : 'admin';
    const result = stopStream(targetUserId, reason);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    console.log(`[Admin] ${session.username} menghentikan live milik ${target.username} (user ${targetUserId})`);

    return NextResponse.json({ message: `Live ${target.username} dihentikan` });
  } catch (error) {
    console.error('Admin stop stream error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
