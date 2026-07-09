import { NextResponse } from 'next/server';
import { loadBundle, persist } from '@/lib/server/troves';
import { resolveContradiction } from '@/lib/memory/engine';
import { openContradictions } from '@/lib/memory/reconcile';
import { troveTotals } from '@/lib/memory/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Resolve an open contradiction to the true version — gild the truth, dust the slip. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const contradictionId = String(body.contradictionId || '');
  const value = String(body.value || '');
  const bundle = await loadBundle(id);
  if (!bundle) return NextResponse.json({ error: 'trove not found' }, { status: 404 });

  const c = resolveContradiction(bundle, contradictionId, value);
  if (!c) return NextResponse.json({ error: 'contradiction not found' }, { status: 404 });
  await persist(bundle);

  return NextResponse.json({ resolved: c, contradictions: openContradictions(bundle), totals: troveTotals(bundle) });
}
