'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import SubtitleOverlay from './SubtitleOverlay';
import type { SubtitleFile } from '@/types';

function convertTimeToSeconds(time: string): number {
  const cleaned = time.replace(',', '.');
  const parts = cleaned.split(':');

  if (parts.length === 3) {
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // VTT boleh memakai format pendek MM:SS.mmm
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }

  return 0;
}

function findSubtitleText(subtitle: SubtitleFile | null, time: number): string {
  if (!subtitle) return '';

  const entries = subtitle.entries || [];
  const currentEntry = entries.find((entry) => {
    const start = convertTimeToSeconds('startTime' in entry ? entry.startTime : entry.start);
    const end = convertTimeToSeconds('endTime' in entry ? entry.endTime : entry.end);
    return time >= start && time <= end;
  });

  return currentEntry?.text || '';
}

interface VideoPlayerProps {
  fileId: string;
  fileName: string;
  fileType: 'video' | 'audio';
  initialPosition: number;
  subtitles: SubtitleFile[];
}

export default function VideoPlayer({
  fileId,
  fileName,
  fileType,
  initialPosition,
  subtitles,
}: VideoPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [activeSubtitle, setActiveSubtitle] = useState<SubtitleFile | null>(null);

  // Dihitung langsung dari waktu putar, jadi selalu memakai subtitle yang sedang dipilih.
  const currentSubtitleText = useMemo(
    () => findSubtitleText(activeSubtitle, currentTime),
    [activeSubtitle, currentTime]
  );

  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handleLoadedMetadata = () => {
      setDuration(media.duration);
      if (initialPosition > 0) {
        media.currentTime = initialPosition;
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(media.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    media.addEventListener('loadedmetadata', handleLoadedMetadata);
    media.addEventListener('timeupdate', handleTimeUpdate);
    media.addEventListener('play', handlePlay);
    media.addEventListener('pause', handlePause);
    media.addEventListener('ended', handleEnded);

    return () => {
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      media.removeEventListener('timeupdate', handleTimeUpdate);
      media.removeEventListener('play', handlePlay);
      media.removeEventListener('pause', handlePause);
      media.removeEventListener('ended', handleEnded);
    };
  }, [fileId, initialPosition]);

  const savePosition = useCallback(async () => {
    const media = mediaRef.current;
    if (!media || !media.duration) return;

    try {
      await fetch('/api/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          // Dibaca langsung dari elemen media supaya posisi yang disimpan selalu terbaru.
          position: media.currentTime,
          duration: media.duration,
        }),
      });
    } catch (error) {
      console.error('Error saving position:', error);
    }
  }, [fileId]);

  useEffect(() => {
    if (!isPlaying) return;

    saveIntervalRef.current = setInterval(savePosition, 5000);

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
      // Simpan sekali lagi saat pause atau pindah halaman.
      savePosition();
    };
  }, [isPlaying, savePosition]);

  const togglePlay = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;

    if (media.paused) {
      media.play();
    } else {
      media.pause();
    }
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const media = mediaRef.current;
    const progress = progressRef.current;
    if (!media || !progress) return;

    const rect = progress.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    media.currentTime = pos * duration;
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const media = mediaRef.current;
    if (!media) return;

    const newVolume = parseFloat(e.target.value);
    media.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;

    media.muted = !media.muted;
    setIsMuted(media.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    const media = mediaRef.current;
    if (!media) return;

    media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + seconds));
  }, []);

  const formatTime = (time: number): string => {
    const h = Math.floor(time / 3600);
    const m = Math.floor((time % 3600) / 60);
    const s = Math.floor(time % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume((v) => {
            const newV = Math.min(1, v + 0.1);
            if (mediaRef.current) mediaRef.current.volume = newV;
            return newV;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((v) => {
            const newV = Math.max(0, v - 0.1);
            if (mediaRef.current) mediaRef.current.volume = newV;
            return newV;
          });
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skip, toggleMute, toggleFullscreen]);

  const streamUrl = `/api/files/${fileId}/stream`;

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-lg overflow-hidden"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {fileType === 'video' ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={streamUrl}
          className="w-full aspect-video"
          onClick={togglePlay}
          playsInline
        />
      ) : (
        <div className="w-full aspect-video flex items-center justify-center bg-gray-900">
          <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={streamUrl} />
          <div className="text-center">
            <div className="text-6xl mb-4">🎵</div>
            <p className="text-white text-xl">{fileName}</p>
          </div>
        </div>
      )}

      {fileType === 'video' && currentSubtitleText && (
        <SubtitleOverlay text={currentSubtitleText} />
      )}

      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div
            ref={progressRef}
            className="w-full h-2 bg-gray-600 rounded-full cursor-pointer mb-4"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-blue-500 rounded-full relative"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => skip(-10)}
                className="text-white hover:text-blue-400 transition-colors"
                title="Mundur 10 detik"
              >
                ⏪
              </button>

              <button
                onClick={togglePlay}
                className="text-white hover:text-blue-400 transition-colors text-2xl"
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>

              <button
                onClick={() => skip(10)}
                className="text-white hover:text-blue-400 transition-colors"
                title="Maju 10 detik"
              >
                ⏩
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 accent-blue-500"
                />
              </div>

              <span className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {subtitles.length > 0 && (
                <div className="relative">
                  <select
                    value={activeSubtitle?.id || ''}
                    onChange={(e) => {
                      const sub = subtitles.find((s) => s.id === e.target.value) || null;
                      setActiveSubtitle(sub);
                    }}
                    className="bg-gray-700 text-white text-sm rounded px-2 py-1"
                  >
                    <option value="">Subtitle: OFF</option>
                    {subtitles.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {fileType === 'video' && (
                <button
                  onClick={toggleFullscreen}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  {isFullscreen ? '🗗' : '⛶'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
