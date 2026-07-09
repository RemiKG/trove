/* Trove memory model — the typed, structured store Trove OWNS. This is the product: a
   first-class life-memory we keep, that survives a closed tab and a cold model context for
   years. Every field here is real state, computed and persisted — never a transcript.

   The core model: a memory's STATUS is its tessera's surface.
     unset  — newly heard, not yet placed (pale, on the tray)
     set    — corroborated, took its place in the portrait (pressed into the grout)
     gilded — canon: load-bearing, kept forever, catches light
     dusted — a tangent / corrected-away slip, let go (still brushable back)
     lit    — the moment it is RECALLED
*/

export type TesseraType =
  | 'person'
  | 'place'
  | 'event'
  | 'date'
  | 'object'
  | 'saying'
  | 'value'
  | 'relationship';

export const TESSERA_TYPES: TesseraType[] = [
  'person', 'place', 'event', 'date', 'object', 'saying', 'value', 'relationship',
];

export type TileState = 'unset' | 'set' | 'gild' | 'dust' | 'lit';

export interface Ref { session: number; turn: number; }

/** A tessera is a single memory — one typed, linked life-record. */
export interface Tessera {
  id: string;
  troveId: string;
  type: TesseraType;
  name: string;                 // a short label ("The bakery on Oak Street")
  detail: string;               // the current, resolved one-sentence description
  quote?: string;               // her ACTUAL words, set like an inscription (only what she said)
  subject?: string;             // the entity a claim is about ("the bakery") — for reconciliation
  value?: string;               // the specific claim ("Oak") — two values for one subject = a conflict
  salience: number;             // 0..1 how load-bearing
  valence: number;              // -1..1 emotional weight (magnitude protects from forgetting)
  confidence: number;           // 0..1 how sure we are it's true
  corroborationCount: number;   // times re-observed / confirmed across tellings
  contradictionCount: number;
  canonical: boolean;           // gilded → always recalled, never forgotten
  dusted: boolean;              // forgotten on purpose (reversible — brushable back)
  dustReason?: 'auto' | 'user' | 'slip'; // decay pass · force-forget · corrected-away
  superseded: boolean;          // retired by a resolved contradiction (the slip)
  supersededBy?: string;
  firstTold: Ref;
  firstToldT: number;           // global monotonic turn index
  lastTold: Ref;
  lastToldT: number;
  recallCount: number;
  links: string[];              // ids of bound tesserae
  embedding: number[];          // the owned local lexical vector index
  embedModel: string;
  provenance: { model: string; extractedTurn: Ref; sessions: number };
  createdAt: number;
  updatedAt: number;
}

/** An open contradiction across tellings — held side by side, never silently merged. */
export interface Contradiction {
  id: string;
  troveId: string;
  subject: string;              // "The bakery street"
  type: TesseraType;
  options: { value: string; tesseraId: string; tellings: number }[];  // Elm vs Oak
  status: 'open' | 'resolved';
  resolvedTo?: string;          // the value kept (gilded); the other is dusted
  askedInSession: number;
  createdAt: number;
  resolvedAt?: number;
}

/** One line of a telling — a question from Trove, or the person's own words. */
export interface Telling {
  session: number;
  turn: number;
  t: number;                    // global monotonic index
  role: 'trove' | 'teller';
  text: string;
  recalled?: string[];          // tessera ids recalled this turn (for teller/ask turns)
  set?: string[];               // tessera ids set/confirmed this turn
  tokensRecalled?: number;
  tokensFullHistory?: number;
  memoryOn?: boolean;
  createdAt: number;
}

export interface TroveSettings {
  /** How aggressively the mosaic forgets: 0 = keep everything ↔ 1 = gild only the corroborated. */
  forgetting: number;
  tokenBudget: number;          // hard per-question recall budget
  memoryOn: boolean;            // the master toggle — the memory ON/OFF switch
}

/** The seeded longitudinal demonstration numbers (labelled as such in the UI). Real live
    counts (set / gilded / dusted / recalled tokens / contradictions) are computed from the
    store; these curves are the scripted session-1→N demonstration. */
export interface TroveNumbers {
  competence: { session: number; newCanonPerQuestion: number; redundantPct: number }[];
  reconciliationResolved: number;
  reconciliationTotal: number;
  recallBudgetTokens: number;
  recallFullTranscriptTokens: number;
  recallPrecision: number;
  forgettingPrecision: number;
}

export interface Trove {
  id: string;
  personName: string;           // what you call them ("Nana")
  fullName: string;             // "Margherita Russo"
  relationship: string;         // "grandmother"
  bornYear?: number;
  diedYear?: number;
  seed: number;                 // portrait seed — same person → same face on every recall
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number;
  currentSession: number;
  turnCount: number;            // global monotonic turn index
  settings: TroveSettings;
  brain: 'qwen' | 'offline';    // which brain produced the content in this trove
  example?: boolean;            // the pre-seeded demo ("Nana")
  numbers?: TroveNumbers;       // seeded/measured demonstration curves
  /** an occasion (e.g. a birthday) the Mosaic can surface unprompted */
  occasion?: { title: string; detail: string; tesseraId?: string };
}

/** The full persisted bundle for one trove. */
export interface TroveBundle {
  trove: Trove;
  tesserae: Tessera[];
  tellings: Telling[];
  contradictions: Contradiction[];
}

/** Intrinsic weight by record type — values/relationships are the load-bearing core. */
export const TYPE_IMPORTANCE: Record<TesseraType, number> = {
  value: 0.80,
  relationship: 0.72,
  event: 0.68,
  person: 0.64,
  saying: 0.60,
  place: 0.54,
  object: 0.50,
  date: 0.42,
};

export const DEFAULT_SETTINGS: TroveSettings = {
  forgetting: 0.55,
  tokenBudget: Number(process.env.TROVE_TOKEN_BUDGET) || 4096,
  memoryOn: true,
};

/** rough token estimate (≈4 chars/token) used for the budget accounting shown on screen. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/** the surface a tessera shows right now (recall lighting is applied by the UI/recall pass). */
export function statusOf(t: Tessera): TileState {
  if (t.superseded) return 'dust';
  if (t.dusted) return 'dust';
  if (t.canonical) return 'gild';
  if (t.corroborationCount < 1) return 'unset';
  return 'set';
}

/** the framed record line that actually gets injected into context on recall. */
export function tesseraLine(t: Tessera): string {
  const flag = t.canonical ? ' [gilded canon]' : '';
  const q = t.quote ? ` — "${t.quote}"` : '';
  return `- (${t.type}${flag}) ${t.name}: ${t.detail}${q}`;
}

/** tokens a tessera actually costs when injected on recall. */
export function tesseraTokens(t: Tessera): number {
  return estimateTokens(tesseraLine(t)) + 8;
}

export function activeTesserae(b: TroveBundle): Tessera[] {
  return b.tesserae.filter((t) => !t.superseded && !t.dusted);
}

export function tesseraById(b: TroveBundle, id: string): Tessera | undefined {
  return b.tesserae.find((t) => t.id === id);
}
