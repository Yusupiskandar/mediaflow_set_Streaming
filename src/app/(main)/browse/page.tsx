'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FileBrowser from '@/components/media/FileBrowser';
import UploadDialog from '@/components/media/UploadDialog';
import type { MediaFile, FolderItem } from '@/types';

type DirectoryData =
  | { status: 'unauthorized' }
  | { status: 'ok'; files: MediaFile[]; folders: FolderItem[]; isAdmin: boolean; expiresAt: string | null };

async function loadDirectory(dir: string): Promise<DirectoryData> {
  const [userRes, filesRes, foldersRes] = await Promise.all([
    fetch('/api/auth/me'),
    fetch(`/api/files?dir=${encodeURIComponent(dir)}`),
    fetch(`/api/folders?dir=${encodeURIComponent(dir)}`),
  ]);

  if (userRes.status === 401 || filesRes.status === 401 || foldersRes.status === 401) {
    return { status: 'unauthorized' };
  }

  const userData = userRes.ok ? await userRes.json() : {};
  const filesData = await filesRes.json();
  const foldersData = await foldersRes.json();

  return {
    status: 'ok',
    files: filesData.files || [],
    folders: foldersData.folders || [],
    isAdmin: userData.user?.userId === 1,
    expiresAt: userData.user?.expiresAt ?? null,
  };
}

const EXPIRING_SOON_MS = 3 * 24 * 60 * 60 * 1000;

/** Info masa sewa untuk akun biasa. Admin utama tidak punya masa sewa. */
function RentalBadge({ expiresAt }: { expiresAt: string }) {
  const [now] = useState(() => Date.now());
  const soon = Date.parse(expiresAt) - now <= EXPIRING_SOON_MS;
  const label = new Date(expiresAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <span
      className={`hidden sm:inline-flex px-3 py-1 text-sm rounded-full border ${
        soon ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
      title="Akun otomatis nonaktif setelah masa sewa berakhir"
    >
      {soon ? 'Sewa segera habis: ' : 'Sewa aktif s/d '}
      {label}
    </span>
  );
}

export default function BrowsePage() {
  const router = useRouter();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentDir, setCurrentDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    loadDirectory(currentDir)
      .then((result) => {
        if (!active) return;
        if (result.status === 'unauthorized') {
          router.push('/login');
          return;
        }
        setFiles(result.files);
        setFolders(result.folders);
        setIsAdmin(result.isAdmin);
        setExpiresAt(result.expiresAt);
      })
      .catch((error) => console.error('Error fetching data:', error))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentDir, reloadKey, router]);

  const changeDir = (dir: string) => {
    setLoading(true);
    setCurrentDir(dir);
  };

  const handleFileClick = (file: MediaFile) => {
    router.push(`/player/${file.id}`);
  };

  const handleFolderClick = (folder: FolderItem) => {
    changeDir(folder.path);
  };

  const handleBack = () => {
    const parts = currentDir.split('/');
    parts.pop();
    changeDir(parts.join('/'));
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  const pathParts = currentDir ? currentDir.split('/') : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/browse')}
                className="text-xl font-bold text-gray-900"
              >
                MediaFlow
              </button>
            </div>

            <div className="flex items-center space-x-4">
              {!isAdmin && expiresAt && <RentalBadge expiresAt={expiresAt} />}
              {isAdmin && (
                <button
                  onClick={() => router.push('/admin/users')}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium rounded-md transition-colors border border-gray-300"
                >
                  Admin Panel
                </button>
              )}
              <button
                onClick={() => router.push('/stream')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors flex items-center space-x-2"
              >
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                <span>Live Stream</span>
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Upload
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-md transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <button
              onClick={() => changeDir('')}
              className="hover:text-gray-900 transition-colors"
            >
              Home
            </button>
            {pathParts.map((part, index) => (
              <span key={index} className="flex items-center">
                <span className="mx-2">/</span>
                <button
                  onClick={() => changeDir(pathParts.slice(0, index + 1).join('/'))}
                  className="hover:text-gray-900 transition-colors"
                >
                  {part}
                </button>
              </span>
            ))}
          </div>
        </div>

        {currentDir && (
          <button
            onClick={handleBack}
            className="mb-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-md transition-colors"
          >
            ← Kembali
          </button>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-500">Memuat file...</p>
          </div>
        ) : (
          <FileBrowser
            files={files}
            folders={folders}
            onFileClick={handleFileClick}
            onFolderClick={handleFolderClick}
          />
        )}
      </main>

      {showUpload && (
        <UploadDialog
          currentDir={currentDir}
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => setReloadKey((key) => key + 1)}
        />
      )}
    </div>
  );
}
