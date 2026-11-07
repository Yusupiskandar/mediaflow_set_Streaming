'use client';

import { useState } from 'react';
import type { MediaFile } from '@/types';
import Icon, { ICONS } from '@/components/ui/Icon';

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
}

/** Konfirmasi hapus satu file media. */
export default function DeleteMediaDialog({
  file,
  onClose,
  onDeleted,
}: {
  file: MediaFile;
  onClose: () => void;
  onDeleted: (message: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus file');
      const subtitles: string[] = data.deletedSubtitles ?? [];
      onDeleted(subtitles.length ? `${data.message} (beserta ${subtitles.length} subtitle)` : data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#060b24]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={deleting ? undefined : onClose}>
      <div className="card w-full max-w-md shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
          <Icon d={ICONS.trash} className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-2">Hapus media?</h2>
        <p className="text-slate-500 text-center mb-5">File akan dihapus permanen dan tidak bisa dikembalikan.</p>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-5">
          <span className="w-10 h-10 shrink-0 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
            <Icon d={file.type === 'video' ? ICONS.play : ICONS.music} className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate" title={file.name}>{file.name}</p>
            <p className="text-xs text-slate-400">{formatSize(file.size)} · subtitle dengan nama sama ikut terhapus</p>
          </div>
        </div>

        {error && <div className="alert-error mb-5">{error}</div>}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={deleting} className="btn-secondary flex-1">Batal</button>
          <button onClick={handleDelete} disabled={deleting} className="btn-danger flex-1">
            {deleting ? <><span className="spinner w-4 h-4" /> Menghapus...</> : 'Hapus'}
          </button>
        </div>
      </div>
    </div>
  );
}
