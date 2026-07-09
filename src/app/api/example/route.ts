import { NextResponse } from 'next/server';
import { ensureExample, EXAMPLE_ID } from '@/lib/server/troves';
import { buildTroveView } from '@/lib/server/view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ensure the pre-seeded example ("Nana") exists and return its id. */
export async function GET() {
  const b = await ensureExample();
  return NextResponse.json({ id: EXAMPLE_ID, view: buildTroveView(b) });
}

/** Rebuild the example from scratch (demo reset). */
export async function POST() {
  const b = await ensureExample(true);
  return NextResponse.json({ id: EXAMPLE_ID, view: buildTroveView(b) });
}
