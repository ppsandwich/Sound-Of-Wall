import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL not set — database operations will fail');
}

export const sql = neon(DATABASE_URL ?? '');

export async function query<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  return sql(strings, ...values) as Promise<T[]>;
}

export async function initDatabase(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS generations (
      id UUID PRIMARY KEY,
      audio_hash TEXT NOT NULL,
      seed BIGINT NOT NULL,
      style_preset TEXT,
      feature_vector JSONB,
      scene_definition JSONB,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_generations_audio_hash ON generations(audio_hash)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC)
  `;
}
