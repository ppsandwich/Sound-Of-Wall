import { NextResponse } from 'next/server';
import { initDatabase } from '@/lib/db';

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
