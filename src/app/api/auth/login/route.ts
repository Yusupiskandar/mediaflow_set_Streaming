import { NextResponse } from 'next/server';
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth';
import { getUserByUsername } from '@/lib/db';
import { isAccountExpired, formatExpiryForMessage } from '@/lib/subscription';
import type { AuthPayload } from '@/types';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password harus diisi' },
        { status: 400 }
      );
    }

    const user = getUserByUsername(username) as
      | { id: number; username: string; password_hash: string; expires_at: string | null }
      | undefined;

    if (!user) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    if (isAccountExpired(user)) {
      return NextResponse.json(
        {
          error: `Masa sewa akun ini sudah berakhir pada ${formatExpiryForMessage(user.expires_at!)}. Hubungi admin untuk memperpanjang.`,
          code: 'ACCOUNT_EXPIRED',
        },
        { status: 403 }
      );
    }

    const payload: AuthPayload = { userId: user.id, username: user.username };
    const token = generateToken(payload);

    const response = NextResponse.json({
      message: 'Login berhasil',
      user: { id: user.id, username: user.username },
    });

    const cookieHeaders = setAuthCookie(token);
    response.headers.set('Set-Cookie', cookieHeaders['Set-Cookie']);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat login' },
      { status: 500 }
    );
  }
}
