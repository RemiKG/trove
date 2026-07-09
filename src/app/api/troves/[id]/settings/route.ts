import { NextResponse } from 'next/server';
import { loadBundle, persist } from '@/lib/server/troves';
import { applyForgetting } from '@/lib/memory/engine';
import { previewForget } from '@/lib/memory/salience';
import { troveTotals } from '@/lib/memory/views';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live preview of the forgetting policy at a setting — no mutation (for the slider). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const forgetting = Number(url.searchParams.get('forgetting'));
  const bundle = await loadBundle(id);
  if (!bundle) return NextResponse.json({ error: 'trove not found' }, { status: 404 });
  const active = bundle.tesserae.filter((t) => !t.superseded);
  const preview = previewForget(active, isFinite(forgetting) ? forgetting : bundle.trove.settings.forgetting);
  return NextResponse.json({ preview });
}

/** Commit the forgetting policy and/or the memory ON/OFF toggle. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const bundle = await loadBundle(id);
  if (!bundle) return NextResponse.json({ error: 'trove not found' }, { status: 404 });

  let forgetChanged = false;
  if (typeof body.forgetting === 'number') {
    bundle.trove.settings.forgetting = Math.max(0, Math.min(1, body.forgetting));
    forgetChanged = true;
  }
  if (typeof body.memoryOn === 'boolean') bundle.trove.settings.memoryOn = body.memoryOn;

  const forget = forgetChanged ? applyForgetting(bundle) : { dusted: 0, restored: 0 };
  await persist(bundle);
  return NextResponse.json({ settings: bundle.trove.settings, forget, totals: troveTotals(bundle) });
}
