'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import VideoPlayer from '@/components/VideoPlayer';
import type { MediaFile, SubtitleFile } from '@/types';

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
    fetchFileData();
  }, [fileId]);

  const fetchFileData = async () => {
    try {
      const [filesRes, subtitlesRes, resumeRes] = await Promise.all([
        fetch('/api/files'),
        fetch(`/api/files/${fileId}/subtitles`),
        fetch(`/api/resume?fileId=${fileId}`),
      ]);

      if (filesRes.status === 401 || subtitlesRes.status === 401 || resumeRes.status === 401) {
        router.push('/login');
        return;
      }

      const filesData = await filesRes.json();
      const subtitlesData = await subtitlesRes.json();
      const resumeData = await resumeRes.json();

      const currentFile = filesData.files?.find((f: MediaFile) => f.id === fileId);

      if (!currentFile) {
        setError('File tidak ditemukan');
        return;
      }

      setFile(currentFile);
      setSubtitles(subtitlesData.subtitles || []);
      setResumePosition(resumeData.position || 0);
    } catch (err) {
      console.error('Error fetching file data:', err);
      setError('Gagal memuat data file');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error || 'File tidak ditemukan'}</p>
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
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Kembali
              </button>
              <h1 className="text-white font-medium truncate max-w-md">{file.name}</h1>
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
