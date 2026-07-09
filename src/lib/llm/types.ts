/* Shapes exchanged across the brain seam (Qwen Cloud or the local offline brain). */
import type { TesseraType, Tessera, Contradiction } from '../memory/types';

/** One typed life-record the Listener extracts from a telling. */
export interface ExtractedRecord {
  type: TesseraType;
  name: string;                 // short label ("The bakery on Oak Street")
  detail: string;               // one-sentence resolved description
  quote?: string;               // her actual words (only what she said)
  salience?: number;            // 0..1
  valence?: number;             // -1..1
  canonical?: boolean;          // load-bearing / gilded on sight (rare — usually earned by corroboration)
  subject?: string;             // the entity this claim is about ("the bakery") — for reconciliation
  value?: string;               // the specific claim ("Oak") — two values for one subject = a contradiction
  links?: string[];             // names of related records
}

export interface ExtractResult {
  records: ExtractedRecord[];
  /** the person's own words for this turn, cleaned (an inscription) */
  inscription?: string;
}

/** Context handed to the interviewer to decide the next best question. */
export interface InterviewContext {
  personName: string;
  relationship: string;
  known: { type: TesseraType; name: string }[];
  gaps: { type: TesseraType; label: string }[];   // record types with 0 / few records
  recentQuestions: string[];
}

export interface NextQuestion {
  question: string;
  gap: string;                  // the biggest hole it targets ("mother — 0 records")
}

/** For the answer to a direct question over the recalled tesserae. */
export interface AnswerInput {
  personName: string;
  question: string;
  recalled: Tessera[];
  memoryOn: boolean;
  openContradictions: Contradiction[];
}
