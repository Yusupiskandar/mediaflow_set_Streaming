import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { getCurrentUser } from '@/lib/auth';
import { findFileById, getMimeType, getMediaDir } from '@/lib/files';

export async function GET(
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
    const file = findFileById(fileId);

    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan' },
        { status: 404 }
      );
    }

    const filePath = path.join(getMediaDir(), file.path);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File tidak ditemukan di disk' },
        { status: 404 }
      );
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const mimeType = getMimeType(filePath);

    const range = request.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Content-Range': `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });

      const webStream = Readable.toWeb(stream) as ReadableStream;

      return new Response(webStream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': mimeType,
          'Cache-Control': 'no-cache',
        },
      });
    }

    const stream = fs.createReadStream(filePath);
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Length': String(fileSize),
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Stream error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat streaming' },
      { status: 500 }
    );
  }
}
