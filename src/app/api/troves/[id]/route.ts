import { NextResponse } from 'next/server';
import { loadBundle, removeTrove, persist } from '@/lib/server/troves';
import { buildTroveView } from '@/lib/server/view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The compact live view of a trove (never the raw 1,500 tiles). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const bundle = await loadBundle(id);
  if (!bundle) return NextResponse.json({ error: 'trove not found' }, { status: 404 });
  // mark it opened (drives the "last opened N weeks ago" chip; a real cold-reopen signal)
  bundle.trove.lastOpenedAt = Date.now();
  await persist(bundle);
  return NextResponse.json(buildTroveView(bundle));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (id === 'nana-example') return NextResponse.json({ error: 'the example cannot be deleted' }, { status: 400 });
  await removeTrove(id);
  return NextResponse.json({ ok: true });
}
