import fs from 'fs';
import path from 'path';
import type { SubtitleEntry, ASSSubtitleEntry } from '@/types';

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(process.cwd(), 'media');

export function parseSrt(filePath: string): SubtitleEntry[] {
  const fullPath = path.join(MEDIA_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const entries: SubtitleEntry[] = [];

  const blocks = content.trim().split(/\n\n|\r\n\r\n/);

  for (const block of blocks) {
    const lines = block.trim().split(/\n|\r\n/);
    if (lines.length >= 3) {
      const index = parseInt(lines[0]);
      const [startTime, endTime] = lines[1].split(' --> ');
      const text = lines.slice(2).join('\n');

      entries.push({
        index,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        text: text.trim(),
      });
    }
  }

  return entries;
}

export function parseAss(filePath: string): ASSSubtitleEntry[] {
  const fullPath = path.join(MEDIA_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const entries: ASSSubtitleEntry[] = [];

  const lines = content.split(/\n|\r\n/);
  let inEvents = false;

  for (const line of lines) {
    if (line.trim() === '[Events]') {
      inEvents = true;
      continue;
    }

    if (line.trim().startsWith('[') && inEvents) {
      break;
    }

    if (inEvents && line.startsWith('Dialogue:')) {
      const parts = line.substring(9).split(',');
      if (parts.length >= 10) {
        const layer = parseInt(parts[0]);
        const start = parts[1].trim();
        const end = parts[2].trim();
        const style = parts[3].trim();
        const text = parts.slice(9).join(',').replace(/\\N/g, '\n').replace(/\\n/g, '\n');

        entries.push({
          index: entries.length + 1,
          layer,
          start,
          end,
          style,
          text,
        });
      }
    }
  }

  return entries;
}

export function parseVtt(filePath: string): SubtitleEntry[] {
  const fullPath = path.join(MEDIA_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const entries: SubtitleEntry[] = [];

  const blocks = content.trim().split(/\n\n|\r\n\r\n/);

  for (const block of blocks) {
    const lines = block.trim().split(/\n|\r\n/);

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        const [startTime, endTime] = lines[i].split('-->');
        const text = lines.slice(i + 1).join('\n');

        if (text.trim()) {
          entries.push({
            index: entries.length + 1,
            startTime: startTime.trim(),
            endTime: endTime.trim(),
            text: text.trim(),
          });
        }
        break;
      }
    }
  }

  return entries;
}

export function parseSubtitle(filePath: string, format: 'srt' | 'ass' | 'vtt'): SubtitleEntry[] | ASSSubtitleEntry[] {
  switch (format) {
    case 'srt':
      return parseSrt(filePath);
    case 'ass':
      return parseAss(filePath);
    case 'vtt':
      return parseVtt(filePath);
    default:
      return [];
  }
}

export function convertTimeToSeconds(time: string): number {
  // Handle both HH:MM:SS,mmm and HH:MM:SS.mmm formats
  const cleaned = time.replace(',', '.');
  const parts = cleaned.split(':');

  if (parts.length === 3) {
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  return 0;
}

export function formatSecondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
