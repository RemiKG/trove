import { NextResponse } from 'next/server';
import { loadBundle, persist } from '@/lib/server/troves';
import { recall, fullTranscript } from '@/lib/memory/recall';
import { answer } from '@/lib/llm/biographer';
import { offlineAnswer } from '@/lib/llm/offline';
import { makeReranker } from '@/lib/llm/biographer';
import { touchRecalled } from '@/lib/memory/engine';
import { openContradictions } from '@/lib/memory/reconcile';
import { litPositionFor } from '@/lib/server/view';
import { estimateTokens } from '@/lib/memory/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Budgeted recall — the core path. Embed the question, pull + rerank candidates, admit gilded
    canon first under a hard token budget, answer ONLY from the recalled tiles (never the
    transcript). With memory OFF it degrades to a goldfish that replays the whole transcript. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const question = String(body.question || '').trim();
  const bundle = await loadBundle(id);
  if (!bundle) return NextResponse.json({ error: 'trove not found' }, { status: 404 });
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 });

  const memoryOn = body.memoryOn != null ? !!body.memoryOn : bundle.trove.settings.memoryOn;
  const now = Date.now();
  const session = bundle.trove.currentSession;

  if (!memoryOn) {
    // OFF — no persistent store: replay the whole transcript, keep both contradiction sides.
    const full = fullTranscript(bundle.tellings);
    const text = offlineAnswer({ personName: bundle.trove.personName, question, recalled: [], memoryOn: false, openContradictions: [] });
    return NextResponse.json({
      answer: text, memoryOn: false,
      answerTile: null, recalled: [],
      tokensRecalled: bundle.trove.numbers?.recallFullTranscriptTokens || estimateTokens(full),
      budget: bundle.trove.settings.tokenBudget, transcriptsReplayed: 1,
      oldestSession: null, reranked: false, candidates: 0,
    });
  }

  const rec = await recall(bundle.trove, bundle.tesserae, bundle.tellings, question, { rerank: makeReranker() });
  const text = await answer({
    personName: bundle.trove.personName, question,
    recalled: rec.tesserae, memoryOn: true, openContradictions: openContradictions(bundle),
  });

  touchRecalled(bundle, rec.tesserae.map((t) => t.id));
  bundle.trove.turnCount += 1;
  bundle.tellings.push({
    session, turn: bundle.trove.turnCount, t: bundle.trove.turnCount, role: 'teller',
    text: `ask: ${question}`, recalled: rec.tesserae.map((t) => t.id),
    tokensRecalled: rec.tokensRecalled, tokensFullHistory: rec.tokensFullTranscript, memoryOn: true, createdAt: now,
  });
  await persist(bundle);

  const a = rec.answer;
  return NextResponse.json({
    answer: text, memoryOn: true,
    answerTile: a ? {
      id: a.id, name: a.name, type: a.type, quote: a.quote, detail: a.detail,
      canonical: a.canonical, corroborationCount: a.corroborationCount, firstTold: a.firstTold,
      lit: litPositionFor(a.id),
    } : null,
    recalled: rec.tesserae.map((t) => ({ id: t.id, name: t.name, type: t.type, canonical: t.canonical })),
    tokensRecalled: rec.tokensRecalled, tokensFullTranscript: rec.tokensFullTranscript,
    budget: rec.budget, transcriptsReplayed: 0, oldestSession: rec.oldestSession,
    admittedCanon: rec.admittedCanon, admittedWarm: rec.admittedWarm, reranked: rec.reranked, candidates: rec.candidates,
  });
}
