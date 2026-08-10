'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FileBrowser from '@/components/FileBrowser';
import UploadDialog from '@/components/UploadDialog';
import type { MediaFile, FolderItem } from '@/types';

export default function BrowsePage() {
  const router = useRouter();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentDir, setCurrentDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchUserAndFiles();
  }, [currentDir]);

  const fetchUserAndFiles = async () => {
    setLoading(true);
    try {
      const [userRes, filesRes, foldersRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch(`/api/files?dir=${encodeURIComponent(currentDir)}`),
        fetch(`/api/folders?dir=${encodeURIComponent(currentDir)}`),
      ]);

      if (filesRes.status === 401 || foldersRes.status === 401) {
        router.push('/login');
        return;
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        setIsAdmin(userData.user?.userId === 1);
      }

      const filesData = await filesRes.json();
      const foldersData = await foldersRes.json();

      setFiles(filesData.files || []);
      setFolders(foldersData.folders || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (file: MediaFile) => {
    router.push(`/player/${file.id}`);
  };

  const handleFolderClick = (folder: FolderItem) => {
    setCurrentDir(folder.path);
  };

  const handleBack = () => {
    const parts = currentDir.split('/');
    parts.pop();
    setCurrentDir(parts.join('/'));
  };

  const handleLogout = async () => {
    document.cookie = 'mediaflow_token=; Path=/; Max-Age=0';
    router.push('/login');
  };

  const pathParts = currentDir ? currentDir.split('/') : [];

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/browse')}
                className="text-xl font-bold text-white"
              >
                MediaFlow
              </button>
            </div>

            <div className="flex items-center space-x-4">
              {isAdmin && (
                <button
                  onClick={() => router.push('/admin/users')}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-md transition-colors border border-gray-600"
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
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <button
              onClick={() => setCurrentDir('')}
              className="hover:text-white transition-colors"
            >
              Home
            </button>
            {pathParts.map((part, index) => (
              <span key={index} className="flex items-center">
                <span className="mx-2">/</span>
                <button
                  onClick={() => setCurrentDir(pathParts.slice(0, index + 1).join('/'))}
                  className="hover:text-white transition-colors"
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
            className="mb-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
          >
            ← Kembali
          </button>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">Memuat file...</p>
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
          onUploadComplete={fetchUserAndFiles}
        />
      )}
    </div>
  );
}
