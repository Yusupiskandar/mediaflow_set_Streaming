import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { deleteUser } from '@/lib/db';

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

    deleteUser(targetUserId);

    return NextResponse.json({ message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
