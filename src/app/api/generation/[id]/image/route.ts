import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { sql } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const existing = await sql`SELECT id, filename FROM generations WHERE id = ${id} LIMIT 1`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    const row = existing[0] as { id: string; filename: string | null };
    const baseFilename = row.filename ? row.filename.replace(/\.[^.]+$/, '') : id;

    const pathname = `artwork/${baseFilename}.png`;
    const blob = await put(pathname, file, {
      access: 'public',
      contentType: 'image/png',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const arrayBuf = await file.arrayBuffer();
    const bmp = await createImageBitmap(new Blob([arrayBuf]));
    const canvas = new OffscreenCanvas(512, 512);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, 512, 512);
    const thumbBlob = await canvas.convertToBlob({ type: 'image/png' });

    const thumbPathname = `artwork/${baseFilename}-512.png`;
    await put(thumbPathname, thumbBlob, {
      access: 'public',
      contentType: 'image/png',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    await sql`
      UPDATE generations SET image_url = ${blob.url} WHERE id = ${id}
    `;

    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (err) {
    console.error('Image upload error:', err);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
