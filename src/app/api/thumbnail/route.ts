import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { getCurrentUser } from '@/lib/auth';
import { findFileById, getAbsoluteFilePath } from '@/lib/media/files';
import { FFMPEG_PATH } from '@/lib/ffmpeg';

function generatePlaceholderSVG(text: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">
    <rect fill="#1f2937" width="200" height="120"/>
    <polygon fill="#4b5563" points="85,45 85,75 115,60"/>
    <text fill="#9ca3af" font-family="Arial" font-size="10" text-anchor="middle" x="100" y="100">${text}</text>
  </svg>`;
  return Buffer.from(svg);
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json(
        { error: 'ID file harus diisi' },
        { status: 400 }
      );
    }

    const file = findFileById(user.userId, fileId);

    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan' },
        { status: 404 }
      );
    }

    if (file.type !== 'video') {
      return new Response(new Uint8Array(generatePlaceholderSVG('Audio')), {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    const videoPath = getAbsoluteFilePath(user.userId, file);

    const thumbnailBuffer = await generateThumbnail(videoPath);

    if (!thumbnailBuffer) {
      return new Response(new Uint8Array(generatePlaceholderSVG('Video')), {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    return new Response(new Uint8Array(thumbnailBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Thumbnail error:', error);
    return new Response(new Uint8Array(generatePlaceholderSVG('Error')), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
}

function generateThumbnail(videoPath: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const args = [
      '-ss', '00:00:01',
      '-i', videoPath,
      '-frames:v', '1',
      '-f', 'image2pipe',
      '-vcodec', 'png',
      '-y',
      'pipe:1'
    ];

    const ffmpeg = spawn(FFMPEG_PATH, args);

    const chunks: Buffer[] = [];

    ffmpeg.stdout.on('data', (data: Buffer) => {
      chunks.push(data);
    });

    ffmpeg.stderr.on('data', () => {});

    ffmpeg.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        resolve(null);
      }
    });

    ffmpeg.on('error', () => {
      resolve(null);
    });

    setTimeout(() => {
      ffmpeg.kill();
      resolve(null);
    }, 10000);
  });
}
