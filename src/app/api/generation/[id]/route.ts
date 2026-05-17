import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import type { Generation, AudioFeatures, SceneDefinition, StylePreset } from '@/types';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const rows = await sql`
      SELECT id, audio_hash, seed, style_preset, feature_vector, scene_definition, image_url, filename, created_at
      FROM generations
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    const row = rows[0] as {
      id: string;
      audio_hash: string;
      seed: number;
      style_preset: string;
      feature_vector: AudioFeatures;
      scene_definition: SceneDefinition;
      image_url: string | null;
      filename: string | null;
      created_at: string;
    };

    const generation: Generation = {
      id: row.id,
      audioHash: row.audio_hash,
      seed: row.seed,
      stylePreset: row.style_preset as StylePreset,
      featureVector: row.feature_vector,
      sceneDefinition: row.scene_definition,
      imageUrl: row.image_url,
      filename: row.filename,
      createdAt: row.created_at,
    };

    return NextResponse.json(generation);
  } catch (err) {
    console.error('Get generation error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
