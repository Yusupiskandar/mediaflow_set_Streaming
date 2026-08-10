import { NextResponse } from 'next/server';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';
import { createUser, getUserByUsername } from '@/lib/db';
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

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username minimal 3 karakter' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter' },
        { status: 400 }
      );
    }

    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username sudah digunakan' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const userId = createUser(username, passwordHash) as number;

    const payload: AuthPayload = { userId, username };
    const token = generateToken(payload);

    const response = NextResponse.json({
      message: 'Registrasi berhasil',
      user: { id: userId, username },
    });

    const cookieHeaders = setAuthCookie(token);
    response.headers.set('Set-Cookie', cookieHeaders['Set-Cookie']);

    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat registrasi' },
      { status: 500 }
    );
  }
}
