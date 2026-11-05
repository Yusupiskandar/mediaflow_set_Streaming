import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { deleteUser, getUserById, setUserExpiry } from '@/lib/db';
import { stopStream, getAllLiveStreams } from '@/lib/stream';
import { MAIN_ADMIN_ID, isAccountExpired, parseExpiryInput } from '@/lib/subscription';

/**
 * Atur masa sewa akun.
 * Body: { expiresAt: string | null } (null = tanpa batas, waktu lampau = nonaktif sekarang)
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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

    if (targetUserId === MAIN_ADMIN_ID) {
      return NextResponse.json({ error: 'Admin utama tidak memiliki masa sewa' }, { status: 400 });
    }

    const target = getUserById(targetUserId);
    if (!target) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    if (!('expiresAt' in body)) {
      return NextResponse.json({ error: 'expiresAt harus diisi (boleh null)' }, { status: 400 });
    }

    const expiry = parseExpiryInput(body.expiresAt);
    if (!expiry.ok) {
      return NextResponse.json({ error: expiry.error }, { status: 400 });
    }

    setUserExpiry(targetUserId, expiry.value);
    const updated = { ...target, expires_at: expiry.value };
    const expired = isAccountExpired(updated);

    // Langsung nonaktif: hentikan live-nya tanpa menunggu pengecekan berkala.
    if (expired && getAllLiveStreams().has(targetUserId)) {
      stopStream(targetUserId, 'expired');
    }

    console.log(
      `[Sewa] ${session.username} mengatur masa sewa ${target.username}: ${expiry.value ?? 'tanpa batas'}`
    );

    return NextResponse.json({
      message: expired
        ? `Akun ${target.username} dinonaktifkan`
        : `Masa sewa ${target.username} diperbarui`,
      user: { id: targetUserId, username: target.username, expires_at: expiry.value, isExpired: expired },
    });
  } catch (error) {
    console.error('Set expiry error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
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

    if (targetUserId === 1) {
      return NextResponse.json({ error: 'Tidak dapat menghapus akun Admin utama' }, { status: 403 });
    }

    if (!getUserById(targetUserId)) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    // Hentikan live stream milik user ini (jika ada) sebelum akunnya dihapus.
    stopStream(targetUserId);
    deleteUser(targetUserId);

    return NextResponse.json({ message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
