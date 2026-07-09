/* The engine — every mutation of the owned life-store. All real, all persisted:
   merge (set + corroborate + auto-gild), reconcile (resolve a contradiction → gild truth, dust
   slip), gild / lift / brush (user overrides), and the forgetting pass (decay/consolidation).
   Nothing is ever destroyed — dust is reversible. */
import type { TroveBundle, Tessera, Ref, Contradiction, TesseraType } from './types';
import { TESSERA_TYPES, statusOf } from './types';
import type { ExtractedRecord } from '../llm/types';
import { newId } from './store';
import { localEmbed, cosine, tesseraEmbedText, LOCAL_MODEL } from './embed';
import { priorSalience, wouldDust, keepScore } from './salience';
import { detectContradictions } from './reconcile';

export interface MergeEvent {
  tessera: Tessera;
  action: 'set' | 'corroborated' | 'gilded';
}

const NAME_MATCH = 0.72; // cosine over the embed text above which two records are "the same memory"

function clamp01(v: any): number { const n = Number(v); return isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5; }
function clampVal(v: any): number { const n = Number(v); return isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0; }

function normName(s: string): string {
  return s.toLowerCase().replace(/^(the|a|an|her|his|their|my|your|our)\s+/i, '').replace(/[^a-z0-9\s]/g, '').trim();
}

/** find the existing tessera a record refers to (same type + strong name/vector match). */
function findExisting(bundle: TroveBundle, rec: ExtractedRecord, vec: number[]): Tessera | undefined {
  const n = normName(rec.name);
  let best: Tessera | undefined;
  let bestSim = 0;
  for (const t of bundle.tesserae) {
    if (t.superseded) continue;
    if (t.type !== rec.type) continue;
    if (normName(t.name) === n) return t; // exact name → same memory
    const sim = cosine(vec, t.embedding);
    if (sim > bestSim) { bestSim = sim; best = t; }
  }
  return bestSim >= NAME_MATCH ? best : undefined;
}

function clampType(type: string): TesseraType {
  return (TESSERA_TYPES as string[]).includes(type) ? (type as TesseraType) : 'event';
}

/** Merge extracted records into the store: create new tesserae or corroborate existing ones,
    auto-gild the load-bearing corroborated core, then detect any new contradictions. */
export function mergeRecords(
  bundle: TroveBundle,
  records: ExtractedRecord[],
  ref: Ref,
  t: number,
): MergeEvent[] {
  const events: MergeEvent[] = [];
  const now = Date.now();

  for (const raw of records) {
    if (!raw || !raw.name || !raw.type) continue;
    const rec: ExtractedRecord = { ...raw, type: clampType(raw.type) };
    const detail = String(rec.detail || rec.name).slice(0, 400);
    const embedText = tesseraEmbedText({ type: rec.type, name: rec.name, detail, quote: rec.quote, subject: rec.subject, value: rec.value });
    const vec = localEmbed(embedText);
    const existing = findExisting(bundle, rec, vec);
    // a re-telling that carries a DIFFERENT specific value is NOT corroboration — it must live
    // as its own tile so the contradiction is raised and reconciled, never silently absorbed.
    const conflicts = !!(existing && rec.value && existing.value && normName(rec.value) !== normName(existing.value));

    if (existing && !conflicts) {
      // corroboration — a second telling confirms it
      existing.corroborationCount += 1;
      existing.lastTold = ref;
      existing.lastToldT = t;
      existing.confidence = Math.min(1, existing.confidence + 0.12);
      existing.salience = Math.max(existing.salience, rec.salience ?? existing.salience);
      if (rec.quote && !existing.quote) existing.quote = rec.quote.slice(0, 240);
      if (rec.value && !existing.value) existing.value = rec.value;
      if (rec.subject && !existing.subject) existing.subject = rec.subject;
      existing.provenance.sessions = Math.max(existing.provenance.sessions, ref.session);
      existing.updatedAt = now;
      // a corrected-away or user-dusted tile that gets re-told comes back as auto
      if (existing.dusted && existing.dustReason === 'auto') { existing.dusted = false; existing.dustReason = undefined; }

      const wasCanon = existing.canonical;
      maybeAutoGild(existing);
      events.push({ tessera: existing, action: existing.canonical && !wasCanon ? 'gilded' : 'corroborated' });
    } else {
      const type = rec.type;
      const valence = clampVal(rec.valence);
      const tess: Tessera = {
        id: newId('t_'),
        troveId: bundle.trove.id,
        type,
        name: String(rec.name).slice(0, 100),
        detail,
        quote: rec.quote ? String(rec.quote).slice(0, 240) : undefined,
        salience: rec.salience != null ? clamp01(rec.salience) : priorSalience(type, valence),
        valence,
        confidence: 0.55,
        corroborationCount: 1,
        contradictionCount: 0,
        canonical: !!rec.canonical,
        dusted: false,
        superseded: false,
        firstTold: ref,
        firstToldT: t,
        lastTold: ref,
        lastToldT: t,
        recallCount: 0,
        links: [],
        embedding: vec,
        embedModel: LOCAL_MODEL,
        provenance: { model: bundle.trove.brain === 'qwen' ? 'qwen' : 'offline', extractedTurn: ref, sessions: ref.session },
        createdAt: now,
        updatedAt: now,
      };
      if (rec.subject) tess.subject = rec.subject;
      else if (conflicts && existing?.subject) tess.subject = existing.subject; // group with the tile it contradicts
      if (rec.value) tess.value = rec.value;
      maybeAutoGild(tess);
      bundle.tesserae.push(tess);
      events.push({ tessera: tess, action: tess.canonical ? 'gilded' : 'set' });
    }
  }

  detectContradictions(bundle, ref.session);
  return events;
}

