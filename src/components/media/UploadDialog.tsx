'use client';

import { useState, useRef } from 'react';
import Icon, { ICONS } from '@/components/ui/Icon';

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
    <div className="fixed inset-0 bg-[#060b24]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg shadow-2xl">
        <div className="p-6 pb-0 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Upload</p>
            <h2 className="text-2xl font-bold text-slate-800">Tambah Media</h2>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 -m-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Tutup"
          >
            <Icon d={ICONS.close} className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="group rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
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
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/40 group-hover:-translate-y-0.5 transition-transform">
              <Icon d={ICONS.upload} className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-800 mb-1">
              Drag & drop file atau klik untuk memilih
            </p>
            <p className="text-sm text-slate-400">
              Video: MP4, MKV, AVI, WebM · Audio: MP3, FLAC, WAV
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-5 space-y-2">
              {files.map((file) => (
                <div key={file.name} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                  <span className="w-9 h-9 shrink-0 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Icon d={ICONS.play} className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  {progress[file.name] !== undefined && (
                    <div className="w-24">
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${progress[file.name]}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 text-right">
                        {Math.round(progress[file.name])}%
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <div className="alert-error mt-4">{error}</div>}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={onClose} disabled={uploading} className="btn-secondary">
            Batal
          </button>
          <button onClick={handleUpload} disabled={files.length === 0 || uploading} className="btn-primary">
            {uploading ? <><span className="spinner w-4 h-4" /> Mengupload...</> : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
