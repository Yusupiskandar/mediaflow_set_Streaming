export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface MediaFile {
  id: string;
  name: string;
  path: string;
  type: 'video' | 'audio';
  size: number;
  extension: string;
  duration?: number;
  thumbnails?: string;
}

export interface SubtitleFile {
  id: string;
  name: string;
  path: string;
  format: 'srt' | 'ass' | 'vtt';
  entries?: SubtitleEntry[] | ASSSubtitleEntry[];
}

export interface PlaybackProgress {
  id: number;
  user_id: number;
  file_id: string;
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
}

export interface UploadSession {
  id: number;
  file_id: string;
  filename: string;
  total_size: number;
  uploaded_chunks: number;
  total_chunks: number;
  status: 'in_progress' | 'completed' | 'failed';
  created_at: string;
}

export interface FolderItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface AuthPayload {
  userId: number;
  username: string;
}

export interface SubtitleEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

export interface ASSSubtitleEntry {
  index: number;
  layer: number;
  start: string;
  end: string;
  style: string;
  text: string;
}
