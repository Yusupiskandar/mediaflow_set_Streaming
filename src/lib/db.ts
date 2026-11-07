import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'mediaflow.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDb(db);
  }
  return db;
}

function initializeDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS playback_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      file_id TEXT NOT NULL,
      position_seconds REAL NOT NULL,
      duration_seconds REAL NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, file_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS upload_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      total_size INTEGER NOT NULL,
      uploaded_chunks INTEGER DEFAULT 0,
      total_chunks INTEGER NOT NULL,
      status TEXT DEFAULT 'in_progress',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Jadwal live otomatis, satu per akun (satu akun hanya bisa satu live).
    -- start_at terisi = menunggu dimulai; start_at NULL + stop_at terisi = live berjalan, berhenti otomatis.
    -- last_error terisi = jadwal gagal, disimpan agar pesannya bisa ditampilkan ke user.
    CREATE TABLE IF NOT EXISTS stream_schedules (
      user_id INTEGER PRIMARY KEY,
      video_id TEXT NOT NULL,
      stream_url TEXT NOT NULL,
      stream_key TEXT NOT NULL,
      start_at TEXT,
      stop_at TEXT,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  migrateDb(db);
}

/** Tambahan kolom untuk database yang dibuat versi lama. */
function migrateDb(db: Database.Database) {
  const userColumns = (db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);

  // Masa sewa akun: waktu ISO (UTC). NULL = tanpa batas.
  if (!userColumns.includes('expires_at')) {
    db.exec('ALTER TABLE users ADD COLUMN expires_at TEXT');
  }

  // Waktu sandi terakhir diganti (ISO UTC). Token login yang dibuat sebelum waktu ini ditolak.
  if (!userColumns.includes('password_changed_at')) {
    db.exec('ALTER TABLE users ADD COLUMN password_changed_at TEXT');
  }
}

export interface UserRecord {
  id: number;
  username: string;
  created_at: string;
  expires_at: string | null;
  /** Hanya diisi oleh getUserById (dipakai untuk mengecek token login). */
  password_changed_at?: string | null;
}

export function getUserByUsername(username: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserCount(): number {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return result.count;
}

export function getAllUsers(): UserRecord[] {
  const db = getDb();
  return db.prepare('SELECT id, username, created_at, expires_at FROM users ORDER BY id ASC').all() as UserRecord[];
}

export function getUserById(id: number): UserRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT id, username, created_at, expires_at, password_changed_at FROM users WHERE id = ?').get(id) as
    | UserRecord
    | undefined;
}

/** Atur masa sewa akun. `null` = tanpa batas. */
export function setUserExpiry(id: number, expiresAt: string | null) {
  const db = getDb();
  db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(expiresAt, id);
}

export function getPasswordHashById(id: number): string | undefined {
  const db = getDb();
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id) as { password_hash: string } | undefined;
  return row?.password_hash;
}

/**
 * Ganti sandi dan catat waktunya. Semua token login lama milik user ini otomatis
 * tidak berlaku lagi (lihat getCurrentUser di lib/auth.ts).
 */
export function setUserPassword(id: number, passwordHash: string) {
  const db = getDb();
  db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ? WHERE id = ?').run(
    passwordHash,
    new Date().toISOString(),
    id
  );
}

export function deleteUser(id: number) {
  const db = getDb();
  // Database lama dibuat tanpa ON DELETE CASCADE, jadi data terkait dihapus manual.
  db.transaction(() => {
    db.prepare('DELETE FROM playback_progress WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM stream_schedules WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  })();
}

export function createUser(username: string, passwordHash: string, expiresAt: string | null = null) {
  const db = getDb();
  const result = db
    .prepare('INSERT INTO users (username, password_hash, expires_at) VALUES (?, ?, ?)')
    .run(username, passwordHash, expiresAt);
  return result.lastInsertRowid;
}

export function getResumePosition(userId: number, fileId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM playback_progress WHERE user_id = ? AND file_id = ?').get(userId, fileId);
}

export function saveResumePosition(userId: number, fileId: string, position: number, duration: number) {
  const db = getDb();
  db.prepare(`
    INSERT INTO playback_progress (user_id, file_id, position_seconds, duration_seconds)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, file_id) DO UPDATE SET
      position_seconds = excluded.position_seconds,
      duration_seconds = excluded.duration_seconds,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, fileId, position, duration);
}

export function createUploadSession(fileId: string, filename: string, totalSize: number, totalChunks: number) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO upload_sessions (file_id, filename, total_size, total_chunks)
    VALUES (?, ?, ?, ?)
  `).run(fileId, filename, totalSize, totalChunks);
  return result.lastInsertRowid;
}

export function updateUploadProgress(fileId: string, uploadedChunks: number) {
  const db = getDb();
  db.prepare('UPDATE upload_sessions SET uploaded_chunks = ? WHERE file_id = ? AND status = ?')
    .run(uploadedChunks, fileId, 'in_progress');
}

export function completeUpload(fileId: string) {
  const db = getDb();
  db.prepare('UPDATE upload_sessions SET status = ? WHERE file_id = ?')
    .run('completed', fileId);
}

export function getUploadSession(fileId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM upload_sessions WHERE file_id = ? AND status = ?').get(fileId, 'in_progress');
}

export interface StreamScheduleRecord {
  user_id: number;
  video_id: string;
  stream_url: string;
  /** Disimpan utuh karena server butuh stream key untuk memulai live saat jadwal tiba. */
  stream_key: string;
  start_at: string | null;
  stop_at: string | null;
  last_error: string | null;
}

export function getSchedule(userId: number): StreamScheduleRecord | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM stream_schedules WHERE user_id = ?').get(userId) as StreamScheduleRecord | undefined;
}

export function getAllSchedules(): StreamScheduleRecord[] {
  const db = getDb();
  return db.prepare('SELECT * FROM stream_schedules').all() as StreamScheduleRecord[];
}

/** Simpan jadwal baru, menggantikan jadwal lama milik akun yang sama. */
export function saveSchedule(schedule: Omit<StreamScheduleRecord, 'last_error'>) {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO stream_schedules (user_id, video_id, stream_url, stream_key, start_at, stop_at, last_error)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`
  ).run(schedule.user_id, schedule.video_id, schedule.stream_url, schedule.stream_key, schedule.start_at, schedule.stop_at);
}

/** Live dari jadwal sudah dimulai: sisa jadwal tinggal berhenti otomatis. */
export function markScheduleStarted(userId: number) {
  const db = getDb();
  db.prepare('UPDATE stream_schedules SET start_at = NULL WHERE user_id = ?').run(userId);
}

export function markScheduleFailed(userId: number, error: string) {
  const db = getDb();
  db.prepare('UPDATE stream_schedules SET start_at = NULL, stop_at = NULL, last_error = ? WHERE user_id = ?').run(error, userId);
}

export function deleteSchedule(userId: number) {
  const db = getDb();
  db.prepare('DELETE FROM stream_schedules WHERE user_id = ?').run(userId);
}

/** Hapus posisi terakhir menonton untuk satu file (dipakai saat file dihapus). */
export function deleteResumePosition(userId: number, fileId: string) {
  const db = getDb();
  db.prepare('DELETE FROM playback_progress WHERE user_id = ? AND file_id = ?').run(userId, fileId);
}
