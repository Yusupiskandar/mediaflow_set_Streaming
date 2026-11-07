import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { deleteSchedule, getSchedule } from '@/lib/db';

/** Batalkan jadwal live yang belum dimulai, atau tutup pesan jadwal yang gagal. */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!getSchedule(user.userId)) {
      return NextResponse.json({ error: 'Tidak ada jadwal' }, { status: 404 });
    }

    deleteSchedule(user.userId);
    return NextResponse.json({ message: 'Jadwal dibatalkan' });
  } catch (error) {
    console.error('Cancel schedule error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan saat membatalkan jadwal' }, { status: 500 });
  }
}
