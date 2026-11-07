import { NextResponse } from 'next/server';
import { getCurrentUser, hashPassword, validatePassword } from '@/lib/auth';
import { getUserById, setUserPassword } from '@/lib/db';
import { MAIN_ADMIN_ID } from '@/lib/subscription';

/**
 * Admin mengatur ulang sandi akun penyewa.
 * Body: { password: string }
 * Semua sesi login akun tersebut langsung keluar. Live yang sedang berjalan tidak dihentikan.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getCurrentUser();
    if (!session || session.userId !== MAIN_ADMIN_ID) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await context.params;
    const targetUserId = parseInt(id, 10);
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 });
    }

    // Sandi admin utama diganti lewat /api/auth/change-password (wajib sandi lama).
    if (targetUserId === MAIN_ADMIN_ID) {
      return NextResponse.json({ error: 'Gunakan menu Ganti Sandi untuk akun admin' }, { status: 400 });
    }

    const target = getUserById(targetUserId);
    if (!target) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const invalid = validatePassword(body.password);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    setUserPassword(targetUserId, await hashPassword(body.password));
    console.log(`[Sandi] ${session.username} mengatur ulang sandi ${target.username}`);

    return NextResponse.json({ message: `Sandi ${target.username} berhasil diatur ulang` });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
