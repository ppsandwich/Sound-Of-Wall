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

    const existing = await sql`SELECT id FROM generations WHERE id = ${id} LIMIT 1`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    const pathname = `artwork/${id}.png`;
    const blob = await put(pathname, file, {
      access: 'public',
      contentType: 'image/png',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const thumbPathname = `artwork/${id}-thumb.png`;
    await put(thumbPathname, file, {
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
