import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { MediaFile, SubtitleFile, FolderItem } from '@/types';

const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || path.join(process.cwd(), 'data', 'media'));

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv'];
const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a'];
const SUBTITLE_EXTENSIONS = ['.srt', '.ass', '.vtt'];

export class InvalidPathError extends Error {
  constructor() {
    super('Path tidak valid');
    this.name = 'InvalidPathError';
  }
}

/** Folder induk semua media. Isinya `users/<userId>/`, satu folder per akun. */
export function getMediaDir(): string {
  return MEDIA_DIR;
}

/** Folder media milik satu akun. Setiap akun hanya bisa melihat isi foldernya sendiri. */
export function getUserMediaRoot(userId: number): string {
  if (!Number.isInteger(userId) || userId < 1) {
    throw new InvalidPathError();
  }
  return path.join(MEDIA_DIR, 'users', String(userId));
}

/**
 * Ubah path relatif dari user menjadi path absolut yang dijamin berada di dalam
 * folder media milik akun tersebut. Melempar InvalidPathError jika path keluar
 * dari folder itu (misalnya `../src`, `../2`, atau path absolut).
 */
export function resolveMediaPath(userId: number, relativePath: string = ''): string {
  const root = getUserMediaRoot(userId);
  const fullPath = path.resolve(root, relativePath);
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new InvalidPathError();
  }
  return fullPath;
}

/** Path relatif terhadap folder media akun, selalu memakai `/` di semua OS. */
export function toMediaRelative(userId: number, fullPath: string): string {
  return path.relative(getUserMediaRoot(userId), fullPath).split(path.sep).join('/');
}

/**
 * ID file dibuat dari pemilik + path relatif: tetap sama walaupun folder media
 * dipindah, dan file dengan nama sama milik akun lain mendapat ID berbeda.
 */
export function generateFileId(userId: number, relativePath: string): string {
  const normalized = relativePath.split(path.sep).join('/');
  return crypto.createHash('md5').update(`${userId}:${normalized}`).digest('hex');
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.flv': 'video/x-flv',
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.srt': 'text/plain',
    '.ass': 'text/plain',
    '.vtt': 'text/vtt',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

export function isMediaFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext) || AUDIO_EXTENSIONS.includes(ext);
}

export function isVideoFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

export function isAudioFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
}

export function isSubtitleFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUBTITLE_EXTENSIONS.includes(ext);
}

/** Folder internal (misalnya `.uploads`) tidak ditampilkan ke user. */
function isHidden(name: string): boolean {
  return name.startsWith('.');
}

function toMediaFile(userId: number, fullPath: string, name: string, size: number): MediaFile {
  const relativePath = toMediaRelative(userId, fullPath);
  return {
    id: generateFileId(userId, relativePath),
    name,
    path: relativePath,
    type: isVideoFile(name) ? 'video' : 'audio',
    size,
    extension: path.extname(name).toLowerCase(),
  };
}

export function getMediaFiles(userId: number, dirPath: string): MediaFile[] {
  const fullPath = resolveMediaPath(userId, dirPath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const files: MediaFile[] = [];

  for (const item of fs.readdirSync(fullPath)) {
    const itemPath = path.join(fullPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isFile() && isMediaFile(item)) {
      files.push(toMediaFile(userId, itemPath, item, stat.size));
    }
  }

  return files;
}

export function getSubtitlesForFile(userId: number, filePath: string): SubtitleFile[] {
  const dir = path.posix.dirname(filePath);
  const basename = path.basename(filePath, path.extname(filePath));
  const fullPath = resolveMediaPath(userId, dir);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const subtitles: SubtitleFile[] = [];

  for (const item of fs.readdirSync(fullPath)) {
    if (!isSubtitleFile(item)) continue;

    const itemBase = path.basename(item, path.extname(item));
    if (itemBase !== basename) continue;

    const ext = path.extname(item).toLowerCase();
    const format: SubtitleFile['format'] = ext === '.ass' ? 'ass' : ext === '.vtt' ? 'vtt' : 'srt';
    const relativePath = toMediaRelative(userId, path.join(fullPath, item));

    subtitles.push({
      id: generateFileId(userId, relativePath),
      name: item,
      path: relativePath,
      format,
    });
  }

  return subtitles;
}

export function getFolders(userId: number, dirPath: string): FolderItem[] {
  const fullPath = resolveMediaPath(userId, dirPath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const folders: FolderItem[] = [];

  for (const item of fs.readdirSync(fullPath)) {
    if (isHidden(item)) continue;

    const itemPath = path.join(fullPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      folders.push({
        name: item,
        path: toMediaRelative(userId, itemPath),
        isDirectory: true,
      });
    }
  }

  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

function getAllMediaFiles(userId: number): MediaFile[] {
  const allFiles: MediaFile[] = [];
  traverseDirectory(userId, getUserMediaRoot(userId), allFiles);
  return allFiles;
}

function traverseDirectory(userId: number, dirPath: string, files: MediaFile[]) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  for (const item of fs.readdirSync(dirPath)) {
    if (isHidden(item)) continue;

    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      traverseDirectory(userId, itemPath, files);
    } else if (stat.isFile() && isMediaFile(item)) {
      files.push(toMediaFile(userId, itemPath, item, stat.size));
    }
  }
}

/** Cari file milik akun ini saja. File akun lain tidak akan pernah ditemukan. */
export function findFileById(userId: number, fileId: string): MediaFile | null {
  return getAllMediaFiles(userId).find(f => f.id === fileId) || null;
}

/** Path absolut file milik akun ini di disk. */
export function getAbsoluteFilePath(userId: number, file: MediaFile): string {
  return resolveMediaPath(userId, file.path);
}

export function ensureUserMediaDir(userId: number) {
  fs.mkdirSync(getUserMediaRoot(userId), { recursive: true });
}
