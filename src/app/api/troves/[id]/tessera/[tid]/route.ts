import { NextResponse } from 'next/server';
import { loadBundle, persist } from '@/lib/server/troves';
import { gild, lift, brush } from '@/lib/memory/engine';
import { statusOf } from '@/lib/memory/types';
import { troveTotals } from '@/lib/memory/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** User overrides on a single tessera — gild (canon-lock), lift (force-forget), brush (restore).
    All reversible; nothing is ever destroyed. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; tid: string }> }) {
  const { id, tid } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const bundle = await loadBundle(id);
  if (!bundle) return NextResponse.json({ error: 'trove not found' }, { status: 404 });

  let t = null;
  if (action === 'gild') t = gild(bundle, tid);
  else if (action === 'lift') t = lift(bundle, tid);
  else if (action === 'brush') t = brush(bundle, tid);
  else return NextResponse.json({ error: 'action must be gild | lift | brush' }, { status: 400 });
  if (!t) return NextResponse.json({ error: 'tessera not found' }, { status: 404 });

  await persist(bundle);
  return NextResponse.json({ tile: { id: t.id, status: statusOf(t), canonical: t.canonical, dusted: t.dusted }, totals: troveTotals(bundle) });
}
