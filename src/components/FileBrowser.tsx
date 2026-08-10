'use client';

import { useState } from 'react';
import type { MediaFile, FolderItem } from '@/types';

interface FileBrowserProps {
  files: MediaFile[];
  folders: FolderItem[];
  onFileClick: (file: MediaFile) => void;
  onFolderClick: (folder: FolderItem) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type: 'video' | 'audio'): string {
  return type === 'video' ? '🎬' : '🎵';
}

function VideoThumbnail({ fileId, fileName }: { fileId: string; fileName: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return <span className="text-3xl mr-3">🎬</span>;
  }

  return (
    <div className="w-16 h-12 mr-3 flex-shrink-0">
      <img
        src={`/api/thumbnail?id=${fileId}`}
        alt={fileName}
        className="w-full h-full object-cover rounded"
        onError={() => setError(true)}
      />
    </div>
  );
}

export default function FileBrowser({ files, folders, onFileClick, onFolderClick }: FileBrowserProps) {
  if (files.length === 0 && folders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📁</div>
        <h3 className="text-xl font-medium text-white mb-2">Tidak ada file</h3>
        <p className="text-gray-400">
          Folder ini kosong. Upload file untuk mulai streaming.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {folders.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-white mb-3">Folder</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {folders.map((folder) => (
              <button
                key={folder.path}
                onClick={() => onFolderClick(folder)}
                className="flex items-center p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-left"
              >
                <span className="text-3xl mr-3">📂</span>
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{folder.name}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-white mb-3">File Media</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => onFileClick(file)}
                className="flex items-center p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-left"
              >
                {file.type === 'video' ? (
                  <VideoThumbnail fileId={file.id} fileName={file.name} />
                ) : (
                  <span className="text-3xl mr-3">🎵</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white truncate">{file.name}</p>
                  <p className="text-sm text-gray-400">{formatFileSize(file.size)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
