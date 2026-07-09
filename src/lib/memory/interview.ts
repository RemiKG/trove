/* The interviewer — why Trove gets smarter session to session.
   A real, deterministic gap model over the life-so-far: it scores which dimensions of a life are
   still uncovered and asks the highest-value question that fills the BIGGEST hole — never one it
   already has an answer to. As holes close, new canon per question rises and redundant questions
   fall (the measured competence curve). Qwen can enhance the phrasing (biographer.nextQuestion);
   this model decides the target. */
import type { TroveBundle, TesseraType } from './types';

interface Dimension {
  key: string;
  gap: string;                 // the hole it targets, for the mono flag
  priority: number;            // higher = asked earlier when uncovered
  test: RegExp;                // does any tessera already cover it?
  types?: TesseraType[];       // restrict the coverage test to these record types
  question: (name: string, rel: string) => string;
}

// Ordered roughly by how load-bearing the dimension is to a whole life.
const DIMENSIONS: Dimension[] = [
  { key: 'birthplace', gap: 'where they began', priority: 0.98, test: /\b(born|birth|grew up|childhood home|hometown|village|raised)\b/i,
    question: (n) => `Let's start at the beginning — where was ${n} born, and what was that place like?` },
  { key: 'mother', gap: 'mother — 0 records', priority: 0.96, test: /\b(mother|mamma|mum|mom|her mother)\b/i,
    question: (n) => `You've never once mentioned ${n}'s mother. What was she like?` },
  { key: 'father', gap: 'father — 0 records', priority: 0.9, test: /\b(father|papa|dad|her father)\b/i,
    question: (n) => `Tell me about ${n}'s father — what did he do, and what do you remember of him?` },
  { key: 'siblings', gap: 'brothers & sisters', priority: 0.82, test: /\b(brother|sister|sibling|siblings)\b/i,
    question: (n) => `Did ${n} have brothers or sisters? Tell me about them.` },
  { key: 'meeting', gap: 'how they met', priority: 0.86, test: /\b(met|meeting|court|fell in love|first met|wedding|married)\b/i,
    question: (n) => `How did ${n} meet the person they married — where were they, that first time?` },
  { key: 'children', gap: 'children', priority: 0.78, test: /\b(son|daughter|children|kids|raised|born to)\b/i,
    question: (n) => `Tell me about ${n}'s children — who came first, and what were they like small?` },
  { key: 'work', gap: 'livelihood', priority: 0.72, test: /\b(work|worked|job|trade|bakery|shop|farm|factory|office|business|living)\b/i,
    question: (n) => `What did ${n} do for a living — how did the days actually go?` },
  { key: 'hardship', gap: 'a hardship survived', priority: 0.74, test: /\b(war|crossing|border|hunger|poor|lost|illness|struggle|survived|hard time|depression)\b/i,
    question: (n) => `Was there a hard stretch ${n} came through — something they survived?` },
  { key: 'value', gap: 'what they believed', priority: 0.7, test: /\b(believe|value|taught|always said|never|proud|faith|rule)\b/i, types: ['value', 'saying'],
    question: (n) => `What did ${n} always say — a rule, a belief, the thing they'd tell you every time?` },
  { key: 'food', gap: 'the kitchen', priority: 0.6, test: /\b(recipe|cook|kitchen|bread|soup|sauce|meal|dish|dinner|baked)\b/i,
    question: (n) => `Was there a dish ${n} made that no one else could? Walk me through it.` },
  { key: 'object', gap: 'a treasured object', priority: 0.58, test: /\b(ring|watch|coat|photograph|photo|letter|box|keepsake|kept|treasure)\b/i, types: ['object'],
    question: (n) => `Was there an object ${n} kept and would never part with? What was it?` },
  { key: 'home', gap: 'a place that mattered', priority: 0.56, test: /\b(house|home|street|town|kitchen|garden|room|farm|apartment)\b/i, types: ['place'],
    question: (n) => `Which place mattered most to ${n} — a house, a street, a room you can still see?` },
  { key: 'pet', gap: 'an animal they loved', priority: 0.5, test: /\b(dog|cat|pet|animal|horse|bird)\b/i,
    question: (n) => `Did ${n} ever have an animal they loved? Tell me about it.` },
];

function covers(bundle: TroveBundle, d: Dimension): boolean {
  for (const t of bundle.tesserae) {
    if (t.superseded || t.dusted) continue;
    if (d.types && !d.types.includes(t.type)) continue;
    const hay = `${t.name} ${t.detail} ${t.quote || ''}`;
    if (d.test.test(hay)) return true;
  }
  return false;
}

export interface Gap { key: string; label: string; priority: number; }

/** the uncovered dimensions, biggest hole first. */
export function gaps(bundle: TroveBundle): Gap[] {
  return DIMENSIONS.filter((d) => !covers(bundle, d))
    .sort((a, b) => b.priority - a.priority)
    .map((d) => ({ key: d.key, label: d.gap, priority: d.priority }));
}

/** the next best question — targets the biggest hole not asked in the last few turns. */
export function nextQuestion(
  bundle: TroveBundle,
  recentQuestions: string[] = [],
): { question: string; gap: string } {
  const name = bundle.trove.personName;
  const rel = bundle.trove.relationship;
  const recent = new Set(recentQuestions.map((q) => q.toLowerCase()));
  const uncovered = DIMENSIONS.filter((d) => !covers(bundle, d)).sort((a, b) => b.priority - a.priority);
  for (const d of uncovered) {
    const q = d.question(name, rel);
    if (!recent.has(q.toLowerCase())) return { question: q, gap: d.gap };
  }
  // everything major covered → go deeper on the richest thread
  const deep = `You've given me so much of ${name}'s life. Is there a story you've never told anyone — one you almost forgot?`;
  return { question: deep, gap: 'a story never told' };
}

/** how many of the tracked dimensions are covered — a real "life coverage" percentage. */
export function coveragePct(bundle: TroveBundle): number {
  const covered = DIMENSIONS.filter((d) => covers(bundle, d)).length;
  return Math.round((covered / DIMENSIONS.length) * 100);
}
