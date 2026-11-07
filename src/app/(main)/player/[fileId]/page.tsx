'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import VideoPlayer from '@/components/player/VideoPlayer';
import PageHeader from '@/components/ui/PageHeader';
import Icon, { ICONS } from '@/components/ui/Icon';
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
      <div className="py-24 flex justify-center text-blue-600">
        <span className="spinner w-10 h-10" />
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <p className="eyebrow mb-2">Pemutar</p>
        <h1 className="text-2xl font-bold text-slate-800 mb-6">{error || 'File tidak ditemukan'}</h1>
        <button onClick={handleBack} className="btn-primary">
          <Icon d={ICONS.back} className="w-4 h-4" />
          Kembali ke Media
        </button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={file.type === 'video' ? 'Pemutar Video' : 'Pemutar Audio'}
        title={<span title={file.name}>{file.name}</span>}
        actions={
          <button onClick={handleBack} className="btn-secondary">
            <Icon d={ICONS.back} className="w-4 h-4" />
            Kembali
          </button>
        }
      />
      <VideoPlayer
        fileId={fileId}
        fileName={file.name}
        fileType={file.type}
        initialPosition={resumePosition}
        subtitles={subtitles}
      />
    </>
  );
}
