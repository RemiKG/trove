import { NextResponse } from 'next/server';
import { loadBundle, persist } from '@/lib/server/troves';
import { buildTroveView } from '@/lib/server/view';
import { listen } from '@/lib/llm/biographer';
import { mergeRecords } from '@/lib/memory/engine';
import { nextQuestion } from '@/lib/memory/interview';
import { openContradictions } from '@/lib/memory/reconcile';
import { sessionReadout, troveTotals } from '@/lib/memory/views';
import { coveragePct } from '@/lib/memory/interview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A live telling turn: capture → typed extraction → merge/corroborate → detect a contradiction
    → decide the next best question. All real, all persisted. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || '').trim();
  const bundle = await loadBundle(id);
  if (!bundle) return NextResponse.json({ error: 'trove not found' }, { status: 404 });
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const now = Date.now();
  const session = bundle.trove.currentSession;
  bundle.trove.turnCount += 1;
  const ref = { session, turn: bundle.trove.turnCount };

  // the person's words, kept as a telling (a real transcript line — recall never reads it)
  bundle.tellings.push({ session, turn: ref.turn, t: bundle.trove.turnCount, role: 'teller', text, memoryOn: bundle.trove.settings.memoryOn, createdAt: now });

  const knownNames = bundle.tesserae.filter((t) => !t.superseded).slice(-80).map((t) => t.name);
  const openBefore = new Set(openContradictions(bundle).map((c) => c.id));

  const ex = await listen(text, { knownNames, personName: bundle.trove.personName, relationship: bundle.trove.relationship });
  const events = mergeRecords(bundle, ex.records, ref, bundle.trove.turnCount);

  // a contradiction raised THIS turn becomes the catch shown to the user
  const raised = openContradictions(bundle).find((c) => !openBefore.has(c.id)) || null;

  const recentQuestions = bundle.tellings.filter((t) => t.role === 'trove').slice(-5).map((t) => t.text);
  const nq = nextQuestion(bundle, recentQuestions);
  bundle.tellings.push({ session, turn: bundle.trove.turnCount, t: bundle.trove.turnCount, role: 'trove', text: nq.question, createdAt: now });

  await persist(bundle);

  return NextResponse.json({
    inscription: ex.inscription,
    set: events.map((e) => ({ id: e.tessera.id, name: e.tessera.name, type: e.tessera.type, action: e.action })),
    setCount: events.length,
    catch: raised,
    nextQuestion: nq,
    session: sessionReadout(bundle),
    totals: troveTotals(bundle),
    coveragePct: coveragePct(bundle),
    coverage: Math.max(0.12, Math.min(1, coveragePct(bundle) / 100)),
    mode: buildTroveView(bundle).mode,
  });
}
