import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

// Cookie login bersifat HttpOnly, jadi hanya server yang bisa menghapusnya.
export async function POST() {
  const response = NextResponse.json({ message: 'Logout berhasil' });
  response.headers.set('Set-Cookie', clearAuthCookie()['Set-Cookie']);
  return response;
}
