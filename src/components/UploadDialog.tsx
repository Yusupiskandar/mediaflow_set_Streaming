'use client';

import { useState, useRef } from 'react';

interface UploadDialogProps {
  currentDir: string;
  onClose: () => void;
  onUploadComplete: () => void;
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

export default function UploadDialog({ currentDir, onClose, onUploadComplete }: UploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setError('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(droppedFiles);
    setError('');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const uploadFile = async (file: File) => {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('chunkIndex', i.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('filename', file.name);
      formData.append('totalSize', file.size.toString());
      formData.append('dir', currentDir);

      const response = await fetch(`/api/files/${fileId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload gagal');
      }

      setProgress((prev) => ({
        ...prev,
        [file.name]: ((i + 1) / totalChunks) * 100,
      }));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      for (const file of files) {
        await uploadFile(file);
      }

      onUploadComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Upload File</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-4xl mb-4">📤</div>
            <p className="text-gray-300 mb-2">
              Drag & drop file atau klik untuk memilih
            </p>
            <p className="text-gray-500 text-sm">
              Video: MP4, MKV, AVI, WebM | Audio: MP3, FLAC, WAV
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file) => (
                <div key={file.name} className="flex items-center justify-between p-3 bg-gray-700 rounded">
                  <div className="min-w-0 flex-1">
                    <p className="text-white truncate">{file.name}</p>
                    <p className="text-gray-400 text-sm">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  {progress[file.name] !== undefined && (
                    <div className="ml-4 w-24">
                      <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${progress[file.name]}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 text-right">
                        {Math.round(progress[file.name])}%
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-md transition-colors"
          >
            {uploading ? 'Mengupload...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