/** load-bearing + corroborated → gild (kept forever). Modest, so gold stays meaningful. */
function maybeAutoGild(t: Tessera): void {
  if (t.canonical || t.dusted || t.superseded) return;
  const val = Math.abs(t.valence);
  if (t.corroborationCount >= 3) t.canonical = true;
  else if (t.corroborationCount >= 2 && (val >= 0.55 || keepScore(t) >= 0.6)) t.canonical = true;
}

// ── user overrides (all reversible) ─────────────────────────────────────────
export function gild(bundle: TroveBundle, id: string): Tessera | null {
  const t = bundle.tesserae.find((x) => x.id === id);
  if (!t) return null;
  t.canonical = true; t.dusted = false; t.dustReason = undefined;
  t.confidence = Math.max(t.confidence, 0.9);
  t.updatedAt = Date.now();
  return t;
}

/** Lift a bad tile out — force-forget (dusted). Reversible. */
export function lift(bundle: TroveBundle, id: string): Tessera | null {
  const t = bundle.tesserae.find((x) => x.id === id);
  if (!t) return null;
  t.canonical = false; t.dusted = true; t.dustReason = 'user';
  t.updatedAt = Date.now();
  return t;
}

/** Brush the dust off — restore a forgotten tile. Bumps salience so it survives the current policy. */
export function brush(bundle: TroveBundle, id: string): Tessera | null {
  const t = bundle.tesserae.find((x) => x.id === id);
  if (!t) return null;
  t.dusted = false; t.dustReason = undefined; t.superseded = false; t.supersededBy = undefined;
  t.salience = Math.max(t.salience, 0.55);
  t.updatedAt = Date.now();
  return t;
}

/** Resolve a contradiction: gild the true tile, dust + supersede the slip(s). */
export function resolveContradiction(bundle: TroveBundle, id: string, value: string): Contradiction | null {
  const c = bundle.contradictions.find((x) => x.id === id);
  if (!c || c.status === 'resolved') return null;
  const winner = c.options.find((o) => o.value.toLowerCase() === value.toLowerCase()) || c.options[0];
  for (const opt of c.options) {
    const t = bundle.tesserae.find((x) => x.id === opt.tesseraId);
    if (!t) continue;
    if (opt === winner) {
      t.canonical = true; t.dusted = false; t.dustReason = undefined; t.superseded = false;
      t.confidence = Math.max(t.confidence, 0.92);
      t.contradictionCount += 1;
    } else {
      t.dusted = true; t.dustReason = 'slip'; t.superseded = true; t.supersededBy = winner.tesseraId;
      t.contradictionCount += 1;
    }
    t.updatedAt = Date.now();
  }
  c.status = 'resolved';
  c.resolvedTo = winner.value;
  c.resolvedAt = Date.now();
  return c;
}

// ── forgetting (decay / consolidation) ──────────────────────────────────────
export interface ForgetResult { dusted: number; restored: number; }

/** Apply the forgetting policy. Non-canon tiles below the keep threshold grey to dust (auto);
    auto-dusted tiles that rise back above it are consolidated (un-dusted). User-lifted and
    corrected-away (slip) tiles stay dusted until brushed. Nothing is destroyed. */
export function applyForgetting(bundle: TroveBundle): ForgetResult {
  const forgetting = bundle.trove.settings.forgetting;
  // tesserae held in an OPEN contradiction are protected — both sides stay visible until resolved.
  const held = new Set<string>();
  for (const c of bundle.contradictions) if (c.status === 'open') for (const o of c.options) held.add(o.tesseraId);
  let dusted = 0, restored = 0;
  for (const t of bundle.tesserae) {
    if (t.superseded || t.canonical || held.has(t.id)) continue;
    if (t.dustReason === 'user' || t.dustReason === 'slip') continue; // user/corrected — stay until brushed
    const shouldDust = wouldDust(t, forgetting);
    if (shouldDust && !t.dusted) { t.dusted = true; t.dustReason = 'auto'; dusted++; t.updatedAt = Date.now(); }
    else if (!shouldDust && t.dusted && t.dustReason === 'auto') { t.dusted = false; t.dustReason = undefined; restored++; t.updatedAt = Date.now(); }
  }
  return { dusted, restored };
}

export function touchRecalled(bundle: TroveBundle, ids: string[]): void {
  const now = Date.now();
  for (const id of ids) {
    const t = bundle.tesserae.find((x) => x.id === id);
    if (t) { t.recallCount += 1; t.updatedAt = now; }
  }
}

export { statusOf };
