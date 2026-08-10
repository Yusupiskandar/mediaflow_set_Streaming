import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getMediaDir } from '@/lib/files';
import { createUploadSession, updateUploadProgress, completeUpload, getUploadSession } from '@/lib/db';

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
    const formData = await request.formData();
    const chunk = formData.get('chunk') as File;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const filename = formData.get('filename') as string;
    const totalSize = parseInt(formData.get('totalSize') as string);
    const dir = formData.get('dir') as string || '';

    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !filename) {
      return NextResponse.json(
        { error: 'Data upload tidak valid' },
        { status: 400 }
      );
    }

    const uploadDir = path.join(getMediaDir(), dir);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uploadDirForChunks = path.join(uploadDir, '.uploads', fileId);

    if (!fs.existsSync(uploadDirForChunks)) {
      fs.mkdirSync(uploadDirForChunks, { recursive: true });
    }

    const existingSession = getUploadSession(fileId) as { uploaded_chunks: number } | undefined;

    if (!existingSession) {
      createUploadSession(fileId, filename, totalSize, totalChunks);
    }

    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    const chunkPath = path.join(uploadDirForChunks, `chunk_${chunkIndex.toString().padStart(6, '0')}`);

    fs.writeFileSync(chunkPath, chunkBuffer);

    updateUploadProgress(fileId, chunkIndex + 1);

    if (chunkIndex === totalChunks - 1) {
      const finalPath = path.join(uploadDir, filename);
      const writeStream = fs.createWriteStream(finalPath);

      for (let i = 0; i < totalChunks; i++) {
        const chunkFile = path.join(uploadDirForChunks, `chunk_${i.toString().padStart(6, '0')}`);
        const chunkData = fs.readFileSync(chunkFile);
        writeStream.write(chunkData);
      }

      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      fs.rmSync(uploadDirForChunks, { recursive: true, force: true });

      completeUpload(fileId);

      return NextResponse.json({
        message: 'Upload berhasil',
        filename,
        path: path.relative(getMediaDir(), finalPath),
      });
    }

    return NextResponse.json({
      message: 'Chunk diterima',
      chunkIndex,
      uploadedChunks: chunkIndex + 1,
      totalChunks,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat upload' },
      { status: 500 }
    );
  }
}
