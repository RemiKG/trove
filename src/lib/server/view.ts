/* The compact view the UI consumes — a projection of the owned store, never the raw 1,500 tiles.
   Everything here is computed live from real state. */
import type { TroveBundle, Tessera } from '../memory/types';
import { statusOf } from '../memory/types';
import { troveTotals, sessionReadout, tesseraRows, toolLog } from '../memory/views';
import { openContradictions } from '../memory/reconcile';
import { nextQuestion, coveragePct } from '../memory/interview';
import { numbersView } from '../memory/numbers';
import { tesseraTokens } from '../memory/types';
import { modeInfo } from '../config';

export interface RowView {
  id: string; type: string; name: string; detail: string; quote?: string;
  corroborationCount: number; salience: number; canonical: boolean; dusted: boolean;
  status: string; held: boolean;
}

export function rowView(t: Tessera, heldIds: Set<string>): RowView {
  return {
    id: t.id, type: t.type, name: t.name, detail: t.detail, quote: t.quote,
    corroborationCount: t.corroborationCount, salience: t.salience,
    canonical: t.canonical, dusted: t.dusted, status: statusOf(t), held: heldIds.has(t.id),
  };
}

/** a deterministic point in the lower face/collar area for a recalled tile to light up. */
export function litPositionFor(id: string, w = 760, h = 920): { x: number; y: number; r: number } {
  let hsh = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) { hsh ^= id.charCodeAt(i); hsh = Math.imul(hsh, 16777619); }
  const rx = (hsh >>> 0) / 4294967296;
  const ry = ((hsh >>> 8) >>> 0) / 4294967296;
  return { x: Math.round(w * (0.30 + rx * 0.40)), y: Math.round(h * (0.58 + ry * 0.16)), r: 30 };
}

export function keepsakeData(b: TroveBundle) {
  const quotes = b.tesserae
    .filter((t) => t.quote && !t.superseded && (t.canonical || t.corroborationCount >= 2))
    .sort((a, z) => z.valence * z.corroborationCount - a.valence * a.corroborationCount)
    .slice(0, 3)
    .map((t) => t.quote as string);
  const totals = troveTotals(b);
  const caption = `Reconstructed from ${b.trove.currentSession} conversations · ${totals.gilded} memories gilded as canon · only what ${b.trove.personName === b.trove.fullName ? 'they' : 'she'} actually said · the gaps left as gaps, never invented.`;
  return { quotes, caption };
}

export function buildTroveView(b: TroveBundle, opts: { rows?: number } = {}) {
  const heldIds = new Set<string>();
  for (const c of b.contradictions) if (c.status === 'open') for (const o of c.options) heldIds.add(o.tesseraId);
  const allRows = tesseraRows(b);
  // top set/gilded rows, then a couple of dusted ones so the "brush off" (restore) action shows.
  const nonDust = allRows.filter((t) => !t.dusted);
  const dust = allRows.filter((t) => t.dusted);
  const rows = [...nonDust.slice(0, opts.rows ?? 38), ...dust.slice(0, 2)];
  const totals = troveTotals(b);
  const occTile = b.trove.occasion?.tesseraId ? b.tesserae.find((t) => t.id === b.trove.occasion!.tesseraId) : undefined;
  const occasionMeta = occTile ? { corroboration: occTile.corroborationCount, tokens: tesseraTokens(occTile) } : null;
  return {
    trove: {
      id: b.trove.id, personName: b.trove.personName, fullName: b.trove.fullName,
      relationship: b.trove.relationship, bornYear: b.trove.bornYear, diedYear: b.trove.diedYear,
      seed: b.trove.seed, currentSession: b.trove.currentSession, turnCount: b.trove.turnCount,
      example: !!b.trove.example, occasion: b.trove.occasion, occasionMeta, settings: b.trove.settings,
      lastOpenedAt: b.trove.lastOpenedAt,
    },
    totals,
    session: sessionReadout(b),
    coverage: Math.max(0.12, Math.min(1, coveragePct(b) / 100)),
    coveragePct: coveragePct(b),
    nextQuestion: nextQuestion(b),
    contradictions: openContradictions(b),
    tellings: b.tellings.slice(-8),
    rows: rows.map((t) => rowView(t, heldIds)),
    rowsTotal: allRows.length,
    toolLog: toolLog(b),
    numbers: numbersView(b),
    keepsake: keepsakeData(b),
    mode: modeInfo(),
  };
}

export type TroveView = ReturnType<typeof buildTroveView>;
