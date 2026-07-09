/* The product metrics — measured, honest.
   Live where the store can compute them (recall tokens vs full transcript, tesserae/gilded/
   dusted counts, forgetting precision); the session-1→N competence curve and the reconciliation
   tally are a seeded longitudinal demonstration on the example trove, labelled as such. */
import type { TroveBundle } from './types';
import { estimateTokens } from './types';
import { troveTotals, forgettingPrecision } from './views';
import { fullTranscript } from './recall';

export interface NumbersView {
  competence: { session: number; newCanonPerQuestion: number; redundantPct: number }[];
  competenceFrom: number;
  competenceTo: number;
  redundantFrom: number;
  redundantTo: number;
  reconciliationResolved: number;
  reconciliationTotal: number;
  reconciliationPct: number;
  recallBudgetTokens: number;
  recallFullTranscriptTokens: number;
  recallRatio: number;         // e.g. 103 → "1 / 103 the context"
  recallPrecision: number;
  forgettingPrecision: number;
  seeded: boolean;             // is the longitudinal curve seeded (example) or live?
}

export function numbersView(b: TroveBundle): NumbersView {
  const totals = troveTotals(b);
  const n = b.trove.numbers;

  // recall: the seeded example shows its labelled longitudinal demonstration (the numbers curve
  // is explicitly a seeded demo); a real user trove computes it live from the last budgeted ask.
  const lastAsk = [...b.tellings].reverse().find((t) => (t.tokensRecalled ?? 0) > 0);
  const budgetTokens = n?.recallBudgetTokens ?? lastAsk?.tokensRecalled ?? 0;
  const fullTokens = n?.recallFullTranscriptTokens ?? Math.max(
    lastAsk?.tokensFullHistory ?? 0,
    estimateTokens(fullTranscript(b.tellings)),
  );
  const ratio = budgetTokens > 0 ? Math.round(fullTokens / budgetTokens) : 0;

  const competence = n?.competence ?? liveCompetence(b);

  return {
    competence,
    competenceFrom: competence[0]?.newCanonPerQuestion ?? 0,
    competenceTo: competence[competence.length - 1]?.newCanonPerQuestion ?? 0,
    redundantFrom: competence[0]?.redundantPct ?? 0,
    redundantTo: competence[competence.length - 1]?.redundantPct ?? 0,
    reconciliationResolved: n?.reconciliationResolved ?? b.contradictions.filter((c) => c.status === 'resolved').length,
    reconciliationTotal: n?.reconciliationTotal ?? b.contradictions.length,
    reconciliationPct: pct(
      n?.reconciliationResolved ?? b.contradictions.filter((c) => c.status === 'resolved').length,
      n?.reconciliationTotal ?? b.contradictions.length,
    ),
    recallBudgetTokens: budgetTokens,
    recallFullTranscriptTokens: fullTokens,
    recallRatio: ratio,
    recallPrecision: n?.recallPrecision ?? 0,
    forgettingPrecision: n?.forgettingPrecision ?? forgettingPrecision(b),
    seeded: !!n,
  };
}

/** A live competence proxy from real tellings: new canon set per Trove question, per session. */
function liveCompetence(b: TroveBundle): { session: number; newCanonPerQuestion: number; redundantPct: number }[] {
  const bySession = new Map<number, { questions: number; canon: number }>();
  for (const t of b.tellings) {
    const s = t.session;
    const rec = bySession.get(s) || { questions: 0, canon: 0 };
    if (t.role === 'trove') rec.questions++;
    bySession.set(s, rec);
  }
  for (const tess of b.tesserae) {
    if (!tess.canonical) continue;
    const rec = bySession.get(tess.firstTold.session);
    if (rec) rec.canon++;
  }
  const out: { session: number; newCanonPerQuestion: number; redundantPct: number }[] = [];
  for (const [session, rec] of [...bySession.entries()].sort((a, z) => a[0] - z[0])) {
    out.push({
      session,
      newCanonPerQuestion: rec.questions ? Math.round((rec.canon / rec.questions) * 10) / 10 : 0,
      redundantPct: 0,
    });
  }
  return out.length ? out : [{ session: 1, newCanonPerQuestion: 0, redundantPct: 0 }];
}

function pct(a: number, b: number): number { return b > 0 ? Math.round((a / b) * 100) : 0; }
