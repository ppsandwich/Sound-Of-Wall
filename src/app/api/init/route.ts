import { NextResponse } from 'next/server';
import { initDatabase, sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await initDatabase();
    return NextResponse.json({ success: true, message: 'Database initialized', steps: result.steps });
  } catch (err) {
    console.error('Database init error:', err);
    return NextResponse.json(
      {
        error: 'Failed to initialize database',
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const countResult = await sql`SELECT COUNT(*) as total FROM generations`;
    const total = Number((countResult[0] as { total: string | number }).total);
    await sql`DELETE FROM generations`;
    return NextResponse.json({ success: true, deleted: total });
  } catch (err) {
    console.error('Database clear error:', err);
    return NextResponse.json(
      { error: 'Failed to clear database', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
