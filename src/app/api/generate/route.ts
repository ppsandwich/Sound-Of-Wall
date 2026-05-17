import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { generateScene } from '@/lib/rendering/scene-generator';
import { hashToSeed } from '@/lib/hashing';
import { sql } from '@/lib/db';
import type { GenerateRequest, GenerateResponse, SceneDefinition } from '@/types';

export async function POST(request: Request) {
  try {
    const body: GenerateRequest = await request.json();

    if (!body.audioHash || !body.featureVector || !body.stylePreset) {
      return NextResponse.json(
        { error: 'Missing required fields: audioHash, featureVector, stylePreset' },
        { status: 400 }
      );
    }

    const existing = await sql`
      SELECT id, scene_definition FROM generations 
      WHERE audio_hash = ${body.audioHash} AND style_preset = ${body.stylePreset}
      LIMIT 1
    `;

    if (existing.length > 0) {
      const row = existing[0] as { id: string; scene_definition: SceneDefinition };
      const response: GenerateResponse = {
        generationId: row.id,
        sceneDefinition: row.scene_definition,
      };
      return NextResponse.json(response);
    }

    const seed = hashToSeed(body.audioHash);
    const sceneDefinition = generateScene(seed, body.featureVector, body.stylePreset);
    const generationId = uuidv4();

    await sql`
      INSERT INTO generations (id, audio_hash, seed, style_preset, feature_vector, scene_definition)
      VALUES (${generationId}, ${body.audioHash}, ${seed}, ${body.stylePreset}, ${JSON.stringify(body.featureVector)}::jsonb, ${JSON.stringify(sceneDefinition)}::jsonb)
    `;

    const response: GenerateResponse = {
      generationId,
      sceneDefinition,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('Generate error:', err);
    return NextResponse.json(
      { error: 'Generation failed' },
      { status: 500 }
    );
  }
}
