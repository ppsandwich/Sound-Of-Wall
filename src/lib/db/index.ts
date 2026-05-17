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

export async function initDatabase(): Promise<{ steps: string[] }> {
  const steps: string[] = [];

  await sql`
    CREATE TABLE IF NOT EXISTS generations (
      id UUID PRIMARY KEY,
      audio_hash TEXT NOT NULL,
      seed BIGINT NOT NULL,
      style_preset TEXT,
      feature_vector JSONB,
      scene_definition JSONB,
      image_url TEXT,
      filename TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  steps.push('table created or already exists');

  try {
    await sql`ALTER TABLE generations ADD COLUMN IF NOT EXISTS filename TEXT`;
    steps.push('filename column ensured');
  } catch {
    steps.push('filename column already exists or added by CREATE TABLE');
  }

  await sql`
    CREATE INDEX IF NOT EXISTS idx_generations_audio_hash ON generations(audio_hash)
  `;
  steps.push('audio_hash index ensured');

  await sql`
    CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC)
  `;
  steps.push('created_at index ensured');

  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_generations_filename ON generations(filename) WHERE filename IS NOT NULL`;
    steps.push('filename unique index ensured');
  } catch (e) {
    steps.push(`filename unique index skipped: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { steps };
}

export const MAX_GALLERY_SIZE = 50;
