import { NextResponse } from 'next/server';
import { loadBundle, persist } from '@/lib/server/troves';
import { recall } from '@/lib/memory/recall';
import { mergeRecords, gild as gildTile, lift, resolveContradiction, applyForgetting } from '@/lib/memory/engine';
import { makeReranker } from '@/lib/llm/biographer';
import { nextQuestion } from '@/lib/memory/interview';
import { openContradictions, detectContradictions } from '@/lib/memory/reconcile';
import { tesseraLine } from '@/lib/memory/types';
import type { ExtractedRecord } from '@/lib/llm/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/* Trove's life-memory as a reusable tool surface: remember · recall · reconcile · next-question ·
   gild · forget. The SAME endpoints power the app, the standalone MCP server (mcp/server.mjs),
   and the Qwen Skill scripts — one real engine, callable by ANY agent. */
export async function POST(req: Request, ctx: { params: Promise<{ tool: string }> }) {
  const { tool } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const troveId = String(body.troveId || body.trove_id || body.sagaId || '');
  if (!troveId) return NextResponse.json({ error: 'troveId required' }, { status: 400 });

  const bundle = await loadBundle(troveId);
  if (!bundle) return NextResponse.json({ error: 'trove not found' }, { status: 404 });

  if (tool === 'recall') {
    const query = String(body.query || body.scene || body.question || '');
    const budget = body.budget ? Number(body.budget) : undefined;
    const rec = await recall(bundle.trove, bundle.tesserae, bundle.tellings, query, { rerank: makeReranker(), budget });
    return NextResponse.json({
      tool: 'recall',
      memories: rec.tesserae.map((t) => ({ id: t.id, type: t.type, name: t.name, detail: t.detail, canonical: t.canonical, line: tesseraLine(t) })),
      tokensRecalled: rec.tokensRecalled, tokensFullTranscript: rec.tokensFullTranscript,
      budget: rec.budget, transcriptsReplayed: 0, reranked: rec.reranked, candidates: rec.candidates,
    });
  }

  if (tool === 'remember') {
    const records: ExtractedRecord[] = Array.isArray(body.records) ? body.records : [];
    const ref = { session: bundle.trove.currentSession, turn: bundle.trove.turnCount + 1 };
    bundle.trove.turnCount += 1;
    const events = mergeRecords(bundle, records, ref, bundle.trove.turnCount);
    await persist(bundle);
    return NextResponse.json({ tool: 'remember', events: events.map((e) => ({ name: e.tessera.name, action: e.action })) });
  }

  if (tool === 'reconcile') {
    if (body.contradictionId && body.value) {
      const c = resolveContradiction(bundle, String(body.contradictionId), String(body.value));
      await persist(bundle);
      return NextResponse.json({ tool: 'reconcile', resolved: c ? { subject: c.subject, to: c.resolvedTo } : null });
    }
    detectContradictions(bundle, bundle.trove.currentSession);
    await persist(bundle);
    return NextResponse.json({ tool: 'reconcile', open: openContradictions(bundle).map((c) => ({ id: c.id, subject: c.subject, options: c.options.map((o) => o.value) })) });
  }

  if (tool === 'next-question' || tool === 'next_question') {
    const nq = nextQuestion(bundle, bundle.tellings.filter((t) => t.role === 'trove').slice(-5).map((t) => t.text));
    return NextResponse.json({ tool: 'next-question', question: nq.question, gap: nq.gap });
  }

  if (tool === 'gild') {
    let tid = body.tesseraId as string | undefined;
    if (!tid && body.name) tid = bundle.tesserae.find((x) => x.name.toLowerCase() === String(body.name).toLowerCase() && !x.superseded)?.id;
    const t = tid ? gildTile(bundle, tid) : null;
    if (!t) return NextResponse.json({ error: 'tessera not found' }, { status: 404 });
    await persist(bundle);
    return NextResponse.json({ tool: 'gild', gilded: t.name });
  }

  if (tool === 'forget') {
    if (body.tesseraId) {
      const t = lift(bundle, String(body.tesseraId));
      await persist(bundle);
      return NextResponse.json({ tool: 'forget', forgotten: t ? [t.name] : [] });
    }
    const r = applyForgetting(bundle);
    await persist(bundle);
    return NextResponse.json({ tool: 'forget', dusted: r.dusted, restored: r.restored });
  }

  return NextResponse.json({ error: `unknown tool "${tool}"` }, { status: 404 });
}
