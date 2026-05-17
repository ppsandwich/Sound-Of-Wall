import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

const ALLOWED_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/flac',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
];

const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Allowed: mp3, wav, flac, ogg, m4a` },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'File too large. Maximum size: 100MB' },
          { status: 400 }
        );
      }

      const ext = file.name.split('.').pop() ?? 'bin';
      const pathname = `audio/${crypto.randomUUID()}.${ext}`;

      const blob = await put(pathname, file, {
        access: 'public',
        contentType: file.type,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      return NextResponse.json({
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        pathname: blob.pathname,
        filename: file.name,
        size: file.size,
      });
    }

    const body = await request.json();
    const { filename, contentType: ct } = body;

    if (!filename) {
      return NextResponse.json(
        { error: 'Missing filename' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Send file as multipart/form-data with field name "file"',
      filename,
      contentType: ct,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
