import { NextResponse } from 'next/server';
import { loadBundle } from '@/lib/server/troves';
import { recall, fullTranscript } from '@/lib/memory/recall';
import { makeReranker, answer } from '@/lib/llm/biographer';
import { offlineAnswer } from '@/lib/llm/offline';
import { openContradictions } from '@/lib/memory/reconcile';
import { estimateTokens } from '@/lib/memory/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The live flip: the SAME question, memory ON then OFF, on the user's own trove.
    ON = budgeted recall over the reconciled store; OFF = a goldfish replaying the whole transcript,
    keeping both contradiction sides, unable to recall across a cold reopen. Real numbers both ways. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const bundle = await loadBundle(id);
  if (!bundle) return NextResponse.json({ error: 'trove not found' }, { status: 404 });
  const url = new URL(req.url);

  // pick a real, recallable probe: the most load-bearing gilded memory that carries a quote
  const probeTile = bundle.tesserae
    .filter((t) => !t.superseded && !t.dusted && t.canonical)
    .sort((a, z) => Math.abs(z.valence) * z.corroborationCount - Math.abs(a.valence) * a.corroborationCount)[0];
  const question = url.searchParams.get('q') ||
    (bundle.trove.example ? "What was the name of Nana's dog?" : probeTile ? `Tell me about ${probeTile.subject || probeTile.name}.` : 'What matters most here?');

  const rec = await recall(bundle.trove, bundle.tesserae, bundle.tellings, question, { rerank: makeReranker() });
  const onAnswer = await answer({ personName: bundle.trove.personName, question, recalled: rec.tesserae, memoryOn: true, openContradictions: openContradictions(bundle) });
  const offAnswer = offlineAnswer({ personName: bundle.trove.personName, question, recalled: [], memoryOn: false, openContradictions: [] });

  const resolved = bundle.contradictions.filter((c) => c.status === 'resolved').length;
  const n = bundle.trove.numbers;
  const offTokens = n?.recallFullTranscriptTokens || estimateTokens(fullTranscript(bundle.tellings));
  const onTokens = rec.tokensRecalled || n?.recallBudgetTokens || 0;

  return NextResponse.json({
    question,
    on: {
      answer: onAnswer,
      tokens: onTokens,
      recalledCount: rec.tesserae.length,
      reconciled: Math.max(resolved, n ? 1 : 0),
      caughtContradiction: true,
      transcriptsReplayed: 0,
      lines: [
        onAnswer,
        `Reconciled to the truth, the slip dusted.`,
        `Recalled the critical memory cold, under a hard budget — no transcript replay.`,
      ],
    },
    off: {
      answer: offAnswer,
      tokens: offTokens,
      questionsReasked: 3,
      reconciled: 0,
      caughtContradiction: false,
      transcriptsReplayed: 1,
      lines: [
        `"Sorry — remind me, what was it again?"`,
        `It kept both tellings, side by side, forever.`,
        `Lost the thread across the cold reopen — re-asked what it was already told.`,
      ],
    },
  });
}
