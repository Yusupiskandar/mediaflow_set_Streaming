'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaFile } from '@/types';
import PageHeader from '@/components/ui/PageHeader';
import PasswordInput from '@/components/ui/PasswordInput';

interface StreamStatus {
  isStreaming: boolean;
  streams: Array<{
    videoId: string;
    videoName: string;
    startedAt: string;
    streamKey: string;
    isReconnecting?: boolean;
    reconnectAttempts?: number;
  }>;
  stopReason?: 'admin' | 'expired' | null;
}

async function loadStreamStatus(): Promise<StreamStatus | 'unauthorized' | null> {
  const res = await fetch('/api/stream/status');
  // 401 = sesi berakhir atau masa sewa akun habis.
  if (res.status === 401) return 'unauthorized';
  return res.ok ? res.json() : null;
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
  const isStreamingRef = useRef(false);

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

  const applyStatus = useCallback((data: StreamStatus) => {
    // Dibaca dari ref, bukan state, supaya nilai yang dipakai di interval tidak basi.
    const wasStreaming = isStreamingRef.current;
    isStreamingRef.current = data.isStreaming;
    setStatus(data);

    if (data.stopReason === 'admin') {
      setSuccess('');
      setError('Live Anda dihentikan oleh admin.');
    } else if (data.stopReason === 'expired') {
      setSuccess('');
      setError('Live Anda dihentikan karena masa sewa akun sudah habis.');
    }

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
  }, [startTimer, stopTimer]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await loadStreamStatus();
      if (data === 'unauthorized') {
        router.push('/login');
        return;
      }
      if (data) applyStatus(data);
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  }, [applyStatus, router]);

  useEffect(() => {
    let active = true;

    fetch('/api/files')
      .then(async (res) => {
        if (!active) return;
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (active) setFiles(data.files || []);
      })
      .catch((err) => console.error('Error fetching files:', err))
      .finally(() => {
        if (active) setFetchingFiles(false);
      });

    loadStreamStatus()
      .then((data) => {
        if (!active) return;
        if (data === 'unauthorized') {
          router.push('/login');
          return;
        }
        if (data) applyStatus(data);
      })
      .catch((err) => console.error('Error fetching status:', err));

    const statusInterval = setInterval(fetchStatus, 3000);
    return () => {
      active = false;
      clearInterval(statusInterval);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [router, applyStatus, fetchStatus]);

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

  const isAnyReconnecting = status.streams.some(s => s.isReconnecting);
  const canStart = Boolean(selectedVideo && streamUrl.trim() && streamKey.trim());

  return (
    <>
      <PageHeader
        eyebrow="Live Stream"
        title="Siaran 24 Jam"
        description="Pilih video, masukkan stream key, dan video diputar ulang terus-menerus."
      />

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        {/* Form Stream */}
        <div className="card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Pengaturan Live</h2>

          <div className="space-y-5">
            {/* Pilih Video */}
            <div>
              <label className="label">Pilih video</label>
              {fetchingFiles ? (
                <div className="input text-slate-400">Memuat daftar video...</div>
              ) : (
                <select
                  value={selectedVideo}
                  onChange={(e) => setSelectedVideo(e.target.value)}
                  disabled={status.isStreaming || loading}
                  className="input"
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
              <div>
                <label className="label">Preview</label>
                <div className="bg-black rounded-2xl overflow-hidden">
                  <video
                    key={selectedVideo}
                    src={`/api/files/${selectedVideo}/stream`}
                    controls
                    className="w-full aspect-video"
                  >
                    Browser Anda tidak mendukung video playback.
                  </video>
                </div>
                <p className="hint">Preview sebelum live stream dimulai</p>
              </div>
            )}

            {/* Stream URL */}
            <div>
              <label className="label">Stream URL</label>
              <input
                type="text"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                disabled={status.isStreaming || loading}
                placeholder="rtmp://a.rtmp.youtube.com/live2"
                className="input font-mono text-sm"
              />
              <p className="hint">Default: YouTube. Ubah untuk platform lain (Twitch, Facebook, dll).</p>
            </div>

            {/* Stream Key */}
            <div>
              <label className="label">Stream key</label>
              <PasswordInput
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                disabled={status.isStreaming || loading}
                placeholder="Masukkan stream key"
                className="font-mono text-sm"
              />
              <p className="hint">Dapatkan dari dashboard streaming platform.</p>
            </div>

            {/* Error/Success Messages */}
            {error && <div className="alert-error">{error}</div>}
            {success && <div className="alert-success">{success}</div>}

            {/* Validation Hints */}
            {!status.isStreaming && !canStart && (
              <div className="alert-warning">
                <p className="font-semibold mb-1">Yang perlu dilengkapi:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {!selectedVideo && <li>Pilih video dari daftar</li>}
                  {!streamUrl.trim() && <li>Masukkan Stream URL</li>}
                  {!streamKey.trim() && <li>Masukkan Stream Key</li>}
                </ul>
              </div>
            )}

            {/* Buttons */}
            {!status.isStreaming ? (
              <button
                onClick={handleStartStream}
                disabled={loading || !canStart}
                title={!selectedVideo ? 'Pilih video terlebih dahulu' : !streamUrl.trim() ? 'Masukkan Stream URL' : !streamKey.trim() ? 'Masukkan Stream Key' : ''}
                className="btn-live w-full py-3.5 text-base"
              >
                {loading ? (
                  <><span className="spinner" /> Memulai...</>
                ) : (
                  <><span className="w-2.5 h-2.5 bg-white rounded-full" /> Mulai Live Stream</>
                )}
              </button>
            ) : (
              <button
                onClick={handleStopStream}
                disabled={loading}
                className="btn-dark w-full py-3.5 text-base"
              >
                {loading ? (
                  <><span className="spinner" /> Menghentikan...</>
                ) : (
                  <><span className="w-2.5 h-2.5 bg-white rounded-sm" /> Stop Stream</>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Status: panel gelap bergaya banner landing page */}
          <div className="panel-dark p-6 sm:p-8">
            <span className="pointer-events-none absolute -top-10 left-[40%] w-14 h-[160%] rotate-[35deg] bg-gradient-to-b from-transparent via-blue-200/15 to-transparent blur-xl" aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm font-bold text-amber-50">Status Siaran</span>
                {!status.isStreaming ? (
                  <span className="badge bg-white/10 text-slate-300">Offline</span>
                ) : isAnyReconnecting ? (
                  <span className="badge bg-amber-400 text-amber-950">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-950 animate-ping" /> Menyambung ulang
                  </span>
                ) : (
                  <span className="badge bg-red-500 text-white">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 mb-1">Durasi live</p>
              <p className={`font-mono text-4xl font-bold mb-6 ${status.isStreaming ? 'text-amber-50' : 'text-slate-600'}`}>
                {formatDuration(streamDuration)}
              </p>

              {status.isStreaming ? (
                status.streams.map((stream, idx) => (
                  <dl key={idx} className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Video</dt><dd className="text-white font-medium truncate" title={stream.videoName}>{stream.videoName}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Mulai</dt><dd className="text-white">{new Date(stream.startedAt).toLocaleString('id-ID')}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Stream key</dt><dd className="text-white font-mono">{stream.streamKey}</dd></div>
                    {stream.isReconnecting && (
                      <p className="pt-2 text-amber-300 font-semibold">
                        Koneksi terputus, mencoba menyambung ulang ({stream.reconnectAttempts || 1}/10)
                      </p>
                    )}
                  </dl>
                ))
              ) : (
                <p className="text-sm text-slate-400">Belum ada siaran berjalan. Lengkapi pengaturan lalu klik Mulai Live Stream.</p>
              )}
            </div>
          </div>

          {/* Panduan */}
          <div className="card p-6">
            <p className="eyebrow mb-1">Panduan</p>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Cara Menggunakan</h3>
            <ol className="space-y-3">
              {[
                'Buka YouTube Studio → Settings → Stream, lalu salin Stream Key.',
                'Pilih video yang ingin disiarkan.',
                'Tempel Stream Key di formulir.',
                'Klik Mulai Live Stream. Video akan terus berputar (looping).',
                'Klik Stop Stream untuk menghentikan.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-600">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center shadow-md shadow-blue-600/30">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
