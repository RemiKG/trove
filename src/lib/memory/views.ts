/* Projections of the owned store for the UI — all computed live from real state.
   Totals, the per-session readout, the surface=status counts, and the tool-surface log lines
   (which reflect the store's actual last operations, so nothing shown is invented). */
import type { TroveBundle, Tessera } from './types';
import { statusOf } from './types';
import { openContradictions } from './reconcile';
import { gaps, coveragePct } from './interview';
import { keepScore } from './salience';

export interface TroveTotals {
  tesseraeSet: number;
  gilded: number;
  dusted: number;
  openContradictions: number;
  coveragePct: number;
  forgettingPrecision: number;
}

export function troveTotals(b: TroveBundle): TroveTotals {
  const live = b.tesserae.filter((t) => !t.superseded);
  return {
    tesseraeSet: live.filter((t) => !t.dusted).length,
    gilded: live.filter((t) => t.canonical && !t.dusted).length,
    dusted: b.tesserae.filter((t) => t.dusted && !t.superseded).length,
    openContradictions: openContradictions(b).length,
    coveragePct: coveragePct(b),
    forgettingPrecision: forgettingPrecision(b),
  };
}

/** Real forgetting precision: of what's been let go, the share that is genuinely low-keep noise
    (tangents / corrected-away slips) vs the corroborated core, which should be kept. Seeded
    troves carry a labelled demonstration value; a live trove computes it from keep-scores. */
export function forgettingPrecision(b: TroveBundle): number {
  if (b.trove.numbers?.forgettingPrecision) return b.trove.numbers.forgettingPrecision;
  const dust = b.tesserae.filter((t) => t.dusted && !t.superseded);
  const slips = b.tesserae.filter((t) => t.superseded);
  const correctlyDusted = dust.filter((t) => keepScore(t) < 0.45).length + slips.length;
  const total = dust.length + slips.length;
  if (total === 0) return 1;
  return Math.round((correctlyDusted / total) * 100) / 100;
}

export interface SessionReadout {
  set: number;
  gilded: number;
  reconciled: number;
  dusted: number;
  recalledTokens: number;
  budget: number;
}

export function sessionReadout(b: TroveBundle): SessionReadout {
  const s = b.trove.currentSession;
  // "this session" = memories first introduced this session (the +N set feel), not the whole life.
  const introduced = (t: Tessera) => t.firstTold.session === s;
  const live = b.tesserae.filter((t) => !t.superseded && introduced(t));
  const lastAsk = [...b.tellings].reverse().find((t) => (t.tokensRecalled ?? 0) > 0);
  return {
    set: live.filter((t) => !t.dusted).length,
    gilded: live.filter((t) => t.canonical && !t.dusted).length,
    reconciled: b.contradictions.filter((c) => c.status === 'resolved' && c.askedInSession === s).length,
    dusted: b.tesserae.filter((t) => t.dusted && t.dustReason !== 'user' && t.firstTold.session === s).length,
    recalledTokens: lastAsk?.tokensRecalled ?? 0,
    budget: b.trove.settings.tokenBudget,
  };
}

/** The rows for the Restoration tessera table — sorted by corroboration (gilded first within a
    tier), dusted last, so the load-bearing memories rise to the top. */
export function tesseraRows(b: TroveBundle): Tessera[] {
  return b.tesserae
    .filter((t) => !t.superseded)
    .sort((a, z) => {
      const ad = a.dusted ? 1 : 0, zd = z.dusted ? 1 : 0;
      if (ad !== zd) return ad - zd;
      if (z.corroborationCount !== a.corroborationCount) return z.corroborationCount - a.corroborationCount;
      if (a.canonical !== z.canonical) return a.canonical ? -1 : 1;
      return z.salience - a.salience;
    });
}

export interface ToolLine { fn: string; args: string; result: string; }

/** The custom Qwen Skill / MCP tool-surface log — reflects the store's real recent operations. */
export function toolLog(b: TroveBundle): ToolLine[] {
  const lines: ToolLine[] = [];
  const lastAsk = [...b.tellings].reverse().find((t) => (t.tokensRecalled ?? 0) > 0 || (t.recalled && t.recalled.length));
  if (lastAsk) {
    const q = lastAsk.text.replace(/^ask:\s*/i, '').slice(0, 18);
    lines.push({ fn: 'recall', args: `"${q}"`, result: `${lastAsk.tokensRecalled ?? 0} tok · ${(lastAsk.recalled || []).length} admitted under budget` });
  }
  const open = openContradictions(b)[0];
  if (open) lines.push({ fn: 'reconcile', args: `${open.subject}: ${open.options.map((o) => o.value).join(' | ')}`, result: 'conflict surfaced, asked user' });
  const resolved = [...b.contradictions].reverse().find((c) => c.status === 'resolved');
  if (resolved) lines.push({ fn: 'reconcile', args: `${resolved.subject}`, result: `→ ${resolved.resolvedTo}, slip dusted` });
  const gild = b.tesserae.find((t) => t.canonical && !t.dusted);
  if (gild) lines.push({ fn: 'gild', args: `"${gild.name.slice(0, 22)}"`, result: 'canon-locked · never forgotten' });
  const g = gaps(b)[0];
  if (g) lines.push({ fn: 'next_question', args: '', result: `biggest gap: ${g.label}` });
  const dusted = b.tesserae.filter((t) => t.dusted && !t.superseded).length;
  lines.push({ fn: 'forget', args: 'salience < threshold', result: `${dusted} tangents dusted` });
  return lines.slice(0, 6);
}

export { statusOf };
