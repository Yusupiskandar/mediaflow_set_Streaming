// Aturan masa sewa akun.

/** Admin utama tidak punya masa sewa dan selalu aktif. */
export const MAIN_ADMIN_ID = 1;

export function isAccountExpired(user: { id: number; expires_at: string | null }, now = Date.now()): boolean {
  if (user.id === MAIN_ADMIN_ID || !user.expires_at) return false;
  const expiresAt = Date.parse(user.expires_at);
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

/**
 * Validasi nilai masa sewa dari request admin.
 * - `null` / `''` = tanpa batas
 * - string tanggal yang valid = dinormalkan ke ISO UTC
 */
export function parseExpiryInput(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'Format masa sewa tidak valid' };
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    return { ok: false, error: 'Tanggal masa sewa tidak valid' };
  }
  return { ok: true, value: new Date(time).toISOString() };
}

export function formatExpiryForMessage(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}
