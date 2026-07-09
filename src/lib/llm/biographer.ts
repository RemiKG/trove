/* The brain seam. listen (extract) and answer pick Qwen Cloud when a key is set, and Trove's
   local offline brain otherwise. Either way the memory ENGINE around them is identical, and the
   answer is fed ONLY the recalled tesserae — never the transcript. The next-best-question is a
   deterministic gap model (interview.ts) in both modes — the decision is real, not model-luck. */
import { hasQwen, qwen } from '../config';
import { chat, rerankScores } from './qwen';
import { offlineExtract, offlineAnswer, cleanInscription } from './offline';
import type { ExtractResult, ExtractedRecord, AnswerInput } from './types';
import type { Reranker } from '../memory/recall';
import { TESSERA_TYPES, tesseraLine } from '../memory/types';

/** Listen to a telling → typed, linked life-records. Qwen qwen3.7-plus structured, else offline. */
export async function listen(text: string, ctx: { knownNames: string[]; personName: string; relationship?: string }): Promise<ExtractResult> {
  if (hasQwen()) {
    try {
      const sys = [
        `You are Trove's Listener — a patient family biographer's ear. The person is telling you about ${ctx.personName}.`,
        'Extract typed, linked life-records from the latest telling. Return STRICT JSON:',
        '{"records":[{"type","name","detail","quote","subject","value","salience","valence","canonical"}]}',
        `"type" ∈ ${TESSERA_TYPES.join(' | ')}.`,
        '"name" = a short label (e.g. "The bakery on Oak Street"). "detail" = one resolved sentence.',
        '"quote" = the person\'s ACTUAL words if present (never paraphrase into a fake quote).',
        '"subject" = the entity a claim is about ("the bakery"); "value" = the specific claim ("Oak").',
        '   Two different values for the same subject across tellings are a CONTRADICTION Trove will reconcile — always fill subject+value for streets, years, and relations.',
        '"salience" 0..1 (how load-bearing), "valence" -1..1 (emotional weight).',
        'Set "canonical" true ONLY for a clearly load-bearing, emotional, corroborated fact.',
        'CRITICAL: extract ONLY what is actually said. Never invent a memory to fill a gap. If the telling is thin, return few or zero records.',
        `Known entities: ${ctx.knownNames.slice(0, 50).join(', ') || '(none yet)'}.`,
      ].join(' ');
      const { content } = await chat(
        [
          { role: 'system', content: sys },
          { role: 'user', content: text },
        ],
        { model: qwen.models.listener, temperature: 0.2, response_format: { type: 'json_object' }, max_tokens: 900 },
      );
      const parsed = JSON.parse(content);
      const recs = Array.isArray(parsed) ? parsed : parsed.records;
      if (Array.isArray(recs)) {
        const records: ExtractedRecord[] = recs
          .filter((r: any) => r && r.type && r.name && (TESSERA_TYPES as string[]).includes(r.type))
          .map((r: any) => ({
            type: r.type,
            name: String(r.name).slice(0, 100),
            detail: String(r.detail || r.name).slice(0, 400),
            quote: r.quote ? String(r.quote).slice(0, 240) : undefined,
            subject: r.subject ? String(r.subject).slice(0, 60) : undefined,
            value: r.value ? String(r.value).slice(0, 60) : undefined,
            salience: typeof r.salience === 'number' ? r.salience : undefined,
            valence: typeof r.valence === 'number' ? r.valence : undefined,
            canonical: !!r.canonical,
          }));
        return { records, inscription: cleanInscription(text) };
      }
    } catch {
      /* fall back to offline extraction */
    }
  }
  return offlineExtract(text, { knownNames: ctx.knownNames, personName: ctx.personName, relationship: ctx.relationship });
}

/** Answer a question grounded ONLY in the recalled tesserae. Qwen qwen3.7-max, else offline. */
export async function answer(input: AnswerInput): Promise<string> {
  if (!input.memoryOn) return offlineAnswer(input);
  if (hasQwen() && input.recalled.length) {
    try {
      const memory = input.recalled.map(tesseraLine).join('\n');
      const sys = [
        `You are Trove, keeping the memory of ${input.personName}. Answer the question using ONLY the recalled memories below.`,
        'You did NOT re-read any transcript — you have only these budgeted memories.',
        'Rules that are never broken: only what they actually said; NEVER invent a memory to fill a gap.',
        'If the memories do not contain the answer, say so plainly and offer to ask next session — do not guess.',
        'Quote their actual words when a memory carries a quote. Warm, brief (1–3 sentences), no markdown.',
      ].join(' ');
      const { content } = await chat(
        [
          { role: 'system', content: sys },
          { role: 'user', content: `RECALLED MEMORY (budgeted; gilded canon first):\n${memory}\n\nQUESTION: ${input.question}` },
        ],
        { model: qwen.models.biographer, temperature: 0.5, max_tokens: 400, extra_body: { enable_thinking: false } },
      );
      if (content && content.trim()) return content.trim();
    } catch {
      /* fall back to the offline grounded answer */
    }
  }
  return offlineAnswer(input);
}

/** The reranker for recall — qwen3-rerank when keyed, else null (recall uses local scoring). */
export function makeReranker(): Reranker | null {
  if (!hasQwen()) return null;
  return async (query: string, docs: string[]) => {
    return rerankScores(query, docs, qwen.models.rerank);
  };
}
