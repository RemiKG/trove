/* Budgeted recall — the track's exact ask, implemented.
   1. embed the question, 2. score every live tessera by vector relevance,
   3. optionally rerank the top candidates (qwen3-rerank when a key is set),
   4. admit GILDED CANON FIRST, then the most relevant tesserae that still fit a hard token
      budget (default 4,096), above a relevance floor, up to a cap.
   The answer is drawn ONLY from the recalled tesserae — never the transcript. That is why a
   whole life fits a small context, and why "transcripts replayed: 0" is literally true. */
import type { Tessera, Trove, Telling } from './types';
import { estimateTokens, tesseraTokens, tesseraLine } from './types';
import { localEmbed, cosine, queryTokens, overlapScore } from './embed';
import { tesseraEmbedText } from './embed';
import { rankScore, keepScore } from './salience';

export interface ScoredTessera {
  tessera: Tessera;
  relevance: number;
  rank: number;
}

export interface RecallResult {
  tesserae: Tessera[];          // admitted, canon first
  scored: ScoredTessera[];      // all, ranked (for debugging / views)
  answer: Tessera | null;       // the single best memory for a direct question
  tokensRecalled: number;
  tokensFullTranscript: number; // what a goldfish would stuff into context instead
  budget: number;
  reranked: boolean;
  transcriptsReplayed: 0;       // literally zero — the point
  oldestSession: number | null;
  admittedCanon: number;
  admittedWarm: number;
  candidates: number;
}

export type Reranker = (query: string, docs: string[]) => Promise<number[] | null>;

const RELEVANCE_FLOOR = 0.24; // below this, a warm tile isn't worth a slot even if budget allows
const CANON_FLOOR = 0.2;      // gilded canon is prioritised, but still gated by relevance —
                              // recall is a CRITICAL subset, never a dump of the whole gilded life
const MAX_TESSERAE = 12;

export async function recall(
  trove: Trove,
  tesserae: Tessera[],
  tellings: Telling[],
  question: string,
  opts: { rerank?: Reranker | null; budget?: number } = {},
): Promise<RecallResult> {
  const budget = opts.budget ?? trove.settings.tokenBudget;
  const qVec = localEmbed(question);
  const qTok = queryTokens(question);
  const active = tesserae.filter((t) => !t.superseded && !t.dusted);

  // relevance = semantic cosine (bigram-aware) blended with a length-independent lexical overlap,
  // so a short pointed question ("the dog") reliably lands its distinctive keyword.
  let scored: ScoredTessera[] = active.map((tessera) => {
    const cos = Math.max(0, cosine(qVec, tessera.embedding));
    const lex = overlapScore(qTok, tesseraEmbedText(tessera));
    const relevance = 0.4 * cos + 0.6 * lex;
    return { tessera, relevance, rank: rankScore(tessera, relevance) };
  });

  // rerank the top candidates when a reranker is available (qwen3-rerank)
  let reranked = false;
  if (opts.rerank) {
    const pool = [...scored].sort((a, b) => b.rank - a.rank).slice(0, 20).map((s) => s.tessera);
    try {
      const docs = pool.map((t) => tesseraLine(t));
      const order = await opts.rerank(question, docs);
      if (order && order.length === pool.length) {
        const relById = new Map<string, number>();
        pool.forEach((t, i) => relById.set(t.id, order[i]));
        scored = scored.map((s) =>
          relById.has(s.tessera.id)
            ? { ...s, relevance: relById.get(s.tessera.id)!, rank: rankScore(s.tessera, relById.get(s.tessera.id)!) }
            : s,
        );
        reranked = true;
      }
    } catch {
      /* rerank is an enhancement; fall back to local scoring silently */
    }
  }

  const canon = scored.filter((s) => s.tessera.canonical).sort((a, b) => b.relevance - a.relevance);
  const rest = scored.filter((s) => !s.tessera.canonical).sort((a, b) => b.rank - a.rank);

  const admitted: Tessera[] = [];
  let used = 0;
  let admittedCanon = 0;
  let admittedWarm = 0;

  // gilded canon is admitted FIRST (priority) — but only canon RELEVANT to the question, so a
  // whole life of 247 gilded tiles is never dumped into context for a single ask.
  for (const s of canon) {
    if (admitted.length >= MAX_TESSERAE) break;
    if (s.relevance < CANON_FLOOR) continue;
    const cost = tesseraTokens(s.tessera);
    if (used + cost > budget && admitted.length > 0) continue;
    admitted.push(s.tessera);
    used += cost;
    admittedCanon++;
  }
  // then the most relevant tesserae that still fit — above the floor, up to the cap
  for (const s of rest) {
    if (admitted.length >= MAX_TESSERAE) break;
    if (s.relevance < RELEVANCE_FLOOR) continue;
    const cost = tesseraTokens(s.tessera);
    if (used + cost > budget) continue;
    admitted.push(s.tessera);
    used += cost;
    admittedWarm++;
  }

  // the single best memory to answer a direct question: the most relevant admitted tile
  const rankedAll = scored.slice().sort((a, b) => b.relevance - a.relevance);
  const bestScored = rankedAll[0];
  const answer =
    bestScored && bestScored.relevance >= RELEVANCE_FLOOR && admitted.some((t) => t.id === bestScored.tessera.id)
      ? bestScored.tessera
      : null;

  const tokensFullTranscript = tellings.reduce((n, t) => n + estimateTokens(t.text), 0);
  const oldestSession = admitted.length ? Math.min(...admitted.map((t) => t.firstTold.session)) : null;

  return {
    tesserae: admitted,
    scored: scored.sort((a, b) => b.rank - a.rank),
    answer,
    tokensRecalled: used,
    tokensFullTranscript,
    budget,
    reranked,
    transcriptsReplayed: 0,
    oldestSession,
    admittedCanon,
    admittedWarm,
    candidates: active.length,
  };
}

/** The recall context handed to the biographer — tesserae only, canon first. NOT the transcript. */
export function buildRecallContext(result: RecallResult): string {
  if (!result.tesserae.length) return '(nothing recalled yet — a blank tray)';
  return result.tesserae.map(tesseraLine).join('\n');
}

/** naive full-transcript baseline (what "memory OFF" / a tape recorder would replay). */
export function fullTranscript(tellings: Telling[], maxTurns = 40): string {
  return tellings.slice(-maxTurns).map((t) => `${t.role === 'teller' ? 'Them' : 'Trove'}: ${t.text}`).join('\n');
}

export { keepScore };
