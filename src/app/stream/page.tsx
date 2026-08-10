'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaFile } from '@/types';

interface StreamStatus {
  isStreaming: boolean;
  streams: Array<{
    videoId: string;
    videoName: string;
    startedAt: string;
    streamKey: string;
  }>;
}

export default function StreamPage() {
  const router = useRouter();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [streamUrl, setStreamUrl] = useState('rtmp://a.rtmp.youtube.com/live2');
  const [streamKey, setStreamKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StreamStatus>({ isStreaming: false, streams: [] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fetchingFiles, setFetchingFiles] = useState(true);
  const [streamDuration, setStreamDuration] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  const formatDuration = useCallback((seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  const startTimer = useCallback((startedAt: string) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    startTimeRef.current = new Date(startedAt);
    const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
    setStreamDuration(elapsed);

    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
        setStreamDuration(elapsed);
      }
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    setStreamDuration(0);
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchStatus();

    const statusInterval = setInterval(fetchStatus, 3000);
    return () => {
      clearInterval(statusInterval);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/files');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error('Error fetching files:', err);
    } finally {
      setFetchingFiles(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/stream/status');
      if (res.ok) {
        const data = await res.json();
        const wasStreaming = status.isStreaming;
        setStatus(data);

        // Start timer jika streaming baru dimulai
        if (data.isStreaming && data.streams.length > 0 && !wasStreaming) {
          startTimer(data.streams[0].startedAt);
        }
        // Stop timer jika streaming berhenti
        else if (!data.isStreaming && wasStreaming) {
          stopTimer();
        }
        // Update timer jika streaming berlangsung
        else if (data.isStreaming && data.streams.length > 0) {
          const currentDuration = Math.floor((Date.now() - new Date(data.streams[0].startedAt).getTime()) / 1000);
          setStreamDuration(currentDuration);
        }
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const handleStartStream = async () => {
    if (!selectedVideo) {
      setError('Pilih video terlebih dahulu');
      return;
    }

    if (!streamUrl.trim()) {
      setError('Masukkan Stream URL');
      return;
    }

    if (!streamKey.trim()) {
      setError('Masukkan Stream Key');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/stream/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: selectedVideo,
          streamUrl: streamUrl.trim(),
          streamKey: streamKey.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memulai stream');
      }

      setSuccess(data.message);
      // Langsung check status setelah stream dimulai
      await fetchStatus();
      // Check lagi setelah 1 detik untuk memastikan
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memulai stream');
    } finally {
      setLoading(false);
    }
  };

  const handleStopStream = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/stream/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghentikan stream');
      }

      setSuccess(data.message);
      stopTimer();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghentikan stream');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/browse')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Kembali
              </button>
              <h1 className="text-xl font-bold text-white">Live Streaming ke YouTube</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Stream */}
        {status.isStreaming && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-green-300 font-medium">LIVE - Sedang Streaming</span>
              </div>
              <div className="flex items-center space-x-2 bg-green-800/50 px-3 py-1 rounded">
                <span className="text-green-200 text-sm">Durasi:</span>
                <span className="text-white font-mono font-bold text-lg">{formatDuration(streamDuration)}</span>
              </div>
            </div>
            {status.streams.map((stream, idx) => (
              <div key={idx} className="mt-3 text-sm text-green-200">
                <p>Video: {stream.videoName}</p>
                <p>Mulai: {new Date(stream.startedAt).toLocaleString('id-ID')}</p>
                <p>Stream Key: {stream.streamKey}</p>
              </div>
            ))}
          </div>
        )}

        {/* Form Stream */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">Mulai Live Streaming</h2>

          {/* Pilih Video */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pilih Video
            </label>
            {fetchingFiles ? (
              <div className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400">
                Memuat daftar video...
              </div>
            ) : (
              <select
                value={selectedVideo}
                onChange={(e) => setSelectedVideo(e.target.value)}
                disabled={status.isStreaming || loading}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">-- Pilih Video --</option>
                {files.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name} ({file.type === 'video' ? 'Video' : 'Audio'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Video Preview */}
          {selectedVideo && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preview Video
              </label>
              <div className="bg-black rounded-lg overflow-hidden">
                <video
                  key={selectedVideo}
                  src={`/api/files/${selectedVideo}/stream`}
                  controls
                  className="w-full aspect-video"
                >
                  Browser Anda tidak mendukung video playback.
                </video>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Preview sebelum live stream dimulai
              </p>
            </div>
          )}

          {/* Stream URL */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stream URL
            </label>
            <input
              type="text"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              disabled={status.isStreaming || loading}
              placeholder="rtmp://a.rtmp.youtube.com/live2"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Default: YouTube. Ubah untuk platform lain (Twitch, Facebook, dll)
            </p>
          </div>

          {/* Stream Key */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stream Key
            </label>
            <input
              type="password"
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              disabled={status.isStreaming || loading}
              placeholder="Masukkan stream key"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-500">
              Dapatkan dari dashboard streaming platform
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded-md text-green-300 text-sm">
              {success}
            </div>
          )}

          {/* Validation Hints */}
          {!status.isStreaming && (!selectedVideo || !streamUrl.trim() || !streamKey.trim()) && (
            <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-md text-yellow-300 text-sm">
              <p className="font-medium mb-1">Yang perlu dilengkapi:</p>
              <ul className="list-disc list-inside space-y-1">
                {!selectedVideo && <li>Pilih video dari dropdown</li>}
                {!streamUrl.trim() && <li>Masukkan Stream URL</li>}
                {!streamKey.trim() && <li>Masukkan Stream Key</li>}
              </ul>
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-4">
            {!status.isStreaming ? (
              <button
                onClick={handleStartStream}
                disabled={loading || !selectedVideo || !streamUrl.trim() || !streamKey.trim()}
                title={!selectedVideo ? 'Pilih video terlebih dahulu' : !streamUrl.trim() ? 'Masukkan Stream URL' : !streamKey.trim() ? 'Masukkan Stream Key' : ''}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white font-bold rounded-md transition-colors flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Memulai...</span>
                  </>
                ) : (
                  <>
                    <span className="w-3 h-3 bg-white rounded-full"></span>
                    <span>MULAI LIVE STREAM</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleStopStream}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-bold rounded-md transition-colors flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Menghentikan...</span>
                  </>
                ) : (
                  <>
                    <span className="w-3 h-3 bg-white rounded-sm"></span>
                    <span>STOP STREAM</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Cara Menggunakan:</h3>
          <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
            <li>Buka YouTube Studio → Settings → Stream</li>
            <li>Copy Stream Key</li>
            <li>Pilih video yang ingin di-stream</li>
            <li>Paste Stream Key di form above</li>
            <li>Klik &quot;MULAI LIVE STREAM&quot;</li>
            <li>Video akan terus berputar (looping) di YouTube</li>
            <li>Klik &quot;STOP STREAM&quot; untuk menghentikan</li>
          </ol>
        </div>

        {/* Info FFmpeg */}
        <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700/50 rounded-lg">
          <p className="text-blue-300 text-sm">
            <strong>Catatan:</strong> FFmpeg sudah included dalam project ini. Tidak perlu install FFmpeg secara manual di server.
          </p>
        </div>
      </main>
    </div>
  );
}
