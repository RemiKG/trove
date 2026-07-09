import { NextResponse } from 'next/server';
import { getStore } from '@/lib/memory/store';
import { createBundle, persist, ensureExample } from '@/lib/server/troves';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** List every trove (the example always present), most-recent first. */
export async function GET() {
  await ensureExample();
  const summaries = await getStore().list();
  return NextResponse.json({ troves: summaries });
}

/** Start your own — create a fresh trove for a person, running the identical live pipeline. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const personName = String(body.personName || '').trim();
  if (!personName) return NextResponse.json({ error: 'personName required' }, { status: 400 });
  const bundle = createBundle({
    personName,
    relationship: body.relationship ? String(body.relationship) : undefined,
    fullName: body.fullName ? String(body.fullName) : undefined,
  });
  await persist(bundle);
  return NextResponse.json({ id: bundle.trove.id });
}
