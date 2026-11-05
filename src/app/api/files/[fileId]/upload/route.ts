import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import {
  resolveMediaPath,
  toMediaRelative,
  isMediaFile,
  isSubtitleFile,
  InvalidPathError,
} from '@/lib/media/files';
import { createUploadSession, updateUploadProgress, completeUpload, getUploadSession } from '@/lib/db';

// fileId dibuat oleh client (`<timestamp>-<acak>`), dipakai sebagai nama folder chunk.
const UPLOAD_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_CHUNKS = 100_000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { fileId } = await params;
    if (!UPLOAD_ID_PATTERN.test(fileId)) {
      return badRequest('ID upload tidak valid');
    }

    const formData = await request.formData();
    const chunk = formData.get('chunk');
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const totalChunks = parseInt(formData.get('totalChunks') as string, 10);
    const rawFilename = formData.get('filename');
    const totalSize = parseInt(formData.get('totalSize') as string, 10);
    const dir = (formData.get('dir') as string) || '';

    if (!(chunk instanceof File) || typeof rawFilename !== 'string') {
      return badRequest('Data upload tidak valid');
    }

    if (
      !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > MAX_CHUNKS ||
      !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks
    ) {
      return badRequest('Nomor chunk tidak valid');
    }

    // Hanya nama file, tanpa folder. Folder tujuan diambil dari `dir`.
    const filename = path.basename(rawFilename.replace(/\\/g, '/'));
    if (!filename || filename === '.' || filename === '..' || filename.startsWith('.')) {
      return badRequest('Nama file tidak valid');
    }
    if (!isMediaFile(filename) && !isSubtitleFile(filename)) {
      return badRequest('Tipe file tidak didukung');
    }

    // Semua path di dalam folder media milik akun yang sedang login.
    const uploadDir = resolveMediaPath(user.userId, dir);
    const finalPath = resolveMediaPath(user.userId, path.join(dir, filename));
    const chunksDir = path.join(resolveMediaPath(user.userId), '.uploads', fileId);

    fs.mkdirSync(uploadDir, { recursive: true });
    fs.mkdirSync(chunksDir, { recursive: true });

    if (!getUploadSession(fileId)) {
      createUploadSession(fileId, filename, Number.isFinite(totalSize) ? totalSize : 0, totalChunks);
    }

    const chunkPath = path.join(chunksDir, `chunk_${chunkIndex.toString().padStart(6, '0')}`);
    fs.writeFileSync(chunkPath, Buffer.from(await chunk.arrayBuffer()));

    updateUploadProgress(fileId, chunkIndex + 1);

    if (chunkIndex === totalChunks - 1) {
      const writeStream = fs.createWriteStream(finalPath);

      for (let i = 0; i < totalChunks; i++) {
        const chunkFile = path.join(chunksDir, `chunk_${i.toString().padStart(6, '0')}`);
        if (!fs.existsSync(chunkFile)) {
          writeStream.destroy();
          fs.rmSync(finalPath, { force: true });
          return badRequest(`Chunk ${i} belum diterima`);
        }
        writeStream.write(fs.readFileSync(chunkFile));
      }

      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      fs.rmSync(chunksDir, { recursive: true, force: true });

      completeUpload(fileId);

      return NextResponse.json({
        message: 'Upload berhasil',
        filename,
        path: toMediaRelative(user.userId, finalPath),
      });
    }

    return NextResponse.json({
      message: 'Chunk diterima',
      chunkIndex,
      uploadedChunks: chunkIndex + 1,
      totalChunks,
    });
  } catch (error) {
    if (error instanceof InvalidPathError) {
      return badRequest(error.message);
    }
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat upload' },
      { status: 500 }
    );
  }
}
