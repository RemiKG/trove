import { NextResponse } from 'next/server';
import { modeInfo } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The honest brain-mode seam, surfaced to the UI. */
export async function GET() {
  return NextResponse.json(modeInfo());
}
