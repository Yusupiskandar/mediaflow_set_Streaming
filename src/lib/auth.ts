import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { getUserById } from '@/lib/db';
import { isAccountExpired } from '@/lib/subscription';
import type { AuthPayload } from '@/types';

const COOKIE_NAME = 'mediaflow_token';
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

// Nilai lama yang pernah dipakai sebagai default. Token yang ditandatangani dengan
// nilai ini bisa dipalsukan siapa saja, jadi ditolak.
const KNOWN_INSECURE_SECRETS = ['mediaflow-secret-key-change-in-production'];

// Dibaca saat dipakai (bukan saat import) supaya `next build` tetap jalan tanpa env.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || KNOWN_INSECURE_SECRETS.includes(secret)) {
    throw new Error(
      'JWT_SECRET belum diatur atau terlalu lemah. Isi minimal 32 karakter acak di .env.local (lihat .env.example).'
    );
  }
  return secret;
}

export const PASSWORD_MIN_LENGTH = 6;

/** Aturan sandi yang sama untuk buat user, reset, dan ganti sandi. Mengembalikan pesan error atau null. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'Sandi harus diisi';
  if (password.length < PASSWORD_MIN_LENGTH) return `Sandi minimal ${PASSWORD_MIN_LENGTH} karakter`;
  if (password.length > 128) return 'Sandi maksimal 128 karakter';
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_MAX_AGE });
}

/** `issuedAt` = waktu token dibuat (detik), dipakai untuk menolak token yang lebih tua dari sandi terbaru. */
export function verifyToken(token: string): (AuthPayload & { issuedAt?: number }) | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthPayload & { iat?: number };
    return { userId: decoded.userId, username: decoded.username, issuedAt: decoded.iat };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) return null;
    throw error;
  }
}

/**
 * User dari cookie login. Token hanya dianggap sah jika user-nya masih ada di
 * database, jadi user yang sudah dihapus langsung kehilangan akses.
 */
export async function getCurrentUser(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = getUserById(payload.userId);
  if (!user) return null;

  // Sandi sudah diganti setelah token ini dibuat = sesi lama dikeluarkan.
  // Dibandingkan per detik karena `iat` di token berpresisi detik.
  if (user.password_changed_at) {
    const changedAtSec = Math.floor(Date.parse(user.password_changed_at) / 1000);
    if (payload.issuedAt === undefined || payload.issuedAt < changedAtSec) return null;
  }

  // Masa sewa habis = akun nonaktif, semua akses langsung terputus.
  if (isAccountExpired(user)) return null;

  return { userId: user.id, username: user.username, expiresAt: user.expires_at };
}

export function setAuthCookie(token: string) {
  return {
    'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_MAX_AGE}`
  };
}

export function clearAuthCookie() {
  return {
    'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  };
}
