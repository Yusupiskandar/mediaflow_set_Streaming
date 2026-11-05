'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import VideoPlayer from '@/components/player/VideoPlayer';
import type { MediaFile, SubtitleFile } from '@/types';

type PlayerData =
  | { status: 'unauthorized' }
  | { status: 'not-found' }
  | { status: 'ok'; file: MediaFile; subtitles: SubtitleFile[]; position: number };

async function loadPlayerData(fileId: string): Promise<PlayerData> {
  const [fileRes, subtitlesRes, resumeRes] = await Promise.all([
    fetch(`/api/files/${fileId}`),
    fetch(`/api/files/${fileId}/subtitles`),
    fetch(`/api/resume?fileId=${fileId}`),
  ]);

  if (fileRes.status === 401 || subtitlesRes.status === 401 || resumeRes.status === 401) {
    return { status: 'unauthorized' };
  }
  if (!fileRes.ok) {
    return { status: 'not-found' };
  }

  const fileData = await fileRes.json();
  const subtitlesData = subtitlesRes.ok ? await subtitlesRes.json() : {};
  const resumeData = resumeRes.ok ? await resumeRes.json() : {};

  return {
    status: 'ok',
    file: fileData.file,
    subtitles: subtitlesData.subtitles || [],
    position: resumeData.position || 0,
  };
}

export default function PlayerPage() {
  const router = useRouter();
  const params = useParams();
  const fileId = params.fileId as string;

  const [file, setFile] = useState<MediaFile | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleFile[]>([]);
  const [resumePosition, setResumePosition] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    loadPlayerData(fileId)
      .then((result) => {
        if (!active) return;
        if (result.status === 'unauthorized') {
          router.push('/login');
          return;
        }
        if (result.status === 'not-found') {
          setError('File tidak ditemukan');
          return;
        }
        setFile(result.file);
        setSubtitles(result.subtitles);
        setResumePosition(result.position);
      })
      .catch((err) => {
        console.error('Error fetching file data:', err);
        if (active) setError('Gagal memuat data file');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fileId, router]);

  const handleBack = () => {
    if (file?.path) {
      const dir = file.path.split('/').slice(0, -1).join('/');
      router.push(`/browse?dir=${encodeURIComponent(dir)}`);
    } else {
      router.push('/browse');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-xl mb-4">{error || 'File tidak ditemukan'}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="text-gray-500 hover:text-gray-900 transition-colors"
              >
                ← Kembali
              </button>
              <h1 className="text-gray-900 font-medium truncate max-w-md">{file.name}</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <VideoPlayer
          fileId={fileId}
          fileName={file.name}
          fileType={file.type}
          initialPosition={resumePosition}
          subtitles={subtitles}
        />
      </main>
    </div>
  );
}
