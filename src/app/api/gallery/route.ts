import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { GalleryResponse, Generation, AudioFeatures, SceneDefinition, StylePreset } from '@/types';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.max(1, Math.min(50, parseInt(searchParams.get('pageSize') ?? '12', 10)));
  const offset = (page - 1) * pageSize;

  try {
    const countResult = await sql`SELECT COUNT(*) as total FROM generations`;
    const total = Number((countResult[0] as { total: string | number }).total);

    const rows = await sql`
      SELECT id, audio_hash, seed, style_preset, feature_vector, scene_definition, image_url, created_at
      FROM generations
      ORDER BY created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const generations: Generation[] = rows.map((row) => {
      const r = row as {
        id: string;
        audio_hash: string;
        seed: number;
        style_preset: string;
        feature_vector: AudioFeatures;
        scene_definition: SceneDefinition;
        image_url: string | null;
        created_at: string;
      };
      return {
        id: r.id,
        audioHash: r.audio_hash,
        seed: r.seed,
        stylePreset: r.style_preset as StylePreset,
        featureVector: r.feature_vector,
        sceneDefinition: r.scene_definition,
        imageUrl: r.image_url,
        createdAt: r.created_at,
      };
    });

    const response: GalleryResponse = {
      generations,
      total,
      page,
      pageSize,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('Gallery error:', err);
    return NextResponse.json(
      { generations: [], total: 0, page, pageSize },
      { status: 500 }
    );
  }
}
