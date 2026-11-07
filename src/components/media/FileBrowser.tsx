'use client';

import { useState } from 'react';
import type { MediaFile, FolderItem } from '@/types';
import Icon, { ICONS } from '@/components/ui/Icon';

interface FileBrowserProps {
  files: MediaFile[];
  folders: FolderItem[];
  onFileClick: (file: MediaFile) => void;
  onFolderClick: (folder: FolderItem) => void;
  onUploadClick?: () => void;
  onDeleteClick?: (file: MediaFile) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function VideoThumbnail({ fileId, fileName }: { fileId: string; fileName: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
        <Icon d={ICONS.play} className="w-8 h-8" />
      </div>
    );
  }

  return (
    // Thumbnail dibuat dinamis oleh API dan butuh cookie login, jadi tidak lewat next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/thumbnail?id=${fileId}`}
      alt={fileName}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      onError={() => setError(true)}
    />
  );
}

export default function FileBrowser({ files, folders, onFileClick, onFolderClick, onUploadClick, onDeleteClick }: FileBrowserProps) {
  if (files.length === 0 && folders.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
          <Icon d={ICONS.folder} className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Belum ada file</h3>
        <p className="text-slate-500 mb-6">Folder ini kosong. Upload video untuk mulai live streaming.</p>
        {onUploadClick && (
          <button onClick={onUploadClick} className="btn-primary">
            <Icon d={ICONS.upload} className="w-4 h-4" />
            Upload Video
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {folders.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Folder</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {folders.map((folder) => (
              <button
                key={folder.path}
                onClick={() => onFolderClick(folder)}
                className="group card card-hover flex items-center gap-4 p-4 text-left"
              >
                <span className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Icon d={ICONS.folder} className="w-6 h-6" />
                </span>
                <span className="min-w-0 flex-1 font-semibold text-slate-800 truncate">{folder.name}</span>
                <Icon d={ICONS.chevron} className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
              </button>
            ))}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-4">File Media</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {files.map((file) => (
              <div key={file.id} className="group relative card card-hover overflow-hidden">
              <button
                onClick={() => onFileClick(file)}
                className="w-full text-left flex flex-col"
              >
                <div className="relative aspect-video overflow-hidden bg-slate-100">
                  {file.type === 'video' ? (
                    <VideoThumbnail fileId={file.id} fileName={file.name} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center text-white">
                      <Icon d={ICONS.music} className="w-8 h-8" />
                    </div>
                  )}
                  <span className="absolute top-2 left-2 badge bg-white/90 text-slate-700">
                    {file.type === 'video' ? 'Video' : 'Audio'}
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center bg-[#060b24]/0 group-hover:bg-[#060b24]/30 transition-colors">
                    <span className="w-11 h-11 rounded-full bg-white text-blue-600 flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition">
                      <Icon d={ICONS.play} className="w-5 h-5" />
                    </span>
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-semibold text-slate-800 truncate" title={file.name}>{file.name}</p>
                  <p className="text-sm text-slate-400">{formatFileSize(file.size)}</p>
                </div>
              </button>
              {onDeleteClick && (
                // Selalu terlihat di layar sentuh, muncul saat hover/fokus di desktop.
                <button
                  onClick={() => onDeleteClick(file)}
                  title="Hapus media"
                  aria-label={`Hapus ${file.name}`}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 text-slate-500 shadow-sm flex items-center justify-center hover:bg-red-600 hover:text-white focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
                >
                  <Icon d={ICONS.trash} className="w-4 h-4" />
                </button>
              )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
