import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const formData = await request.formData();
    const fullRes = formData.get('image') as File | null;
    const thumbnail = formData.get('thumbnail') as File | null;

    if (!fullRes) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const existing = await sql`SELECT id, filename FROM generations WHERE id = ${id} LIMIT 1`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    const row = existing[0] as { id: string; filename: string | null };
    const baseFilename = row.filename ? row.filename.replace(/\.[^.]+$/, '') : id;

    let imageUrl: string;

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      try {
        const { put } = await import('@vercel/blob');

        const pathname = `artwork/${baseFilename}.png`;
        const blob = await put(pathname, fullRes, {
          access: 'public',
          contentType: 'image/png',
          token: blobToken,
        });
        imageUrl = blob.url;

        if (thumbnail) {
          const ext = thumbnail.type === 'image/jpeg' ? 'jpg' : 'png';
          const thumbPathname = `artwork/${baseFilename}-512.${ext}`;
          await put(thumbPathname, thumbnail, {
            access: 'public',
            contentType: thumbnail.type,
            token: blobToken,
          });
        }

        console.log(`[SOW] Image stored in blob: ${imageUrl}`);
      } catch (blobErr) {
        console.error('[SOW] Blob upload failed, falling back to data URL:', blobErr);
        const source = thumbnail ?? fullRes;
        const arrayBuf = await source.arrayBuffer();
        const base64 = Buffer.from(arrayBuf).toString('base64');
        const mime = source.type || 'image/png';
        imageUrl = `data:${mime};base64,${base64}`;
        console.log(`[SOW] Stored as data URL (${Math.round(imageUrl.length / 1024)}KB)`);
      }
    } else {
      console.warn('[SOW] BLOB_READ_WRITE_TOKEN not set — storing thumbnail as data URL');
      const source = thumbnail ?? fullRes;
      const arrayBuf = await source.arrayBuffer();
      const base64 = Buffer.from(arrayBuf).toString('base64');
      const mime = source.type || 'image/png';
      imageUrl = `data:${mime};base64,${base64}`;
      console.log(`[SOW] Stored as data URL (${Math.round(imageUrl.length / 1024)}KB)`);
    }

    await sql`
      UPDATE generations SET image_url = ${imageUrl} WHERE id = ${id}
    `;

    return NextResponse.json({ url: imageUrl.substring(0, 80) + '...', stored: true });
  } catch (err) {
    console.error('[SOW] Image upload error:', err);
    return NextResponse.json({ error: 'Failed to upload image', detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
