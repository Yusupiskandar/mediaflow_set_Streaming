import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { MediaFile, SubtitleFile, FolderItem } from '@/types';

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), 'media');

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.webm', '.mov', '.flv'];
const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a'];
const SUBTITLE_EXTENSIONS = ['.srt', '.ass', '.vtt'];

export function getMediaDir(): string {
  return MEDIA_DIR;
}

export function generateFileId(filePath: string): string {
  return crypto.createHash('md5').update(filePath).digest('hex');
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

export function getMediaFiles(dirPath: string): MediaFile[] {
  const fullPath = path.join(MEDIA_DIR, dirPath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const items = fs.readdirSync(fullPath);
  const files: MediaFile[] = [];

  for (const item of items) {
    const itemPath = path.join(fullPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isFile() && isMediaFile(item)) {
      const ext = path.extname(item).toLowerCase();
      files.push({
        id: generateFileId(itemPath),
        name: item,
        path: path.relative(MEDIA_DIR, itemPath),
        type: isVideoFile(item) ? 'video' : 'audio',
        size: stat.size,
        extension: ext,
      });
    }
  }

  return files;
}

export function getSubtitlesForFile(filePath: string): SubtitleFile[] {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath, path.extname(filePath));
  const fullPath = path.join(MEDIA_DIR, dir);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const items = fs.readdirSync(fullPath);
  const subtitles: SubtitleFile[] = [];

  for (const item of items) {
    if (isSubtitleFile(item)) {
      const itemBase = path.basename(item, path.extname(item));
      if (itemBase === basename) {
        const ext = path.extname(item).toLowerCase();
        const format: SubtitleFile['format'] = ext === '.ass' ? 'ass' : ext === '.vtt' ? 'vtt' : 'srt';
        subtitles.push({
          id: generateFileId(path.join(dir, item)),
          name: item,
          path: path.relative(MEDIA_DIR, path.join(dir, item)),
          format,
        });
      }
    }
  }

  return subtitles;
}

export function getFolders(dirPath: string): FolderItem[] {
  const fullPath = path.join(MEDIA_DIR, dirPath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const items = fs.readdirSync(fullPath);
  const folders: FolderItem[] = [];

  for (const item of items) {
    const itemPath = path.join(fullPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      folders.push({
        name: item,
        path: path.relative(MEDIA_DIR, itemPath),
        isDirectory: true,
      });
    }
  }

  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

export function getFilePath(fileId: string, allFiles?: MediaFile[]): string | null {
  if (!allFiles) {
    allFiles = getAllMediaFiles();
  }
  const file = allFiles.find(f => f.id === fileId);
  return file ? path.join(MEDIA_DIR, file.path) : null;
}

function getAllMediaFiles(): MediaFile[] {
  const allFiles: MediaFile[] = [];
  traverseDirectory(MEDIA_DIR, '', allFiles);
  return allFiles;
}

function traverseDirectory(basePath: string, relativePath: string, files: MediaFile[]) {
  const fullPath = path.join(basePath, relativePath);

  if (!fs.existsSync(fullPath)) {
    return;
  }

  const items = fs.readdirSync(fullPath);

  for (const item of items) {
    const itemPath = path.join(fullPath, item);
    const stat = fs.statSync(itemPath);
    const itemRelative = path.relative(basePath, itemPath);

    if (stat.isDirectory()) {
      traverseDirectory(basePath, itemRelative, files);
    } else if (stat.isFile() && isMediaFile(item)) {
      const ext = path.extname(item).toLowerCase();
      files.push({
        id: generateFileId(itemPath),
        name: item,
        path: itemRelative,
        type: isVideoFile(item) ? 'video' : 'audio',
        size: stat.size,
        extension: ext,
      });
    }
  }
}

export function findFileById(fileId: string): MediaFile | null {
  const allFiles = getAllMediaFiles();
  return allFiles.find(f => f.id === fileId) || null;
}

export function ensureMediaDir() {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
}
