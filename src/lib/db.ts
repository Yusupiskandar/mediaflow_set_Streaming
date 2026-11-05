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
}

export interface UserRecord {
  id: number;
  username: string;
  created_at: string;
  expires_at: string | null;
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
  return db.prepare('SELECT id, username, created_at, expires_at FROM users WHERE id = ?').get(id) as
    | UserRecord
    | undefined;
}

/** Atur masa sewa akun. `null` = tanpa batas. */
export function setUserExpiry(id: number, expiresAt: string | null) {
  const db = getDb();
  db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(expiresAt, id);
}

export function deleteUser(id: number) {
  const db = getDb();
  // Database lama dibuat tanpa ON DELETE CASCADE, jadi data terkait dihapus manual.
  db.transaction(() => {
    db.prepare('DELETE FROM playback_progress WHERE user_id = ?').run(id);
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
