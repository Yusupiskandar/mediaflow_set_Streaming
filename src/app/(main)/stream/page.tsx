'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaFile } from '@/types';
import PageHeader from '@/components/ui/PageHeader';
import PasswordInput from '@/components/ui/PasswordInput';
import Icon, { ICONS } from '@/components/ui/Icon';

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
  stopReason?: 'admin' | 'expired' | 'scheduled' | null;
  /** Jadwal live otomatis milik akun ini (null = tidak ada). */
  schedule?: ScheduleInfo | null;
}

interface ScheduleInfo {
  videoId: string;
  videoName: string;
  startAt: string | null;
  stopAt: string | null;
  /** Terisi jika jadwal gagal dijalankan. */
  error: string | null;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Nilai untuk <input type="datetime-local"> dalam zona waktu lokal browser. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "02:13:45" atau "3 hari 04:10:00" untuk hitung mundur. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const clock = [h, m, sec].map((n) => n.toString().padStart(2, '0')).join(':');
  return days > 0 ? `${days} hari ${clock}` : clock;
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

  // Jadwal otomatis (disembunyikan default). Nilai = datetime-local, kosong = tidak dipakai.
  const [showSchedule, setShowSchedule] = useState(false);
  const [startAt, setStartAt] = useState('');
  const [stopAt, setStopAt] = useState('');
  const [now, setNow] = useState(() => Date.now());

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
    } else if (data.stopReason === 'scheduled') {
      setError('');
      setSuccess('Live dihentikan otomatis sesuai jadwal.');
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

  const hasCountdown = Boolean(status.schedule && !status.schedule.error && (status.schedule.startAt || status.schedule.stopAt));
  useEffect(() => {
    if (!hasCountdown && !showSchedule) return;
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, [hasCountdown, showSchedule]);

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

    const startTime = startAt ? new Date(startAt).getTime() : null;
    const stopTime = stopAt ? new Date(stopAt).getTime() : null;
    if (startTime !== null && startTime <= Date.now()) {
      setError('Waktu mulai otomatis sudah lewat. Pilih waktu di masa depan.');
      return;
    }
    if (stopTime !== null && stopTime <= (startTime ?? Date.now())) {
      setError(startTime !== null ? 'Waktu berhenti harus setelah waktu mulai.' : 'Waktu berhenti harus di masa depan.');
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
          // Dikirim sebagai ISO supaya zona waktu browser ikut terhitung.
          startAt: startTime !== null ? new Date(startTime).toISOString() : undefined,
          stopAt: stopTime !== null ? new Date(stopTime).toISOString() : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memulai stream');
      }

      setSuccess(data.message);
      // Jadwal sudah tersimpan di server, kosongkan form jadwal.
      setStartAt('');
      setStopAt('');
      setShowSchedule(false);
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

  const handleCancelSchedule = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/stream/schedule', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok && res.status !== 404) throw new Error(data.error || 'Gagal membatalkan jadwal');
      if (status.schedule && !status.schedule.error) setSuccess('Jadwal live dibatalkan.');
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membatalkan jadwal');
    } finally {
      setLoading(false);
    }
  };

  const isAnyReconnecting = status.streams.some(s => s.isReconnecting);
  const canStart = Boolean(selectedVideo && streamUrl.trim() && streamKey.trim());
  const schedule = status.schedule ?? null;
  // Jadwal menunggu dimulai: form dikunci sampai jadwal jalan atau dibatalkan.
  const pendingSchedule = schedule && !schedule.error && schedule.startAt && !status.isStreaming ? schedule : null;
  const autoStopAt = status.isStreaming && schedule && !schedule.error ? schedule.stopAt : null;
  const formLocked = status.isStreaming || loading || Boolean(pendingSchedule);
  const minDateTime = toLocalInputValue(new Date(now));
  const scheduleSummary = [
    startAt && `Mulai ${formatDateTime(new Date(startAt).toISOString())}`,
    stopAt && `Berhenti ${formatDateTime(new Date(stopAt).toISOString())}`,
  ].filter(Boolean).join(' · ');

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
                  disabled={formLocked}
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
                disabled={formLocked}
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
                disabled={formLocked}
                placeholder="Masukkan stream key"
                className="font-mono text-sm"
              />
              <p className="hint">Dapatkan dari dashboard streaming platform.</p>
            </div>

            {/* Jadwal otomatis: disembunyikan default, dibuka lewat tombol panah */}
            {!status.isStreaming && !pendingSchedule && (
              <div className="rounded-2xl bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowSchedule((v) => !v)}
                  aria-expanded={showSchedule}
                  aria-controls="jadwal-otomatis"
                  className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Icon d={ICONS.clock} className="w-5 h-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-800">
                        Jadwal otomatis <span className="font-normal text-slate-400">(opsional)</span>
                      </span>
                      <span className="block text-xs text-slate-400 truncate">
                        {scheduleSummary || 'Atur jam mulai dan berhenti otomatis'}
                      </span>
                    </span>
                  </span>
                  <Icon
                    d={ICONS.chevron}
                    className={`w-5 h-5 shrink-0 text-slate-500 transition-transform duration-300 ${showSchedule ? 'rotate-90' : ''}`}
                  />
                </button>

                {showSchedule && (
                  <div id="jadwal-otomatis" className="px-4 pb-4 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="start-at" className="text-sm font-medium text-slate-700">Mulai otomatis</label>
                          {startAt && (
                            <button type="button" onClick={() => setStartAt('')} className="text-xs text-slate-400 hover:text-red-600">Hapus</button>
                          )}
                        </div>
                        <input
                          id="start-at"
                          type="datetime-local"
                          value={startAt}
                          min={minDateTime}
                          onChange={(e) => setStartAt(e.target.value)}
                          disabled={formLocked}
                          className="input bg-white"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="stop-at" className="text-sm font-medium text-slate-700">Berhenti otomatis</label>
                          {stopAt && (
                            <button type="button" onClick={() => setStopAt('')} className="text-xs text-slate-400 hover:text-red-600">Hapus</button>
                          )}
                        </div>
                        <input
                          id="stop-at"
                          type="datetime-local"
                          value={stopAt}
                          min={startAt || minDateTime}
                          onChange={(e) => setStopAt(e.target.value)}
                          disabled={formLocked}
                          className="input bg-white"
                        />
                      </div>
                    </div>
                    <ul className="text-xs text-slate-500 space-y-1">
                      <li>• <strong>Mulai</strong> kosong: live dimulai saat tombol diklik.</li>
                      <li>• <strong>Berhenti</strong> kosong: live berjalan nonstop sampai dihentikan.</li>
                      <li>• Live terjadwal tetap berjalan walaupun halaman ini ditutup.</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Jadwal gagal dijalankan */}
            {schedule?.error && (
              <div className="alert-error flex items-start justify-between gap-3">
                <span>{schedule.error}</span>
                <button onClick={handleCancelSchedule} disabled={loading} className="shrink-0 font-semibold hover:underline">
                  Tutup
                </button>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && <div className="alert-error">{error}</div>}
            {success && <div className="alert-success">{success}</div>}

            {/* Validation Hints */}
            {!status.isStreaming && !pendingSchedule && !canStart && (
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
            {pendingSchedule ? (
              <button
                onClick={handleCancelSchedule}
                disabled={loading}
                className="btn-secondary w-full py-3.5 text-base"
              >
                {loading ? <><span className="spinner" /> Membatalkan...</> : 'Batalkan Jadwal'}
              </button>
            ) : !status.isStreaming ? (
              <button
                onClick={handleStartStream}
                disabled={loading || !canStart}
                title={!selectedVideo ? 'Pilih video terlebih dahulu' : !streamUrl.trim() ? 'Masukkan Stream URL' : !streamKey.trim() ? 'Masukkan Stream Key' : ''}
                className={`${startAt ? 'btn-primary' : 'btn-live'} w-full py-3.5 text-base`}
              >
                {loading ? (
                  <><span className="spinner" /> {startAt ? 'Menyimpan...' : 'Memulai...'}</>
                ) : startAt ? (
                  <><Icon d={ICONS.clock} className="w-5 h-5" /> Jadwalkan Live</>
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
                {pendingSchedule ? (
                  <span className="badge bg-blue-500 text-white">
                    <Icon d={ICONS.clock} className="w-3.5 h-3.5" /> Terjadwal
                  </span>
                ) : !status.isStreaming ? (
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

              {pendingSchedule?.startAt ? (
                <>
                  <p className="text-xs text-slate-400 mb-1">Mulai dalam</p>
                  <p className="font-mono text-4xl font-bold mb-6 text-amber-50">
                    {formatCountdown(Date.parse(pendingSchedule.startAt) - now)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-400 mb-1">Durasi live</p>
                  <p className={`font-mono text-4xl font-bold mb-6 ${status.isStreaming ? 'text-amber-50' : 'text-slate-600'}`}>
                    {formatDuration(streamDuration)}
                  </p>
                </>
              )}

              {pendingSchedule?.startAt ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-slate-400">Video</dt><dd className="text-white font-medium truncate" title={pendingSchedule.videoName}>{pendingSchedule.videoName}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-400">Mulai</dt><dd className="text-white">{formatDateTime(pendingSchedule.startAt)}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-400">Berhenti</dt><dd className="text-white">{pendingSchedule.stopAt ? formatDateTime(pendingSchedule.stopAt) : 'Nonstop'}</dd></div>
                  <p className="pt-2 text-slate-400">Live dimulai otomatis oleh server, halaman ini boleh ditutup.</p>
                </dl>
              ) : status.isStreaming ? (
                status.streams.map((stream, idx) => (
                  <dl key={idx} className="space-y-2 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Video</dt><dd className="text-white font-medium truncate" title={stream.videoName}>{stream.videoName}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Mulai</dt><dd className="text-white">{new Date(stream.startedAt).toLocaleString('id-ID')}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-400">Stream key</dt><dd className="text-white font-mono">{stream.streamKey}</dd></div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">Berhenti</dt>
                      <dd className="text-white text-right">
                        {autoStopAt ? (
                          <>
                            {formatDateTime(autoStopAt)}
                            <span className="block font-mono text-xs text-amber-200">dalam {formatCountdown(Date.parse(autoStopAt) - now)}</span>
                          </>
                        ) : 'Nonstop'}
                      </dd>
                    </div>
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
