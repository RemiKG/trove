/* Salience & forgetting — the scoring that decides what stays in context and what greys to
   dust. All real, all computed from the store:
     keepScore   = how load-bearing a memory is (salience × corroboration × valence × type)
     rankScore   = relevance × (a salience boost) — used to order budgeted recall
     forgetScore = 1 − keepScore — how dustable a non-canon tangent is
   The forgetting slider maps to a threshold: below it, non-canon tesserae grey to dust
   (reversible). Gilded canon is never dusted. */
import type { Tessera, Trove } from './types';
import { TYPE_IMPORTANCE } from './types';

/** 0 at 0 tellings, ~0.5 at 1, ~0.67 at 2, ~0.75 at 3 … — the corroboration curve. */
export function corroboration(t: Tessera): number {
  const n = Math.max(0, t.corroborationCount);
  return 1 - 1 / (1 + n);
}

/** How load-bearing a memory is: its intrinsic weight, blended so no single signal dominates. */
export function keepScore(t: Tessera): number {
  const base = TYPE_IMPORTANCE[t.type] ?? 0.5;
  const corr = corroboration(t);
  const val = Math.min(1, Math.abs(t.valence));
  const sal = Math.max(0, Math.min(1, t.salience));
  const score = 0.30 * sal + 0.28 * corr + 0.24 * val + 0.18 * base;
  return Math.max(0, Math.min(1, score));
}

/** Recall ordering: relevance leads, but a load-bearing memory earns a boost. */
export function rankScore(t: Tessera, relevance: number): number {
  return relevance * (0.55 + 0.45 * keepScore(t));
}

/** How dustable a NON-canon memory is (higher = more likely a tangent worth letting go). */
export function forgetScore(t: Tessera): number {
  return 1 - keepScore(t);
}

/** The forgetting slider (0 keep-everything … 1 gild-only-corroborated) → a keep threshold. */
export function forgetThreshold(forgetting: number): number {
  const s = Math.max(0, Math.min(1, forgetting));
  return 0.08 + s * 0.5; // 0.08 (barely) … 0.58 (aggressive)
}

/** Would this memory be dusted at the given forgetting setting? (canon never dusts.) */
export function wouldDust(t: Tessera, forgetting: number): boolean {
  if (t.canonical || t.superseded) return false;
  return keepScore(t) < forgetThreshold(forgetting);
}

/** Live preview for the slider: how many dust vs stay gilded/set at a setting. */
export function previewForget(tesserae: Tessera[], forgetting: number): { dusted: number; gilded: number; set: number } {
  let dusted = 0, gilded = 0, set = 0;
  for (const t of tesserae) {
    if (t.superseded) continue;
    if (t.canonical) { gilded++; continue; }
    if (keepScore(t) < forgetThreshold(forgetting)) dusted++;
    else set++;
  }
  return { dusted, gilded, set };
}

/** Salience used at extraction time when the model didn't give one — a sensible prior by type. */
export function priorSalience(type: Tessera['type'], valence = 0): number {
  const base = TYPE_IMPORTANCE[type] ?? 0.5;
  return Math.max(0, Math.min(1, 0.7 * base + 0.3 * Math.min(1, Math.abs(valence))));
}

/** referenced so a Trove import is always used (keeps the module cohesive with the store). */
export function isFromExample(trove: Trove): boolean {
  return !!trove.example;
}
