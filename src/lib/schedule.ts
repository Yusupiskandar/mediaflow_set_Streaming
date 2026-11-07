// Jadwal live otomatis: mulai dan/atau berhenti pada waktu tertentu.
//
// Alur satu jadwal (tabel stream_schedules, satu baris per akun):
//   start_at terisi            -> menunggu; saat tiba, live dimulai oleh server
//   start_at NULL, stop_at ada -> live berjalan; saat stop_at tiba, live dihentikan
//   last_error terisi          -> jadwal gagal; baris disimpan agar user melihat alasannya
// Jadwal tanpa start_at dan stop_at tidak disimpan (live manual nonstop seperti biasa).

import {
  deleteSchedule,
  getAllSchedules,
  getSchedule,
  getUserById,
  markScheduleFailed,
  markScheduleStarted,
} from './db';
import { findFileById } from './media/files';
import { isStreaming, startStream, stopStream } from './stream';
import { isAccountExpired, formatExpiryForMessage } from './subscription';

const TICK_MS = 5_000;
/** Toleransi waktu mulai di masa lalu (jam browser dan server bisa sedikit berbeda). */
const CLOCK_SKEW_MS = 60_000;
/** Jarak minimal antara mulai dan berhenti. */
const MIN_DURATION_MS = 60_000;

const globalForSchedule = globalThis as unknown as { mediaflowScheduler?: NodeJS.Timeout };

/** Jalankan pengecek jadwal sekali per proses server (aman dipanggil berkali-kali). */
export function ensureScheduler() {
  if (globalForSchedule.mediaflowScheduler) return;
  const timer = setInterval(() => {
    try {
      runScheduleTick();
    } catch (error) {
      console.error('[Jadwal] Gagal memproses jadwal:', error);
    }
  }, TICK_MS);
  timer.unref?.();
  globalForSchedule.mediaflowScheduler = timer;
  // Langsung proses juga, misalnya jadwal yang terlewat saat server mati.
  try {
    runScheduleTick();
  } catch (error) {
    console.error('[Jadwal] Gagal memproses jadwal:', error);
  }
}

export function runScheduleTick(now = Date.now()) {
  for (const row of getAllSchedules()) {
    if (row.last_error) continue;

    const user = getUserById(row.user_id);
    if (!user) {
      deleteSchedule(row.user_id);
      continue;
    }

    const live = isStreaming(row.user_id);
    const stopAt = row.stop_at ? Date.parse(row.stop_at) : null;

    // Menunggu jadwal mulai.
    if (row.start_at) {
      if (Date.parse(row.start_at) > now) continue;

      if (stopAt !== null && stopAt <= now) {
        markScheduleFailed(row.user_id, 'Jadwal terlewat karena server tidak berjalan saat waktu mulai.');
        continue;
      }
      if (isAccountExpired(user)) {
        markScheduleFailed(row.user_id, 'Live terjadwal tidak dimulai karena masa sewa akun sudah habis.');
        continue;
      }
      if (live) {
        markScheduleFailed(row.user_id, 'Live terjadwal tidak dimulai karena saat itu sudah ada live lain yang berjalan.');
        continue;
      }

      const result = startStream(row.user_id, row.video_id, row.stream_key, row.stream_url);
      if (!result.success) {
        markScheduleFailed(row.user_id, `Live terjadwal gagal dimulai: ${result.message}`);
        continue;
      }

      console.log(`[Jadwal] Live user ${row.user_id} dimulai otomatis.`);
      if (stopAt !== null) markScheduleStarted(row.user_id);
      else deleteSchedule(row.user_id);
      continue;
    }

    // Live sudah berjalan, menunggu berhenti otomatis.
    if (!live) {
      // Live sudah berhenti lewat cara lain (manual, admin, masa sewa, gagal reconnect).
      deleteSchedule(row.user_id);
      continue;
    }
    if (stopAt !== null && stopAt <= now) {
      console.log(`[Jadwal] Live user ${row.user_id} dihentikan otomatis.`);
      stopStream(row.user_id, 'scheduled');
      deleteSchedule(row.user_id);
    }
  }
}

/**
 * Validasi waktu jadwal dari request (string ISO atau kosong).
 * `expiresAt` = batas masa sewa akun, jadwal mulai tidak boleh melewatinya.
 */
export function parseScheduleInput(
  input: { startAt?: unknown; stopAt?: unknown },
  expiresAt: string | null | undefined,
  now = Date.now()
): { ok: true; startAt: string | null; stopAt: string | null } | { ok: false; error: string } {
  const read = (value: unknown, label: string): { ok: true; time: number | null } | { ok: false; error: string } => {
    if (value === undefined || value === null || value === '') return { ok: true, time: null };
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
      return { ok: false, error: `Waktu ${label} tidak valid` };
    }
    return { ok: true, time: Date.parse(value) };
  };

  const start = read(input.startAt, 'mulai');
  if (!start.ok) return start;
  const stop = read(input.stopAt, 'berhenti');
  if (!stop.ok) return stop;

  if (start.time !== null && start.time < now - CLOCK_SKEW_MS) {
    return { ok: false, error: 'Waktu mulai sudah lewat. Pilih waktu di masa depan.' };
  }

  const effectiveStart = start.time ?? now;
  if (stop.time !== null && stop.time < effectiveStart + MIN_DURATION_MS) {
    return {
      ok: false,
      error: start.time !== null
        ? 'Waktu berhenti harus minimal 1 menit setelah waktu mulai.'
        : 'Waktu berhenti harus minimal 1 menit dari sekarang.',
    };
  }

  if (start.time !== null && expiresAt && start.time >= Date.parse(expiresAt)) {
    return { ok: false, error: `Waktu mulai melewati masa sewa akun (berakhir ${formatExpiryForMessage(expiresAt)}).` };
  }

  return {
    ok: true,
    startAt: start.time !== null ? new Date(start.time).toISOString() : null,
    stopAt: stop.time !== null ? new Date(stop.time).toISOString() : null,
  };
}

export interface ScheduleInfo {
  videoId: string;
  videoName: string;
  startAt: string | null;
  stopAt: string | null;
  error: string | null;
}

/** Jadwal milik akun untuk ditampilkan (tanpa stream key). */
export function getScheduleInfo(userId: number): ScheduleInfo | null {
  const row = getSchedule(userId);
  if (!row) return null;
  return {
    videoId: row.video_id,
    videoName: findFileById(userId, row.video_id)?.name ?? row.video_id,
    startAt: row.start_at,
    stopAt: row.stop_at,
    error: row.last_error,
  };
}
