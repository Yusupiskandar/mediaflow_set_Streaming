'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import Icon, { ICONS } from '@/components/ui/Icon';
import FileBrowser from '@/components/media/FileBrowser';
import UploadDialog from '@/components/media/UploadDialog';
import type { MediaFile, FolderItem } from '@/types';

type DirectoryData =
  | { status: 'unauthorized' }
  | { status: 'ok'; files: MediaFile[]; folders: FolderItem[] };

async function loadDirectory(dir: string): Promise<DirectoryData> {
  const [filesRes, foldersRes] = await Promise.all([
    fetch(`/api/files?dir=${encodeURIComponent(dir)}`),
    fetch(`/api/folders?dir=${encodeURIComponent(dir)}`),
  ]);

  if (filesRes.status === 401 || foldersRes.status === 401) {
    return { status: 'unauthorized' };
  }

  const filesData = await filesRes.json();
  const foldersData = await foldersRes.json();

  return {
    status: 'ok',
    files: filesData.files || [],
    folders: foldersData.folders || [],
  };
}

export default function BrowsePage() {
  const router = useRouter();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentDir, setCurrentDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

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

  const pathParts = currentDir ? currentDir.split('/') : [];

  return (
    <>
      <PageHeader
        eyebrow="Media Saya"
        title={pathParts.length ? pathParts[pathParts.length - 1] : 'Library Media'}
        description={`${folders.length} folder · ${files.length} file`}
        actions={
          <>
            <Link href="/stream" className="btn-live">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Mulai Live
            </Link>
            <button onClick={() => setShowUpload(true)} className="btn-primary">
              <Icon d={ICONS.upload} className="w-4 h-4" />
              Upload
            </button>
          </>
        }
      />

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {currentDir && (
          <button onClick={handleBack} className="btn-secondary btn-sm">
            <Icon d={ICONS.back} className="w-3.5 h-3.5" />
            Kembali
          </button>
        )}
        <div className="inline-flex flex-wrap items-center gap-1 px-4 py-1.5 rounded-xl bg-white text-sm text-slate-500 shadow-sm">
          <button onClick={() => changeDir('')} className="hover:text-blue-600 transition-colors font-medium">
            Home
          </button>
          {pathParts.map((part, index) => (
            <span key={index} className="flex items-center gap-1">
              <Icon d={ICONS.chevron} className="w-3.5 h-3.5 text-slate-300" />
              <button
                onClick={() => changeDir(pathParts.slice(0, index + 1).join('/'))}
                className={`hover:text-blue-600 transition-colors ${index === pathParts.length - 1 ? 'text-slate-800 font-medium' : ''}`}
              >
                {part}
              </button>
            </span>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-blue-600">
          <span className="spinner w-10 h-10" />
          <p className="mt-4 text-slate-500">Memuat file...</p>
        </div>
      ) : (
        <FileBrowser
          files={files}
          folders={folders}
          onFileClick={handleFileClick}
          onFolderClick={handleFolderClick}
          onUploadClick={() => setShowUpload(true)}
        />
      )}

      {showUpload && (
        <UploadDialog
          currentDir={currentDir}
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => setReloadKey((key) => key + 1)}
        />
      )}
    </>
  );
}
