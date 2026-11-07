import { NextResponse } from 'next/server';
import {
  getCurrentUser,
  hashPassword,
  verifyPassword,
  validatePassword,
  generateToken,
  setAuthCookie,
} from '@/lib/auth';
import { getPasswordHashById, setUserPassword } from '@/lib/db';
import type { AuthPayload } from '@/types';

/**
 * User yang sedang login mengganti sandinya sendiri.
 * Body: { currentPassword: string, newPassword: string }
 * Sesi di perangkat lain keluar; perangkat ini mendapat token baru agar tetap login.
 */
export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { currentPassword, newPassword } = body as { currentPassword?: unknown; newPassword?: unknown };

    if (typeof currentPassword !== 'string' || !currentPassword) {
      return NextResponse.json({ error: 'Sandi lama harus diisi' }, { status: 400 });
    }

    const invalid = validatePassword(newPassword);
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const currentHash = getPasswordHashById(session.userId);
    if (!currentHash || !(await verifyPassword(currentPassword, currentHash))) {
      return NextResponse.json({ error: 'Sandi lama salah' }, { status: 400 });
    }

    if (await verifyPassword(newPassword as string, currentHash)) {
      return NextResponse.json({ error: 'Sandi baru harus berbeda dari sandi lama' }, { status: 400 });
    }

    setUserPassword(session.userId, await hashPassword(newPassword as string));

    // Token baru dibuat setelah sandi diganti, jadi tetap sah untuk perangkat ini.
    const payload: AuthPayload = { userId: session.userId, username: session.username };
    const response = NextResponse.json({ message: 'Sandi berhasil diganti' });
    response.headers.set('Set-Cookie', setAuthCookie(generateToken(payload))['Set-Cookie']);

    console.log(`[Sandi] ${session.username} mengganti sandinya sendiri`);
    return response;
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
